import {AutocompleteInteraction, ChatInputCommandInteraction, SlashCommandBuilder} from 'discord.js';
import tRedis from '../redis';
import TMessages from '../utils/messages';
import {GiveawayConstants} from '../utils/constants';
import tLog, {LOG_ACTIONS} from "../utils/logUtils";

export const data = new SlashCommandBuilder()
    .setName('giveaway-delete')
    .setDescription('delete an ongoing giveaway (admin only)')
    .addStringOption(option =>
      option.setName('giveaway_id')
        .setDescription('the ID of the giveaway to delete')
        .setRequired(true)
        .setAutocomplete(true));

  export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });
    
    // Check if the user has administrator permissions
    if (!(interaction.memberPermissions?.has('Administrator'))) {
      await interaction.editReply({ content: TMessages.giveawayUserNoPermission });
      return;
    }

    const giveawayId = interaction.options.getString('giveaway_id')!;

    // Check if the giveaway exists in Redis
    const giveawayExists = await tRedis.redisDB?.exists(`${GiveawayConstants.GIVEAWAY_PREFIX}${giveawayId}`);

    if (!giveawayExists) {
      await interaction.editReply({ content: TMessages.giveawayNotFound });
      return;
    }

    try {
      // Delete the giveaway from Redis
      await tRedis.redisDB?.hset(`${GiveawayConstants.GIVEAWAY_PREFIX}${giveawayId}`, 'isDeleted', 'true');

      // Try to delete the giveaway message
      const giveawayData = await tRedis.redisDB?.hgetall(`${GiveawayConstants.GIVEAWAY_PREFIX}${giveawayId}`);
      const channelId = giveawayData?.channelId;
      const prizeMessage = giveawayData?.prizeMessage;
      if (channelId) {
        const channel = await interaction.client.channels.fetch(channelId);
        if (channel && channel.isTextBased()) {
          try {
            await channel.messages.delete(giveawayId);
          } catch (error) {
            tLog.logError(LOG_ACTIONS.GIVEAWAY, 'Failed to delete giveaway message:', error);
          }
        }
      }

      // Delete the giveaway from Redis
      await tRedis.redisDB?.del(`${GiveawayConstants.GIVEAWAY_PREFIX}${giveawayId}`);
      await tRedis.redisDB?.del(`${GiveawayConstants.GIVEAWAY_PREFIX}${giveawayId}${GiveawayConstants.GIVEAWAY_POSTFIX}`);

      await interaction.editReply({ content: TMessages.giveawayDeleteSuccess });

      tLog.logSuccess(LOG_ACTIONS.GIVEAWAY, `Giveaway ${prizeMessage} deleted by ${interaction.user.toString()}.`, `giveawayId: ${giveawayId}`, giveawayData);
    } catch (error) {
      tLog.logError(LOG_ACTIONS.GIVEAWAY, 'Error deleting giveaway:', error);
      await interaction.editReply({ content: TMessages.giveawayDeleteError });
    }
  }

  export async function autocomplete(interaction: AutocompleteInteraction) {
    try {
      const focusedValue = interaction.options.getFocused();

      const giveaways = await getOngoingGiveaways();

      const filtered = giveaways.filter(giveaway =>
        giveaway.id.startsWith(focusedValue) || giveaway.prize.toLowerCase().includes(focusedValue.toLowerCase())
      );

      await interaction.respond(
        filtered.map(giveaway => ({ name: `${giveaway.prize} (ID: ${giveaway.id})`, value: giveaway.id })).slice(0, 25)
      );
    } catch (error) {
      tLog.logError(LOG_ACTIONS.GIVEAWAY, "Error in autocomplete function:", error);
    }
  }

  async function getOngoingGiveaways() {
    try {
      const keys = await tRedis.redisDB?.keys(`${GiveawayConstants.GIVEAWAY_PREFIX}*`);
      const filteredKeys = keys?.filter(key => !key.endsWith(GiveawayConstants.GIVEAWAY_POSTFIX));
      const giveaways = [];

      for (const key of filteredKeys || []) {
        const giveawayData = await tRedis.redisDB?.hgetall(key);
        if (giveawayData) {
          giveaways.push({
            id: key.replace(GiveawayConstants.GIVEAWAY_PREFIX, ''),
            prize: giveawayData.prizeMessage
          });
        }
      }

      return giveaways;
    } catch (error) {
      tLog.logError(LOG_ACTIONS.GIVEAWAY, "Error fetching ongoing giveaways:", error);
      return [];
    }
  }
