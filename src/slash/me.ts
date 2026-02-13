import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from 'discord.js';
import * as userService from '../services/lottery/userService';
import * as prizeService from '../services/lottery/prizeService';
import * as workService from '../services/lottery/workService';
import { buildPrizeListEmbed, buildWorkListEmbed, buildUserCenterButtons } from '../utils/lotteryEmbeds';
import { getLotteryConfig } from '../services/lottery/lotteryConfig';

export const data = new SlashCommandBuilder()
  .setName('me')
  .setDescription('View your personal dashboard')
  .addStringOption(opt =>
    opt.setName('view')
      .setDescription('What to view')
      .addChoices(
        { name: 'Overview', value: 'overview' },
        { name: 'My Prizes', value: 'prizes' },
        { name: 'My Works', value: 'works' },
      )
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const view = interaction.options.getString('view') || 'overview';
  const discordId = interaction.user.id;
  const config = getLotteryConfig();

  try {
    if (view === 'prizes') {
      const prizes = await prizeService.getUserPrizes(discordId);
      const embed = buildPrizeListEmbed(prizes);
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (view === 'works') {
      const works = await workService.getUserWorks(discordId);
      const embed = buildWorkListEmbed(works);
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // Overview
    const { user, prizeCount, workCount } = await userService.getUserStats(discordId);

    const embed = new EmbedBuilder()
      .setColor(0x3B82F6)
      .setTitle(`👤 ${interaction.user.displayName}'s Dashboard`)
      .addFields(
        { name: '🎰 Draw Chances', value: `${user.drawChances}`, inline: true },
        { name: '📊 Total Draws', value: `${user.totalDraws}`, inline: true },
        { name: '📅 Today Used', value: `${user.dailyDraws}/${config.maxDailyDraws}`, inline: true },
        { name: '🎁 Prizes Won', value: `${prizeCount}`, inline: true },
        { name: '🎨 Works Created', value: `${workCount}`, inline: true },
        { name: '🛒 Purchased', value: user.hasPurchased ? '✅ Yes' : '❌ No', inline: true },
      )
      .setFooter({ text: 'Use /me prizes or /me works for details' })
      .setTimestamp();

    const buttons = buildUserCenterButtons();
    await interaction.editReply({ embeds: [embed], components: [buttons] });
  } catch (err) {
    console.error('Me command error:', err);
    await interaction.editReply('❌ Failed to load your data. Please try again.');
  }
}
