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
import {ENVS} from "../services/urls";
import tLog, {LOG_ACTIONS} from "../utils/logUtils";
import {CheckoutBtnRows} from "../components/buttons/checkoutBtns";
import axios from "axios";

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

    // Step 2: Extract Discord CDN URL from the uploaded attachment
    const cdnImageUrl = msg.attachments.first()?.url || msg.embeds[0]?.image?.url;

    // Step 3: Update message with checkout buttons containing the image URL as cart note
    const checkoutRows = CheckoutBtnRows(cdnImageUrl);
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
