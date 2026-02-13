import { User } from '@prisma/client';
import { getPrisma } from './prismaClient';
import { getLotteryConfig } from './lotteryConfig';

/** 获取今日日期字符串 (YYYY-MM-DD)，纽约时区 */
export function getTodayNY(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

/** 获取或创建用户 */
export async function getOrCreate(discordId: string, username?: string): Promise<User> {
  const prisma = getPrisma();
  let user = await prisma.user.findUnique({ where: { discordId } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        discordId,
        username: username || '',
        drawChances: 5, // 加入即送 5 次
      },
    });
  }
  return user;
}

/** 如果跨日了，重置每日计数 */
export async function resetDailyIfNeeded(user: User): Promise<User> {
  const prisma = getPrisma();
  const today = getTodayNY();
  if (user.lastDrawDate !== today) {
    return prisma.user.update({
      where: { id: user.id },
      data: { dailyDraws: 0, dailyEarned: 0, lastDrawDate: today },
    });
  }
  return user;
}

/** 增加抽奖次数（创作/购买） */
export async function addDrawChance(discordId: string, amount: number): Promise<User> {
  const prisma = getPrisma();
  let user = await getOrCreate(discordId);
  user = await resetDailyIfNeeded(user);

  const config = getLotteryConfig();
  const maxDaily = config.maxDailyDraws;
  // 每日获取上限检查
  const canEarn = Math.max(0, maxDaily - user.dailyEarned);
  const actual = Math.min(amount, canEarn);
  if (actual <= 0) return user;

  return prisma.user.update({
    where: { id: user.id },
    data: {
      drawChances: { increment: actual },
      dailyEarned: { increment: actual },
    },
  });
}

/** 扣减一次抽奖机会，返回更新后的用户 */
export async function consumeChance(user: User): Promise<User> {
  const prisma = getPrisma();
  return prisma.user.update({
    where: { id: user.id },
    data: {
      drawChances: { decrement: 1 },
      dailyDraws:  { increment: 1 },
      totalDraws:  { increment: 1 },
    },
  });
}

/** 标记用户已购买 */
export async function markPurchased(discordId: string): Promise<User> {
  const prisma = getPrisma();
  return prisma.user.update({
    where: { discordId },
    data: { hasPurchased: true },
  });
}

/** 获取用户信息（供展示） */
export async function getUserStats(discordId: string) {
  const prisma = getPrisma();
  const user = await getOrCreate(discordId);
  const prizeCount = await prisma.prize.count({ where: { userId: user.id } });
  const workCount = await prisma.work.count({ where: { userId: user.id } });
  return { user, prizeCount, workCount };
}
