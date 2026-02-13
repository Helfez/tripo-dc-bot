import { Work } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { getPrisma } from './prismaClient';
import { getLotteryConfig } from './lotteryConfig';
import * as userService from './userService';

/** 创建作品记录（不含 AI 调用，主 bot pipeline 负责生图） */
export async function createWork(
  discordId: string,
  mode: string,
  prompt: string,
  imageUrl: string,
): Promise<Work> {
  const prisma = getPrisma();
  const config = getLotteryConfig();
  const user = await userService.getOrCreate(discordId);
  const workUid = uuidv4().replace(/-/g, '').substring(0, 12);
  const shareUrl = config.webDomain
    ? `${config.webDomain}/work/${workUid}?ref=${discordId}`
    : '';

  const work = await prisma.work.create({
    data: {
      workUid,
      userId: user.id,
      discordId,
      mode,
      prompt,
      imageUrl,
      shareUrl,
    },
  });

  // 创作完成自动 +1 抽奖次数
  await userService.addDrawChance(discordId, 1);

  return work;
}

/** 获取用户作品列表 */
export async function getUserWorks(discordId: string): Promise<Work[]> {
  const prisma = getPrisma();
  return prisma.work.findMany({
    where: { discordId },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
}

/** 增加作品浏览量 */
export async function incrementViewCount(workUid: string): Promise<void> {
  const prisma = getPrisma();
  await prisma.work.update({
    where: { workUid },
    data: { viewCount: { increment: 1 } },
  });
}
