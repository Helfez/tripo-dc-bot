import { ButtonInteraction, Client } from 'discord.js';
import { BtnFormat } from '../utils/constants';
import * as drawService from '../services/lottery/drawService';
import * as userService from '../services/lottery/userService';
import { buildWinEmbed, buildWinButtons, buildNoWinEmbed } from '../utils/lotteryEmbeds';
import tLog, { LOG_ACTIONS } from '../utils/logUtils';

export const name = BtnFormat.BTN_LUCKY_DRAW;

export async function onHandler(client: Client, interaction: ButtonInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const discordId = interaction.user.id;

  try {
    const result = await drawService.executeDraw(discordId, interaction.user.displayName);

    switch (result.type) {
      case 'WIN': {
        const embed = buildWinEmbed(result.prize.name, result.prize.couponCode, result.prize.tier);
        const buttons = buildWinButtons(result.prize.id);
        await interaction.editReply({ embeds: [embed], components: [buttons] });
        break;
      }

      case 'NO_WIN': {
        const { user } = await userService.getUserStats(discordId);
        const embed = buildNoWinEmbed(user.drawChances);
        await interaction.editReply({ embeds: [embed] });
        break;
      }

      case 'NO_CHANCE': {
        await interaction.editReply({
          content: '⚠️ You have no draw chances left!\n\n' +
            '💡 Create monsters with `/jujumon` to earn more chances.\n' +
            '💡 Each purchase also earns 10 chances.',
        });
        break;
      }

      case 'DAILY_LIMIT': {
        await interaction.editReply({
          content: '⚠️ You\'ve reached today\'s draw limit (50 times).\n\n' +
            '🕐 Come back tomorrow for more chances!',
        });
        break;
      }
    }
  } catch (err: any) {
    tLog.logError(LOG_ACTIONS.LOTTERY, 'Draw button error:', err?.message || err);
    await interaction.editReply('❌ Something went wrong. Please try again.');
  }
}
