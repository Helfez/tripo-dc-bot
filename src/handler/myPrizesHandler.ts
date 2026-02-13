import { ButtonInteraction, Client } from 'discord.js';
import { BtnFormat } from '../utils/constants';
import * as prizeService from '../services/lottery/prizeService';
import { buildPrizeListEmbed } from '../utils/lotteryEmbeds';
import tLog, { LOG_ACTIONS } from '../utils/logUtils';

export const name = BtnFormat.BTN_MY_PRIZES;

export async function onHandler(client: Client, interaction: ButtonInteraction) {
  await interaction.deferReply({ ephemeral: true });

  try {
    const prizes = await prizeService.getUserPrizes(interaction.user.id);
    const embed = buildPrizeListEmbed(prizes);
    await interaction.editReply({ embeds: [embed] });
  } catch (err: any) {
    tLog.logError(LOG_ACTIONS.LOTTERY, 'My prizes error:', err?.message || err);
    await interaction.editReply('❌ Failed to load prizes.');
  }
}
