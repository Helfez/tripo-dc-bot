import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
} from 'discord.js';
import { getPrisma } from '../services/lottery/prismaClient';
import { PRIZE_TIERS, PrizeTier, getLotteryConfig } from '../services/lottery/lotteryConfig';
import * as userService from '../services/lottery/userService';
import * as prizeService from '../services/lottery/prizeService';
import * as poolService from '../services/lottery/poolService';

export const data = new SlashCommandBuilder()
  .setName('admin')
  .setDescription('Admin commands')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand(sub =>
    sub.setName('stats').setDescription('View today\'s draw statistics')
  )
  .addSubcommand(sub =>
    sub.setName('pool').setDescription('View today\'s prize pool')
  )
  .addSubcommand(sub =>
    sub.setName('toggle-first-prize').setDescription('Toggle first prize on/off')
  )
  .addSubcommand(sub =>
    sub.setName('add-chances')
      .setDescription('Add draw chances to a user')
      .addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(true))
      .addIntegerOption(opt => opt.setName('amount').setDescription('Number of chances').setRequired(true))
  )
  .addSubcommand(sub =>
    sub.setName('confirm-purchase')
      .setDescription('Confirm user purchase')
      .addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(true))
  )
  .addSubcommand(sub =>
    sub.setName('set-config')
      .setDescription('Update config value')
      .addStringOption(opt => opt.setName('key').setDescription('Config key').setRequired(true))
      .addStringOption(opt => opt.setName('value').setDescription('Config value').setRequired(true))
  )
  .addSubcommand(sub =>
    sub.setName('export-prizes').setDescription('Export all prize records')
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const config = getLotteryConfig();
  // 权限检查
  if (!config.adminIds.includes(interaction.user.id)) {
    await interaction.reply({ content: '⛔ You are not authorized.', ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });
  const sub = interaction.options.getSubcommand();

  try {
    switch (sub) {
      case 'stats': return await handleStats(interaction);
      case 'pool': return await handlePool(interaction);
      case 'toggle-first-prize': return await handleToggleFirst(interaction);
      case 'add-chances': return await handleAddChances(interaction);
      case 'confirm-purchase': return await handleConfirmPurchase(interaction);
      case 'set-config': return await handleSetConfig(interaction);
      case 'export-prizes': return await handleExportPrizes(interaction);
    }
  } catch (err) {
    console.error('Admin command error:', err);
    await interaction.editReply('❌ Command failed.');
  }
}

async function handleStats(interaction: ChatInputCommandInteraction) {
  const prisma = getPrisma();
  const totalUsers = await prisma.user.count();
  const totalDraws = await prisma.user.aggregate({ _sum: { totalDraws: true } });
  const { total, byTier } = await prizeService.getGlobalStats();

  const tierLines = byTier.map(t => `  ${t.prizeTier}: ${t._count.id}`).join('\n');

  const embed = new EmbedBuilder()
    .setColor(0xF59E0B)
    .setTitle('📊 Activity Statistics')
    .addFields(
      { name: 'Total Users', value: `${totalUsers}`, inline: true },
      { name: 'Total Draws', value: `${totalDraws._sum.totalDraws || 0}`, inline: true },
      { name: 'Total Prizes', value: `${total}`, inline: true },
    )
    .setDescription(`**Prizes by tier:**\n${tierLines || 'None yet'}`)
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

async function handlePool(interaction: ChatInputCommandInteraction) {
  await poolService.ensureTodayPool();
  const pools = await poolService.getTodayPoolStatus();

  const lines = pools.map(p => {
    const cfg = PRIZE_TIERS[p.prizeTier as PrizeTier];
    const name = cfg ? cfg.name : p.prizeTier;
    return `**${name}**: ${p.remaining}/${p.totalCount} remaining (won: ${p.wonCount})`;
  });

  const embed = new EmbedBuilder()
    .setColor(0x10B981)
    .setTitle('🎰 Today\'s Prize Pool')
    .setDescription(lines.join('\n') || 'No pool data')
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

async function handleToggleFirst(interaction: ChatInputCommandInteraction) {
  const prisma = getPrisma();
  const current = await prisma.config.findUnique({ where: { key: 'first_prize_enabled' } });
  const newValue = current?.value === 'true' ? 'false' : 'true';

  await prisma.config.upsert({
    where: { key: 'first_prize_enabled' },
    update: { value: newValue },
    create: { key: 'first_prize_enabled', value: newValue },
  });

  // 如果开启一等奖，确保今日奖池有一等奖
  if (newValue === 'true') {
    const today = userService.getTodayNY();
    await prisma.dailyPrizePool.upsert({
      where: { prizeDate_prizeTier: { prizeDate: today, prizeTier: 'first' } },
      update: { remaining: 1, totalCount: 1 },
      create: { prizeDate: today, prizeTier: 'first', totalCount: 1, remaining: 1 },
    });
  }

  await interaction.editReply(`🏆 First prize is now **${newValue === 'true' ? 'ENABLED' : 'DISABLED'}**`);
}

async function handleAddChances(interaction: ChatInputCommandInteraction) {
  const prisma = getPrisma();
  const target = interaction.options.getUser('user', true);
  const amount = interaction.options.getInteger('amount', true);

  const user = await userService.getOrCreate(target.id, target.displayName);
  await prisma.user.update({
    where: { id: user.id },
    data: { drawChances: { increment: amount } },
  });

  await interaction.editReply(`✅ Added **${amount}** chances to ${target.displayName}. New total: ${user.drawChances + amount}`);
}

async function handleConfirmPurchase(interaction: ChatInputCommandInteraction) {
  const target = interaction.options.getUser('user', true);
  await userService.getOrCreate(target.id, target.displayName);
  await userService.markPurchased(target.id);

  // 购买 +10 次抽奖
  await userService.addDrawChance(target.id, 10);

  await interaction.editReply(`✅ Confirmed purchase for ${target.displayName}. +10 draw chances awarded.`);
}

async function handleSetConfig(interaction: ChatInputCommandInteraction) {
  const prisma = getPrisma();
  const key = interaction.options.getString('key', true);
  const value = interaction.options.getString('value', true);

  await prisma.config.upsert({
    where: { key },
    update: { value, updatedAt: new Date() },
    create: { key, value },
  });

  await interaction.editReply(`✅ Config \`${key}\` set to \`${value}\``);
}

async function handleExportPrizes(interaction: ChatInputCommandInteraction) {
  const prisma = getPrisma();
  const prizes = await prisma.prize.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  if (prizes.length === 0) {
    await interaction.editReply('No prizes recorded yet.');
    return;
  }

  const csv = prizes.map(p =>
    `${p.createdAt.toISOString().split('T')[0]} | ${p.discordId} | ${p.prizeTier} | ${p.couponCode} | used:${p.isUsed}`
  ).join('\n');

  const header = 'Date | Discord ID | Tier | Code | Used';
  await interaction.editReply(`\`\`\`\n${header}\n${'─'.repeat(60)}\n${csv}\n\`\`\``);
}
