import {
  AttachmentBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from 'discord.js';
import {checkViolationByRegexp, sprintf, userMention} from "../utils";
import {isReachRateControl, RATE_CONTROL_LIMIT, TaskType} from "../utils/rateControl";
import {classifyInput, ClassifyCategory} from "../services/aiRouter";
import {generateWithGemini, generateWithDoubao} from "../services/aiHub";
import {ENVS} from "../services/urls";
import tLog, {LOG_ACTIONS} from "../utils/logUtils";
import axios from "axios";

const CATEGORY_DISPLAY: Record<ClassifyCategory, string> = {
  human: "\u{1F9D1} Human Portrait",
  creature: "\u{1F409} Creature",
  human_creature: "\u{1F9D1}\u200D\u{1F91D}\u200D\u{1F9D1}\u{1F409} Human + Creature",
};

const CREATURE_STYLE_PROMPT = "极致Q版萌化风格，治愈系黏土质感3D建模，头身比1:1，超圆滚滚的头部，扁平豆豆眼，圆润腮红，短到几乎看不见的四肢，胖乎乎的软萌体态，表面有细腻的黏土颗粒纹理和手工指纹痕迹，柔和马卡龙低饱和配色，色彩自然渐变融合，温暖漫射光，边缘模糊的柔和阴影，慵懒松弛的可爱姿势，点缀微小花瓣/小草元素，纯白干净背景，整体氛围温暖治愈，8K高清，细节丰富";

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

      let resultImageUrl: string;
      if (imageUrl) {
        resultImageUrl = await generateWithGemini(apiKey, finalPrompt, imageUrl);
      } else {
        resultImageUrl = await generateWithDoubao(apiKey, finalPrompt);
      }

      // Build image buffer
      let resultBuffer: Buffer;
      if (resultImageUrl.startsWith('data:')) {
        const base64Data = resultImageUrl.replace(/^data:image\/\w+;base64,/, "");
        resultBuffer = Buffer.from(base64Data, 'base64');
      } else {
        const imgRes = await axios.get(resultImageUrl, { responseType: 'arraybuffer', timeout: 30000 });
        resultBuffer = Buffer.from(imgRes.data);
      }

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

    // --- Other workflows: coming soon ---
    const embed = new EmbedBuilder()
      .setTitle("\u{1F50D} JuJuMon Analysis")
      .setDescription(`Created by ${userMention(interaction.user.id)}`)
      .addFields(
        { name: "Category", value: categoryLabel, inline: true },
        { name: "AI says", value: `"${result.reasoning}"` },
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
