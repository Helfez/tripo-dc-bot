import { PrismaClient } from '@prisma/client';
import tLog, { LOG_ACTIONS } from '../../utils/logUtils';
import * as poolService from './poolService';

let prisma: PrismaClient;

export function getPrisma(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient();
  }
  return prisma;
}

/** 初始化抽奖系统：连接数据库 + 确保今日奖池 */
export async function initLottery(): Promise<void> {
  try {
    const db = getPrisma();
    await db.$connect();
    tLog.log(LOG_ACTIONS.LOTTERY, 'Lottery database connected');

    await poolService.ensureTodayPool();
    tLog.log(LOG_ACTIONS.LOTTERY, 'Prize pool initialized');
  } catch (err: any) {
    tLog.logError(LOG_ACTIONS.LOTTERY, 'Failed to init lottery:', err?.message || err);
  }
}
