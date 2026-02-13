import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { Work, Prize } from '@prisma/client';
import { PrizeTier, PRIZE_TIERS } from '../services/lottery/lotteryConfig';

// ============ 作品卡片 ============

export function buildWorkEmbed(work: Work, username: string): EmbedBuilder {
  const modeLabel = work.mode === 'jujumon' ? 'JuJuMon' : 'JuJu Trainers';
  return new EmbedBuilder()
    .setColor(0x7C3AED)
    .setTitle(`${modeLabel} Creation`)
    .setDescription(work.prompt || '(No prompt)')
    .setImage(work.imageUrl || null)
    .addFields(
      { name: 'Creator', value: username, inline: true },
      { name: 'Mode', value: modeLabel, inline: true },
    )
    .setFooter({ text: `Work ID: ${work.workUid}` })
    .setTimestamp();
}

export function buildWorkButtons(workUid: string, shareUrl: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setLabel('View Details')
      .setStyle(ButtonStyle.Link)
      .setURL(shareUrl)
      .setEmoji('🔗'),
    new ButtonBuilder()
      .setCustomId(`copy_link_${workUid}`)
      .setLabel('Copy Link')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('📋'),
    new ButtonBuilder()
      .setCustomId(`share_${workUid}`)
      .setLabel('Share')
      .setStyle(ButtonStyle.Success)
      .setEmoji('📢'),
  );
}

// ============ 抽奖频道常驻消息 ============

export function buildDrawEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0xF59E0B)
    .setTitle('🎰 JuJuMon Lucky Draw')
    .setDescription(
      '**Welcome to the JuJuMon Lucky Draw!**\n\n' +
      '🎨 Use `/jujumon` to create monsters and earn draw chances\n' +
      '🛒 Each purchase earns you 10 extra chances\n' +
      '🎁 Prizes include Gold Monster, Gift Boxes, Coupons & more!\n\n' +
      '👇 Click the button below to try your luck!'
    )
    .addFields(
      { name: '🏆 Grand Prize', value: '2g Gold Monster ($400)', inline: true },
      { name: '🥈 2nd Prize', value: 'Gift Box ($100)', inline: true },
      { name: '🥉 3rd Prize', value: 'Model Coupon ($25)', inline: true },
    )
    .setFooter({ text: 'Each draw costs 1 chance. Win probability: 1%' });
}

export function buildDrawButton(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('lucky_draw')
      .setLabel('🎰 Draw Now!')
      .setStyle(ButtonStyle.Primary),
  );
}

// ============ 中奖消息 ============

export function buildWinEmbed(prizeName: string, couponCode: string, tier: string): EmbedBuilder {
  const isGrand = tier === 'first' || tier === 'second' || tier === 'third';
  const color = isGrand ? 0xEF4444 : 0x10B981;

  return new EmbedBuilder()
    .setColor(color)
    .setTitle('🎉 Congratulations! You Won!')
    .setDescription(
      `You won: **${prizeName}**\n\n` +
      `Coupon Code: \`${couponCode}\`\n\n` +
      '💡 **Important:** If you close this message, you can always retrieve your code via `/me` or the **My Prizes** button in #user-center.'
    )
    .setFooter({ text: 'This message is only visible to you' })
    .setTimestamp();
}

export function buildWinButtons(prizeId: number): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`copy_code_${prizeId}`)
      .setLabel('✂️ Copy Code')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('my_prizes')
      .setLabel('📦 My Prizes')
      .setStyle(ButtonStyle.Secondary),
  );
}

// ============ 未中奖消息 ============

export function buildNoWinEmbed(remainingChances: number): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0x6B7280)
    .setTitle('😅 Better luck next time!')
    .setDescription(
      `No prize this time. Keep trying!\n\n` +
      `Remaining chances: **${remainingChances}**\n\n` +
      '💡 Use `/jujumon` to create more monsters or make a purchase to earn more chances!'
    )
    .setFooter({ text: 'This message is only visible to you' });
}

// ============ 个人中心 ============

export function buildUserCenterEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0x3B82F6)
    .setTitle('👤 JuJuMon User Center')
    .setDescription(
      'Welcome to your personal dashboard!\n\n' +
      'Here you can view your creation history and retrieve lost prize codes.\n\n' +
      '👇 Click a button below or use `/me`'
    );
}

export function buildUserCenterButtons(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('my_prizes')
      .setLabel('📦 My Prizes')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('my_works')
      .setLabel('🎨 My Works')
      .setStyle(ButtonStyle.Secondary),
  );
}

// ============ 奖品列表 ============

export function buildPrizeListEmbed(prizes: Prize[]): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(0x8B5CF6)
    .setTitle('📦 Your Prize History')
    .setTimestamp();

  if (prizes.length === 0) {
    embed.setDescription('You have no prizes yet. Go draw some!');
    return embed;
  }

  const lines = prizes.map((p, i) => {
    const date = p.createdAt.toISOString().split('T')[0];
    const used = p.isUsed ? ' ✅Used' : '';
    return `**${i + 1}.** [${date}] ${p.prizeName}: \`${p.couponCode}\`${used}`;
  });

  embed.setDescription(lines.join('\n'));
  embed.setFooter({ text: `Total: ${prizes.length} prizes. Codes are permanently saved.` });
  return embed;
}

// ============ 作品列表 ============

export function buildWorkListEmbed(works: Work[]): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(0x7C3AED)
    .setTitle('🎨 Your Works')
    .setTimestamp();

  if (works.length === 0) {
    embed.setDescription('You have no works yet. Use `/jujumon` to get started!');
    return embed;
  }

  const lines = works.map((w, i) => {
    const date = w.createdAt.toISOString().split('T')[0];
    const mode = w.mode === 'jujumon' ? 'JuJuMon' : 'Trainer';
    return `**${i + 1}.** [${date}] ${mode} — ${w.prompt?.substring(0, 40) || '(no prompt)'}`;
  });

  embed.setDescription(lines.join('\n'));
  embed.setFooter({ text: `Showing latest ${works.length} works` });
  return embed;
}
