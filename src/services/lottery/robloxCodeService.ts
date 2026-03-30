import { RobloxCode } from '@prisma/client';
import { getPrisma } from './prismaClient';

export type ClaimResult =
  | { status: 'ok'; code: string }
  | { status: 'daily_limit' }
  | { status: 'no_codes' };

/**
 * 原子领取一个未使用的 Roblox 兑换码，标记为已使用。
 * 每个用户每天只能领取一次。
 */
export async function claimCode(discordId: string): Promise<ClaimResult> {
  const prisma = getPrisma();
  return prisma.$transaction(async (tx) => {
    // 检查今日是否已领取
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const claimed = await tx.robloxCode.findFirst({
      where: { discordId, usedAt: { gte: todayStart } },
    });
    if (claimed) return { status: 'daily_limit' };

    const row = await tx.robloxCode.findFirst({
      where: { discordId: null },
      orderBy: { id: 'asc' },
    });
    if (!row) return { status: 'no_codes' };

    await tx.robloxCode.update({
      where: { id: row.id },
      data: { discordId, usedAt: new Date() },
    });
    return { status: 'ok', code: row.code };
  });
}

/** 批量导入码（跳过重复） */
export async function importCodes(codes: string[]): Promise<number> {
  const prisma = getPrisma();
  const result = await prisma.robloxCode.createMany({
    data: codes.map((code) => ({ code })),
    skipDuplicates: true,
  });
  return result.count;
}

/** 剩余可用码数量 */
export async function getAvailableCount(): Promise<number> {
  const prisma = getPrisma();
  return prisma.robloxCode.count({ where: { discordId: null } });
}

/** 已使用的码总数 */
export async function getUsedCount(): Promise<number> {
  const prisma = getPrisma();
  return prisma.robloxCode.count({ where: { discordId: { not: null } } });
}

/** 获取用户已领取的码 */
export async function getUserCodes(discordId: string): Promise<RobloxCode[]> {
  const prisma = getPrisma();
  return prisma.robloxCode.findMany({
    where: { discordId },
    orderBy: { usedAt: 'desc' },
  });
}
