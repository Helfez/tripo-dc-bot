import { ButtonInteraction, Client } from 'discord.js';
import { BtnFormat } from '../utils/constants';
import * as workService from '../services/lottery/workService';
import { buildWorkListEmbed } from '../utils/lotteryEmbeds';
import tLog, { LOG_ACTIONS } from '../utils/logUtils';

export const name = BtnFormat.BTN_MY_WORKS;

export async function onHandler(client: Client, interaction: ButtonInteraction) {
  await interaction.deferReply({ ephemeral: true });

  try {
    const works = await workService.getUserWorks(interaction.user.id);
    const embed = buildWorkListEmbed(works);
    await interaction.editReply({ embeds: [embed] });
  } catch (err: any) {
    tLog.logError(LOG_ACTIONS.LOTTERY, 'My works error:', err?.message || err);
    await interaction.editReply('❌ Failed to load works.');
  }
}
