import {
  AttachmentBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from 'discord.js';
import {checkViolationByRegexp, sprintf, userMention} from "../utils";
import {isReachRateControl, RATE_CONTROL_LIMIT, TaskType} from "../utils/rateControl";
import {WORKFLOW_CONFIG, WORKFLOW_CHOICES, WorkflowType} from "../services/workflowConfig";
import {generateWithGemini, generateWithDoubao} from "../services/aiHub";
import {classifyInput} from "../services/aiRouter";
import {ENVS} from "../services/urls";
import tLog, {LOG_ACTIONS} from "../utils/logUtils";
import {CheckoutBtnRows} from "../components/buttons/checkoutBtns";
import axios from "axios";

const CREATURE_STYLE_PROMPT = "极致Q版萌化风格，治愈系黏土质感3D建模，头身比1:1，超圆滚滚的头部，扁平豆豆眼，圆润腮红，短到几乎看不见的四肢，胖乎乎的软萌体态，表面有细腻的黏土颗粒纹理和手工指纹痕迹，柔和马卡龙低饱和配色，色彩自然渐变融合，温暖漫射光，边缘模糊的柔和阴影，慵懒松弛的可爱姿势，点缀微小花瓣/小草元素，纯白干净背景，整体氛围温暖治愈，8K高清，细节丰富";

const HUMAN_STEP1_PROMPT = `[任务指令]
保留人像的五官特征、发型、发色，调整人物比例和姿态为标准的动漫风格杉森建（Ken Sugimori）早期画风。
动漫风格圆眼睛，iconic Ken Sugimori art style, Kotobukiya ARTFX J aesthetic。
转换成宝可梦训练师风格的人物图鉴2D图。
全身像，纯白背景，清晰线条，平涂上色。`;

const HUMAN_STEP2_PROMPT = `[任务指令]
Full-body product shot of a highly detailed, complete physical 1/8 scale PVC collectible statue of the character shown in the reference image. The entire figure is centered and fully visible within the frame, from the top of the head to the bottom. The statue has a deeply tangible, physical presence, crafted from dense, matte-finish PVC and ABS plastics. Real-world studio product lighting hits the surface, creating subtle specular highlights on the sharp edges of the sculpted hair and clothing folds, with soft, realistic contact shadows emphasizing its three-dimensional volume. The paint application is impeccable with hand-finished, clean, sharp lines. The character has balanced, youthful proportions, with visible material thickness on all clothing and accessories as shown in the reference image. Set against a seamless, neutral white studio background. Wide-angle studio photography to ensure no parts are cropped, with a sharp focus on the plastic material textures. 8k resolution.`;

async function imageToBuffer(imageUrlOrBase64: string): Promise<Buffer> {
  if (imageUrlOrBase64.startsWith('data:')) {
    const base64Data = imageUrlOrBase64.replace(/^data:image\/\w+;base64,/, "");
    return Buffer.from(base64Data, 'base64');
  }
  const res = await axios.get(imageUrlOrBase64, { responseType: 'arraybuffer', timeout: 30000 });
  return Buffer.from(res.data);
}

export const data = new SlashCommandBuilder()
  .setName('jujubot-create')
  .setDescription('Generate stylized art from image or text (TRPG, Chibi, 1:7 Figure, Creative)')
  .addStringOption(option =>
    option.setName("style")
      .setDescription("Art style to apply")
      .setRequired(true)
      .addChoices(...WORKFLOW_CHOICES)
  )
  .addAttachmentOption(option =>
    option.setName("image")
      .setDescription("Reference image (optional if prompt is provided)")
      .setRequired(false)
  )
  .addStringOption(option =>
    option.setName("prompt")
      .setDescription("Text description or additional instructions (optional if image is provided)")
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const style = interaction.options.getString('style', true) as WorkflowType;
  const attachment = interaction.options.getAttachment('image');
  const prompt = interaction.options.getString('prompt') || undefined;

  // Validate: at least one of image or prompt required
  if (!attachment && !prompt) {
    await interaction.reply({
      content: `${userMention(interaction.user.id)} Please provide at least an image or a text prompt.`,
      ephemeral: true,
    });
    return;
  }

  // Content moderation
  if (prompt && checkViolationByRegexp(prompt)) {
    await interaction.reply({
      content: `${userMention(interaction.user.id)} your prompt violates ToS or contains illegal information, not allowed.`,
    });
    return;
  }

  // Rate limit
  const [_, isUsedOut] = await isReachRateControl(interaction.user.id, TaskType.TASK_STYLE_GEN);
  if (isUsedOut) {
    await interaction.reply(
      sprintf("%s your account reached the rate limit, %s %d times per hour.",
        userMention(interaction.user.id), TaskType.TASK_STYLE_GEN, RATE_CONTROL_LIMIT.STYLE_GEN)
    );
    return;
  }

  // Check API key
  const apiKey = ENVS.aiHubApiKey;
  if (!apiKey) {
    await interaction.reply({ content: 'Server config error: AIHUBMIX_API_KEY not set.', ephemeral: true });
    return;
  }

  const config = WORKFLOW_CONFIG[style];
  const styleName = WORKFLOW_CHOICES.find(c => c.value === style)?.name || style;
  const imageUrl = attachment?.url || null;

  const msgHeader = sprintf("**%s**\nCreated by %s", styleName, userMention(interaction.user.id));

  try {
    await interaction.deferReply();
    await interaction.editReply({ content: `${msgHeader}\nStatus: generating...` });

    // --- JuJuMon Creature workflow ---
    if (style === 'jujumon_creature') {
      let finalPrompt: string;
      if (imageUrl && prompt) {
        finalPrompt = `[主体]\n${prompt}\n\n[任务指令]\n请严格按照主体描述，结合图片参考，以下面的风格绘制。必须保留主体的物种特征和外观。\n\n[风格约束]\n${CREATURE_STYLE_PROMPT}`;
      } else if (imageUrl) {
        finalPrompt = `[任务指令]\n请将图片中的生物主体，以下面的风格重新绘制。严格保留原图生物的物种、体型特征、毛色/皮肤颜色和姿势。\n\n[风格约束]\n${CREATURE_STYLE_PROMPT}`;
      } else {
        finalPrompt = `[主体]\n请绘制：${prompt}。必须清晰体现"${prompt}"的物种外观特征（体型、耳朵、尾巴、毛色等）。\n\n[风格约束]\n${CREATURE_STYLE_PROMPT}`;
      }

      tLog.log(LOG_ACTIONS.SYS, 'jujubot-create jujumon_creature generating');
      const resultImageUrl = await generateWithGemini(apiKey, finalPrompt, imageUrl);
      const resultBuffer = await imageToBuffer(resultImageUrl);

      const file = new AttachmentBuilder(resultBuffer, { name: 'result.png' });
      const embed = new EmbedBuilder().setImage('attachment://result.png');
      if (imageUrl) embed.setThumbnail(imageUrl);

      const msg = await interaction.editReply({ content: msgHeader, embeds: [embed], files: [file] });
      const designUrl = `https://discord.com/channels/${interaction.guildId}/${msg.channelId}/${msg.id}`;
      const checkoutRows = CheckoutBtnRows({ styleName, designUrl });
      await interaction.editReply({ components: checkoutRows });

      tLog.logSuccess(LOG_ACTIONS.SYS, 'jujubot-create jujumon_creature success');
      return;
    }

    // --- JuJuMon Trainer workflow ---
    if (style === 'jujumon_trainer') {
      let step2InputUrl: string | null = imageUrl;

      // If image provided, check if real photo → 2-step
      if (imageUrl) {
        tLog.log(LOG_ACTIONS.SYS, 'jujubot-create jujumon_trainer classifying');
        const classResult = await classifyInput(apiKey, imageUrl, prompt);

        if (classResult.isRealPhoto) {
          tLog.log(LOG_ACTIONS.SYS, 'jujubot-create jujumon_trainer step1: real photo → 2D');
          const step1Prompt = prompt
            ? `${HUMAN_STEP1_PROMPT}\n\n[补充描述]\n${prompt}`
            : HUMAN_STEP1_PROMPT;
          const step1Result = await generateWithGemini(apiKey, step1Prompt, imageUrl);
          const step1Buffer = await imageToBuffer(step1Result);
          step2InputUrl = `data:image/png;base64,${step1Buffer.toString('base64')}`;
          tLog.logSuccess(LOG_ACTIONS.SYS, 'jujubot-create jujumon_trainer step1 done');
        }
      }

      tLog.log(LOG_ACTIONS.SYS, 'jujubot-create jujumon_trainer step2: → PVC statue');
      let step2Prompt: string;
      if (step2InputUrl) {
        step2Prompt = prompt
          ? `${HUMAN_STEP2_PROMPT}\n\n[补充描述]\n${prompt}`
          : HUMAN_STEP2_PROMPT;
      } else {
        step2Prompt = `[主体]\n${prompt}\n\n${HUMAN_STEP2_PROMPT}`;
      }

      const finalResultUrl = await generateWithGemini(apiKey, step2Prompt, step2InputUrl);
      const resultBuffer = await imageToBuffer(finalResultUrl);

      const file = new AttachmentBuilder(resultBuffer, { name: 'result.png' });
      const embed = new EmbedBuilder().setImage('attachment://result.png');
      if (imageUrl) embed.setThumbnail(imageUrl);

      const msg = await interaction.editReply({ content: msgHeader, embeds: [embed], files: [file] });
      const designUrl = `https://discord.com/channels/${interaction.guildId}/${msg.channelId}/${msg.id}`;
      const checkoutRows = CheckoutBtnRows({ styleName, designUrl });
      await interaction.editReply({ components: checkoutRows });

      tLog.logSuccess(LOG_ACTIONS.SYS, 'jujubot-create jujumon_trainer success');
      return;
    }

    // --- Original workflows ---
    // --- Build prompt ---
    let finalPrompt = "";

    if (imageUrl && !prompt) {
      // Case 1: Image only
      if (style === 'creative') {
        finalPrompt = `[任务指令]
分析图片1的主体内容。
1. **若主体是人/宠物**：
   - 将其重绘为**3D艺术公仔/盲盒风格**。
   - **关键约束**：必须严格保留原图人物的性别、发型、发色、衣着款式和姿势！
   - 严禁出现写实真人质感，改为平滑的PVC/树脂材质。
   - 面部表情要进行卡通化夸张，但必须能认出是同一个人。
2. **若主体是物体**：保持主体结构和外观不变，仅增强3D渲染质感。
3. **通用**：移除原背景，替换为纯白背景。`;
      } else {
        finalPrompt = `[任务指令]
图片1是**内容参考**（Content Reference）。
图片2是**风格参考**（Style Reference）。

请将图片1中的主体，重绘为图片2的艺术风格。

[严格约束]
1. **内容忠实度**：必须保留图片1中人物的性别、五官特征、发型、衣着细节和姿势。**严禁改变人物身份或外观特征！**
2. **风格迁移**：仅迁移图片2的材质、光影、笔触和色彩氛围。

[风格详情]
${config.img2img_prompt}`;
      }
    } else if (prompt && imageUrl) {
      // Case 2: Image + Prompt
      finalPrompt = `${prompt}。\n\n[风格约束]\n${config.img2img_prompt}`;
    } else if (prompt && !imageUrl) {
      // Case 3: Text only
      finalPrompt = prompt;
      if (config.img2img_prompt) {
        finalPrompt = `${prompt}。\n\n[风格约束]\n${config.img2img_prompt}`;
      }
    }

    if (!finalPrompt) {
      await interaction.editReply({ content: `${msgHeader}\nStatus: error - failed to build prompt` });
      return;
    }

    tLog.log(LOG_ACTIONS.SYS, 'jujubot-create generating', style, prompt || '(no prompt)');

    // --- Call generation API ---
    let resultImageUrl: string;

    if (imageUrl) {
      // Has image → use Gemini with optional style image
      const effectiveStyleUrl = (style === 'creative') ? null : (config.style_image_url || null);
      resultImageUrl = await generateWithGemini(apiKey, finalPrompt, imageUrl, effectiveStyleUrl);
    } else if (config.style_image_url) {
      // Text only + has style image → Gemini with style reference
      resultImageUrl = await generateWithGemini(apiKey, finalPrompt, null, config.style_image_url);
    } else {
      // Text only + no style image (creative) → Doubao
      resultImageUrl = await generateWithDoubao(apiKey, finalPrompt);
    }

    // --- Build response, then add checkout buttons with image URL ---
    let resultBuffer: Buffer;

    if (resultImageUrl.startsWith('data:')) {
      const base64Data = resultImageUrl.replace(/^data:image\/\w+;base64,/, "");
      resultBuffer = Buffer.from(base64Data, 'base64');
    } else {
      const imgRes = await axios.get(resultImageUrl, { responseType: 'arraybuffer', timeout: 30000 });
      resultBuffer = Buffer.from(imgRes.data);
    }

    // Step 1: Send image first to get Discord CDN URL
    const file = new AttachmentBuilder(resultBuffer, { name: 'result.png' });
    const embed = new EmbedBuilder().setImage('attachment://result.png');
    if (imageUrl) embed.setThumbnail(imageUrl);

    const msg = await interaction.editReply({
      content: msgHeader,
      embeds: [embed],
      files: [file],
    });

    // Step 2: Build Discord message link as a short, stable reference
    const designUrl = `https://discord.com/channels/${interaction.guildId}/${msg.channelId}/${msg.id}`;

    // Step 3: Update message with checkout buttons carrying style + design link as line item properties
    const checkoutRows = CheckoutBtnRows({ styleName, designUrl });
    await interaction.editReply({
      components: checkoutRows,
    });

    tLog.logSuccess(LOG_ACTIONS.SYS, 'jujubot-create success', style);
  } catch (e: any) {
    const errMsg = e.message || String(e);
    tLog.logError(LOG_ACTIONS.SYS, 'jujubot-create failed:', errMsg);
    try {
      await interaction.editReply({
        content: `${msgHeader}\nStatus: error\n${errMsg.substring(0, 200)}`,
      });
    } catch {
      // interaction may have expired
    }
  }
}
