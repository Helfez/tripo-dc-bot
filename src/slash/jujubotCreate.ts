import {
  AttachmentBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from 'discord.js';
import {checkViolationByRegexp, sprintf, userMention} from "../utils";
import {isReachRateControl, RATE_CONTROL_LIMIT, TaskType} from "../utils/rateControl";
import {WORKFLOW_CHOICES, WorkflowType} from "../services/workflowConfig";
import {runCreatePipeline} from "../services/createPipeline";
import tLog, {LOG_ACTIONS} from "../utils/logUtils";
import {CheckoutBtnRows} from "../components/buttons/checkoutBtns";

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

  const imageUrl = attachment?.url || null;
  const styleName = WORKFLOW_CHOICES.find(c => c.value === style)?.name || style;
  const msgHeader = sprintf("**%s**\nCreated by %s", styleName, userMention(interaction.user.id));

  try {
    await interaction.deferReply();

    const result = await runCreatePipeline(
      { style, prompt, imageUrl },
      {
        onGenerating: () => interaction.editReply({ content: `${msgHeader}\nStatus: generating...` }),
      },
    );

    const file = new AttachmentBuilder(result.imageBuffer, { name: 'result.png' });
    const embed = new EmbedBuilder().setImage('attachment://result.png');
    if (imageUrl) embed.setThumbnail(imageUrl);

    const msg = await interaction.editReply({ content: msgHeader, embeds: [embed], files: [file] });

    const designUrl = `https://discord.com/channels/${interaction.guildId}/${msg.channelId}/${msg.id}`;
    const checkoutRows = CheckoutBtnRows({ styleName, designUrl });
    await interaction.editReply({ components: checkoutRows });

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
