import {
  ActionRowBuilder,
  ButtonBuilder,
  ChatInputCommandInteraction,
  SlashCommandBuilder,
} from 'discord.js';
import tRedis from '../redis';
import { GiveawayEnterBtn } from '../components/buttons/giveawayEnterBtn';
import TMessages from '../utils/messages';
import { GiveawayConstants } from '../utils/constants';
import { GiveawayEmbed } from '../utils/giveawayUtils';
import tLog, {LOG_ACTIONS} from '../utils/logUtils';

export const data = new SlashCommandBuilder()
  .setName('giveaway')
  .setDescription('create a giveaway (admin only)')
  .addNumberOption(option =>
    option.setName('duration')
      .setDescription('duration of the giveaway (number in hours)')
      .setRequired(true))
  .addIntegerOption(option =>
    option.setName('winners')
      .setDescription('number of winners (integer in person)')
      .setRequired(true))
  .addStringOption(option =>
    option.setName('prize')
      .setDescription('the prize being given away')
      .setRequired(true));

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  // Check if the user has administrator permissions
  if (!(interaction.memberPermissions?.has('Administrator'))) {
    await interaction.editReply({ content: TMessages.giveawayUserNoPermission });
    return;
  }

  const duration = interaction.options.getNumber('duration')!;
  const winners = interaction.options.getInteger('winners')!;
  const prizeMessage = interaction.options.getString('prize')!;

  const endTime = new Date(Date.now() + duration * 60 * 60 * 1000);

  // Fetch the channel and check permissions
  const channel = await interaction.client.channels.fetch(interaction.channelId);

  if (!channel || !channel.isTextBased() || !('permissionsFor' in channel)) {
    await interaction.editReply({ content: TMessages.giveawayBotNoAccessPermission });
    return;
  }

  // Ensure the bot has permissions to send messages in the channel
  if (!channel.permissionsFor(interaction.client.user)?.has('SendMessages')) {
    await interaction.editReply({ content: TMessages.giveawayBotNoSendPermission });
    return;
  }

  let giveawayMessage;

  const giveawayEmbed = new GiveawayEmbed({
    prize: prizeMessage,
    endTime: endTime,
    host: interaction.user,
    entries: 0,
    winners: winners,
    isEnded: false
  });

  try {
    giveawayMessage = await channel.send({
      embeds: [giveawayEmbed.getEmbed()],
      components: [
        new ActionRowBuilder<ButtonBuilder>()
          .addComponents(GiveawayEnterBtn(interaction.id)) // 使用 interaction.id 作为唯一标识符
      ]
    });
  } catch (error) {
    tLog.logError(LOG_ACTIONS.GIVEAWAY, TMessages.giveawayStartSendMsgError, error);
    await interaction.editReply({ content: TMessages.giveawayStartError });
    return;
  }

  const giveawayId = giveawayMessage.id;

  // Store giveaway info in Redis
  const giveawayData = {
    'endTime': endTime.getTime(),
    'winners': winners,
    'prizeMessage': prizeMessage,
    'channelId': interaction.channelId,
    'hostId': interaction.user.id,
    'interactionId': interaction.id,
    'isDeleted': 'false'
  };

  await tRedis.redisDB?.hmset(`${GiveawayConstants.GIVEAWAY_PREFIX}${giveawayId}`, giveawayData);

  tLog.logSuccess(LOG_ACTIONS.GIVEAWAY, TMessages.giveawayStartSuccess, `giveawayId: ${giveawayId}`, giveawayData);
  await interaction.editReply({ content: TMessages.giveawayStartSuccess });
}
