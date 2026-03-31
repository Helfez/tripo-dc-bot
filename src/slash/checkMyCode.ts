import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import * as robloxCodeService from '../services/lottery/robloxCodeService';

export const data = new SlashCommandBuilder()
  .setName('check-my-code')
  .setDescription('Check redemption code');

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const discordId = interaction.user.id;

  try {
    const codes = await robloxCodeService.getUserCodes(discordId);

    if (codes.length === 0) {
      await interaction.editReply("You currently don't have a redemption code. You can get one after using Jujubot.");
      return;
    }

    const latest = codes[0];

    await interaction.editReply(`Your redemption code: ${latest.code}`);
  } catch (err) {
    console.error('my-roblox-code command error:', err);
    await interaction.editReply('❌ Failed to retrieve your code. Please try again.');
  }
}
