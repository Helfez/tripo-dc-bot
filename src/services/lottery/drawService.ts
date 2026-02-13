import { getPrisma } from './prismaClient';
import { PRIZE_TIERS, PrizeTier, TIER_PRIZES, DISCOUNT_PRIZES, getLotteryConfig } from './lotteryConfig';
import * as userService from './userService';
import * as prizeService from './prizeService';
import * as poolService from './poolService';

export type DrawResult =
  | { type: 'NO_CHANCE' }
  | { type: 'DAILY_LIMIT' }
  | { type: 'NO_WIN' }
  | { type: 'WIN'; prize: { id: number; tier: PrizeTier; name: string; couponCode: string } };

/** 核心抽奖逻辑 */
export async function executeDraw(discordId: string, username?: string): Promise<DrawResult> {
  const prisma = getPrisma();
  const config = getLotteryConfig();

  // 1. 获取/创建用户
  let user = await userService.getOrCreate(discordId, username);
  user = await userService.resetDailyIfNeeded(user);

  // 2. 前置校验
  if (user.drawChances <= 0) return { type: 'NO_CHANCE' };
  if (user.dailyDraws >= config.maxDailyDraws) return { type: 'DAILY_LIMIT' };

  // 3. 扣减次数（先扣后抽，保证原子性）
  user = await userService.consumeChance(user);

  // 4. 确保今日奖池存在
  await poolService.ensureTodayPool();

  // 5. 首抽必中九折券
  if (user.totalDraws === 1) { // consumeChance 已经 +1 了，所以第一次抽时 totalDraws=1
    const prize = await prizeService.awardPrize(user.id, discordId, 'discount_90');
    return {
      type: 'WIN',
      prize: { id: prize.id, tier: 'discount_90', name: prize.prizeName, couponCode: prize.couponCode },
    };
  }

  // 6. 概率判定 (默认 1%)
  const prob = await getWinProbability();
  if (Math.random() >= prob) {
    return { type: 'NO_WIN' };
  }

  // 7. 检查每人每日中奖上限
  const today = userService.getTodayNY();
  const maxUserDailyWins = await getConfigInt('max_user_daily_wins', 5);
  const userDailyWins = await prizeService.getUserDailyWins(user.id, today);
  if (userDailyWins >= maxUserDailyWins) {
    return { type: 'NO_WIN' };
  }

  // 8. 决定奖品等级
  const tier = await selectPrizeTier(user.id, user.hasPurchased);
  if (!tier) return { type: 'NO_WIN' };

  // 9. 扣减奖池
  const deducted = await poolService.deductPool(tier);
  if (!deducted) return { type: 'NO_WIN' };

  // 10. 发放奖品
  const prize = await prizeService.awardPrize(user.id, discordId, tier);
  return {
    type: 'WIN',
    prize: { id: prize.id, tier, name: prize.prizeName, couponCode: prize.couponCode },
  };
}

/** 根据权重和库存选取奖品等级 */
async function selectPrizeTier(userId: number, hasPurchased: boolean): Promise<PrizeTier | null> {
  // 获取用户已中过的等级奖
  const wonTiers = await prizeService.getWonTiers(userId);

  // 构建候选列表
  const candidates: { tier: PrizeTier; weight: number }[] = [];

  // 如果已购买，可以参与等级奖
  if (hasPurchased) {
    // 一等奖特殊判断
    const firstEnabled = await getConfigBool('first_prize_enabled', false);
    if (firstEnabled && !wonTiers.includes('first')) {
      const remaining = await poolService.getRemaining('first');
      if (remaining > 0) {
        candidates.push({ tier: 'first', weight: PRIZE_TIERS.first.weight || 1 });
      }
    }

    // 二等奖、三等奖（互斥：已中过就不再参与）
    for (const tier of TIER_PRIZES) {
      if (tier === 'first') continue;
      if (wonTiers.includes(tier)) continue;
      const remaining = await poolService.getRemaining(tier);
      if (remaining > 0) {
        candidates.push({ tier, weight: PRIZE_TIERS[tier].weight });
      }
    }
  }

  // 折扣券（无需购买条件）
  for (const tier of DISCOUNT_PRIZES) {
    const remaining = await poolService.getRemaining(tier);
    if (remaining > 0) {
      candidates.push({ tier, weight: PRIZE_TIERS[tier].weight });
    }
  }

  if (candidates.length === 0) return null;

  // 加权随机
  const totalWeight = candidates.reduce((sum, c) => sum + c.weight, 0);
  let rand = Math.random() * totalWeight;
  for (const c of candidates) {
    rand -= c.weight;
    if (rand <= 0) return c.tier;
  }

  return candidates[candidates.length - 1].tier;
}

/** 从 config 表读取中奖概率 */
async function getWinProbability(): Promise<number> {
  const prisma = getPrisma();
  const config = getLotteryConfig();
  const row = await prisma.config.findUnique({ where: { key: 'win_probability' } });
  return row ? parseFloat(row.value) : config.winProbability;
}

/** 从 config 表读取整数配置 */
async function getConfigInt(key: string, fallback: number): Promise<number> {
  const prisma = getPrisma();
  const row = await prisma.config.findUnique({ where: { key } });
  return row ? parseInt(row.value, 10) : fallback;
}

/** 从 config 表读取布尔配置 */
async function getConfigBool(key: string, fallback: boolean): Promise<boolean> {
  const prisma = getPrisma();
  const row = await prisma.config.findUnique({ where: { key } });
  return row ? row.value === 'true' : fallback;
}
