import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from 'discord.js';
import {checkViolationByRegexp, sprintf, userMention} from "../utils";
import {isReachRateControl, RATE_CONTROL_LIMIT, TaskType} from "../utils/rateControl";
import {classifyInput, ClassifyCategory} from "../services/aiRouter";
import {ENVS} from "../services/urls";
import tLog, {LOG_ACTIONS} from "../utils/logUtils";

const CATEGORY_DISPLAY: Record<ClassifyCategory, string> = {
  human: "\u{1F9D1} Human Portrait",
  creature: "\u{1F409} Creature",
  human_creature: "\u{1F9D1}\u200D\u{1F91D}\u200D\u{1F9D1}\u{1F409} Human + Creature",
};

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

  try {
    await interaction.deferReply();

    tLog.log(LOG_ACTIONS.SYS, 'jujumon classifying', prompt || '(no prompt)', imageUrl ? '(has image)' : '(no image)');

    const result = await classifyInput(apiKey, imageUrl, prompt);

    const categoryLabel = CATEGORY_DISPLAY[result.category];

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

    tLog.logSuccess(LOG_ACTIONS.SYS, 'jujumon classified', result.category);
  } catch (e: any) {
    const errMsg = e.message || String(e);
    tLog.logError(LOG_ACTIONS.SYS, 'jujumon failed:', errMsg);
    try {
      await interaction.editReply({
        content: `${userMention(interaction.user.id)} JuJuMon classification failed: ${errMsg.substring(0, 200)}`,
      });
    } catch {
      // interaction may have expired
    }
  }
}
