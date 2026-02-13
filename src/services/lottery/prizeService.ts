import { Prize } from '@prisma/client';
import { getPrisma } from './prismaClient';
import { PrizeTier, PRIZE_TIERS } from './lotteryConfig';
import { generateCoupon } from '../../utils/couponGenerator';

/** 发放奖品，生成券码并入库 */
export async function awardPrize(userId: number, discordId: string, tier: PrizeTier): Promise<Prize> {
  const prisma = getPrisma();
  const cfg = PRIZE_TIERS[tier];
  const couponCode = generateCoupon(cfg.prefix);

  // 券有效期：发放后 1 个月
  const expiresAt = new Date();
  expiresAt.setMonth(expiresAt.getMonth() + 1);

  return prisma.prize.create({
    data: {
      userId,
      discordId,
      prizeTier: tier,
      prizeName: cfg.name,
      couponCode,
      expiresAt,
    },
  });
}

/** 查用户是否已中过某等级奖（互斥判断） */
export async function hasWonTier(userId: number, tier: PrizeTier): Promise<boolean> {
  const prisma = getPrisma();
  const count = await prisma.prize.count({
    where: { userId, prizeTier: tier },
  });
  return count > 0;
}

/** 查用户已中过的所有等级奖 */
export async function getWonTiers(userId: number): Promise<string[]> {
  const prisma = getPrisma();
  const prizes = await prisma.prize.findMany({
    where: { userId },
    select: { prizeTier: true },
    distinct: ['prizeTier'],
  });
  return prizes.map(p => p.prizeTier);
}

/** 查用户今日中奖次数 */
export async function getUserDailyWins(userId: number, today: string): Promise<number> {
  const prisma = getPrisma();
  const startOfDay = new Date(today + 'T00:00:00Z');
  const endOfDay = new Date(today + 'T23:59:59Z');
  return prisma.prize.count({
    where: {
      userId,
      createdAt: { gte: startOfDay, lte: endOfDay },
    },
  });
}

/** 获取用户所有奖品 */
export async function getUserPrizes(discordId: string): Promise<Prize[]> {
  const prisma = getPrisma();
  return prisma.prize.findMany({
    where: { discordId },
    orderBy: { createdAt: 'desc' },
  });
}

/** 标记券码已复制 */
export async function markCopied(prizeId: number): Promise<void> {
  const prisma = getPrisma();
  await prisma.prize.update({
    where: { id: prizeId },
    data: { isCopied: true },
  });
}

/** 获取全局中奖统计 */
export async function getGlobalStats() {
  const prisma = getPrisma();
  const total = await prisma.prize.count();
  const byTier = await prisma.prize.groupBy({
    by: ['prizeTier'],
    _count: { id: true },
  });
  return { total, byTier };
}
