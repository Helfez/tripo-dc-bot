import {
  AttachmentBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from 'discord.js';
import {checkViolationByRegexp, sprintf, userMention} from "../utils";
import {isReachRateControl, RATE_CONTROL_LIMIT, TaskType} from "../utils/rateControl";
import {classifyInput, ClassifyCategory} from "../services/aiRouter";
import {generateWithGemini} from "../services/aiHub";
import {ENVS} from "../services/urls";
import tLog, {LOG_ACTIONS} from "../utils/logUtils";
import axios from "axios";

const CATEGORY_DISPLAY: Record<ClassifyCategory, string> = {
  human: "\u{1F9D1} Human Portrait",
  creature: "\u{1F409} Creature",
  human_creature: "\u{1F9D1}\u200D\u{1F91D}\u200D\u{1F9D1}\u{1F409} Human + Creature",
};

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
  .setName('jujumon')
  .setDescription('Create a JuJuMon — AI classifies your input and routes to the right workflow')
  .addAttachmentOption(option =>
    option.setName("image")
      .setDescription("Reference image")
      .setRequired(false)
  )
  .addStringOption(option =>
    option.setName("prompt")
      .setDescription("Text description")
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
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

  // Rate limit (shared pool with jujubot-create)
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

  const imageUrl = attachment?.url || null;

  const msgHeader = sprintf("**JuJuMon**\nCreated by %s", userMention(interaction.user.id));

  try {
    await interaction.deferReply();

    tLog.log(LOG_ACTIONS.SYS, 'jujumon classifying', prompt || '(no prompt)', imageUrl ? '(has image)' : '(no image)');
    await interaction.editReply({ content: `${msgHeader}\nStatus: classifying...` });

    const result = await classifyInput(apiKey, imageUrl, prompt);
    const categoryLabel = CATEGORY_DISPLAY[result.category];

    tLog.logSuccess(LOG_ACTIONS.SYS, 'jujumon classified', result.category);

    // --- Creature workflow: generate image ---
    if (result.category === 'creature') {
      await interaction.editReply({ content: `${msgHeader}\nCategory: ${categoryLabel}\nStatus: generating...` });

      let finalPrompt: string;
      if (imageUrl && prompt) {
        finalPrompt = `[主体]\n${prompt}\n\n[任务指令]\n请严格按照主体描述，结合图片参考，以下面的风格绘制。必须保留主体的物种特征和外观。\n\n[风格约束]\n${CREATURE_STYLE_PROMPT}`;
      } else if (imageUrl) {
        finalPrompt = `[任务指令]\n请将图片中的生物主体，以下面的风格重新绘制。严格保留原图生物的物种、体型特征、毛色/皮肤颜色和姿势。\n\n[风格约束]\n${CREATURE_STYLE_PROMPT}`;
      } else {
        finalPrompt = `[主体]\n请绘制：${prompt}。必须清晰体现"${prompt}"的物种外观特征（体型、耳朵、尾巴、毛色等）。\n\n[风格约束]\n${CREATURE_STYLE_PROMPT}`;
      }

      tLog.log(LOG_ACTIONS.SYS, 'jujumon creature generating');

      const resultImageUrl = await generateWithGemini(apiKey, finalPrompt, imageUrl);
      const resultBuffer = await imageToBuffer(resultImageUrl);

      const file = new AttachmentBuilder(resultBuffer, { name: 'jujumon.png' });
      const embed = new EmbedBuilder()
        .setTitle("\u{1F409} JuJuMon — Creature")
        .setDescription(`Created by ${userMention(interaction.user.id)}`)
        .setImage('attachment://jujumon.png');

      if (imageUrl) {
        embed.setThumbnail(imageUrl);
      }

      await interaction.editReply({
        content: msgHeader,
        embeds: [embed],
        files: [file],
      });

      tLog.logSuccess(LOG_ACTIONS.SYS, 'jujumon creature done');
      return;
    }

    // --- Human workflow: generate PVC statue ---
    if (result.category === 'human') {
      await interaction.editReply({ content: `${msgHeader}\nStatus: generating...` });

      let step2InputUrl: string | null = imageUrl;

      // Real photo → Step 1: convert to 2D Ken Sugimori style first
      if (imageUrl && result.isRealPhoto) {
        tLog.log(LOG_ACTIONS.SYS, 'jujumon human step1: real photo → 2D');
        const step1Prompt = prompt
          ? `${HUMAN_STEP1_PROMPT}\n\n[补充描述]\n${prompt}`
          : HUMAN_STEP1_PROMPT;
        const step1Result = await generateWithGemini(apiKey, step1Prompt, imageUrl);

        // Convert step1 result to a data URL so it can be passed as input to step2
        const step1Buffer = await imageToBuffer(step1Result);
        step2InputUrl = `data:image/png;base64,${step1Buffer.toString('base64')}`;
        tLog.logSuccess(LOG_ACTIONS.SYS, 'jujumon human step1 done');
      }

      // Step 2: generate PVC statue
      tLog.log(LOG_ACTIONS.SYS, 'jujumon human step2: → PVC statue');
      let step2Prompt: string;
      if (step2InputUrl) {
        step2Prompt = prompt
          ? `${HUMAN_STEP2_PROMPT}\n\n[补充描述]\n${prompt}`
          : HUMAN_STEP2_PROMPT;
      } else {
        // Text only, no image
        step2Prompt = `[主体]\n${prompt}\n\n${HUMAN_STEP2_PROMPT}`;
      }

      const finalResultUrl = await generateWithGemini(apiKey, step2Prompt, step2InputUrl);
      const resultBuffer = await imageToBuffer(finalResultUrl);

      const file = new AttachmentBuilder(resultBuffer, { name: 'jujumon.png' });
      const embed = new EmbedBuilder()
        .setTitle("\u{1F9D1} JuJuMon — Trainer")
        .setDescription(`Created by ${userMention(interaction.user.id)}`)
        .setImage('attachment://jujumon.png');

      if (imageUrl) {
        embed.setThumbnail(imageUrl);
      }

      await interaction.editReply({
        content: msgHeader,
        embeds: [embed],
        files: [file],
      });

      tLog.logSuccess(LOG_ACTIONS.SYS, 'jujumon human done');
      return;
    }

    // --- Other workflows: coming soon ---
    const embed = new EmbedBuilder()
      .setTitle("\u{1F50D} JuJuMon Analysis")
      .setDescription(`Created by ${userMention(interaction.user.id)}`)
      .addFields(
        { name: "Category", value: categoryLabel, inline: true },
        { name: "\u200B", value: "\u23F3 Workflow coming soon!" },
      );

    if (imageUrl) {
      embed.setThumbnail(imageUrl);
    }

    await interaction.editReply({
      embeds: [embed],
    });
  } catch (e: any) {
    const errMsg = e.message || String(e);
    tLog.logError(LOG_ACTIONS.SYS, 'jujumon failed:', errMsg);
    try {
      await interaction.editReply({
        content: `${msgHeader}\nStatus: error\n${errMsg.substring(0, 200)}`,
      });
    } catch {
      // interaction may have expired
    }
  }
}
