import { getPrisma } from './prismaClient';
import { PRIZE_TIERS, PrizeTier } from './lotteryConfig';
import { getTodayNY } from './userService';

/** 确保今日奖池已创建，如果未创建则从昨日滚动 */
export async function ensureTodayPool(): Promise<void> {
  const prisma = getPrisma();
  const today = getTodayNY();

  // 检查今日是否已有奖池
  const existing = await prisma.dailyPrizePool.findFirst({ where: { prizeDate: today } });
  if (existing) return;

  // 获取昨日日期
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const yesterday = d.toISOString().split('T')[0];

  const tiers = Object.keys(PRIZE_TIERS) as PrizeTier[];

  for (const tier of tiers) {
    if (tier === 'first') continue; // 一等奖单独控制

    const cfg = PRIZE_TIERS[tier];
    const dailyQuota = cfg.dailyQuota === -1 ? 999 : cfg.dailyQuota;

    // 查昨日剩余量（滚动）
    const yesterdayPool = await prisma.dailyPrizePool.findUnique({
      where: { prizeDate_prizeTier: { prizeDate: yesterday, prizeTier: tier } },
    });
    const rollover = yesterdayPool ? yesterdayPool.remaining : 0;

    // 检查全局总量限制
    let actualQuota = dailyQuota;
    if (cfg.total > 0) {
      const totalWon = await prisma.prize.count({ where: { prizeTier: tier } });
      const globalRemaining = cfg.total - totalWon;
      actualQuota = Math.min(dailyQuota + rollover, Math.max(0, globalRemaining));
    } else {
      actualQuota = dailyQuota + rollover;
    }

    await prisma.dailyPrizePool.create({
      data: {
        prizeDate: today,
        prizeTier: tier,
        totalCount: actualQuota,
        remaining: actualQuota,
      },
    });
  }
}

/** 获取今日某等级奖品的剩余量 */
export async function getRemaining(tier: PrizeTier): Promise<number> {
  const prisma = getPrisma();
  const today = getTodayNY();
  const pool = await prisma.dailyPrizePool.findUnique({
    where: { prizeDate_prizeTier: { prizeDate: today, prizeTier: tier } },
  });
  return pool ? pool.remaining : 0;
}

/** 扣减今日奖池 1 份 */
export async function deductPool(tier: PrizeTier): Promise<boolean> {
  const prisma = getPrisma();
  const today = getTodayNY();
  const pool = await prisma.dailyPrizePool.findUnique({
    where: { prizeDate_prizeTier: { prizeDate: today, prizeTier: tier } },
  });
  if (!pool || pool.remaining <= 0) return false;

  await prisma.dailyPrizePool.update({
    where: { id: pool.id },
    data: {
      remaining: { decrement: 1 },
      wonCount:  { increment: 1 },
    },
  });
  return true;
}

/** 获取今日奖池全览 */
export async function getTodayPoolStatus() {
  const prisma = getPrisma();
  const today = getTodayNY();
  return prisma.dailyPrizePool.findMany({ where: { prizeDate: today } });
}
