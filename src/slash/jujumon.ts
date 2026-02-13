import {
  AttachmentBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from 'discord.js';
import {checkViolationByRegexp, sprintf, userMention} from "../utils";
import {isReachRateControl, RATE_CONTROL_LIMIT, TaskType} from "../utils/rateControl";
import {ClassifyCategory} from "../services/aiRouter";
import {runJujumonPipeline} from "../services/jujumonPipeline";
import tLog, {LOG_ACTIONS} from "../utils/logUtils";

const CATEGORY_DISPLAY: Record<ClassifyCategory, string> = {
  human: "\u{1F9D1} Human Portrait",
  creature: "\u{1F409} Creature",
  human_creature: "\u{1F9D1}\u200D\u{1F91D}\u200D\u{1F9D1}\u{1F409} Human + Creature",
};

const CATEGORY_TITLE: Record<ClassifyCategory, string> = {
  creature: "\u{1F409} JuJuMon \u2014 Creature",
  human: "\u{1F9D1} JuJuMon \u2014 Trainer",
  human_creature: "\u{1F409} JuJuMon \u2014 Creature",
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

  const imageUrl = attachment?.url || null;
  const msgHeader = sprintf("**JuJuMon**\nCreated by %s", userMention(interaction.user.id));

  try {
    await interaction.deferReply();

    const result = await runJujumonPipeline(
      { prompt, imageUrl },
      {
        onClassifying: () => interaction.editReply({ content: `${msgHeader}\nStatus: classifying...` }),
        onGenerating: (category) => {
          const categoryLabel = CATEGORY_DISPLAY[category];
          return interaction.editReply({ content: `${msgHeader}\nCategory: ${categoryLabel}\nStatus: generating...` });
        },
      },
    );

    const file = new AttachmentBuilder(result.imageBuffer, { name: 'jujumon.png' });
    const embed = new EmbedBuilder()
      .setTitle(CATEGORY_TITLE[result.category])
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

    tLog.logSuccess(LOG_ACTIONS.SYS, `jujumon [${result.category}] done`);
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
