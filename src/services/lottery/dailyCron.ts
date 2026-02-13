import cron from 'node-cron';
import { getPrisma } from './prismaClient';
import * as poolService from './poolService';
import tLog, { LOG_ACTIONS } from '../../utils/logUtils';

/**
 * 每日重置定时任务
 * 纽约时间 00:00 执行：
 *   1. 重置所有用户每日计数
 *   2. 创建新一日奖池（含滚动）
 */
export function startDailyCron() {
  // 每天 UTC 05:00 = 纽约 00:00 (EST)
  cron.schedule('0 5 * * *', async () => {
    tLog.log(LOG_ACTIONS.LOTTERY, `Daily reset triggered at ${new Date().toISOString()}`);

    try {
      const prisma = getPrisma();

      // 1. 重置每日计数（不清零 drawChances，只清日使用量）
      await prisma.user.updateMany({
        data: {
          dailyDraws: 0,
          dailyEarned: 0,
        },
      });
      tLog.log(LOG_ACTIONS.LOTTERY, 'User daily counters reset');

      // 2. 创建新一日奖池
      await poolService.ensureTodayPool();
      tLog.log(LOG_ACTIONS.LOTTERY, 'Today\'s prize pool created');
    } catch (err: any) {
      tLog.logError(LOG_ACTIONS.LOTTERY, 'Daily reset failed:', err?.message || err);
    }
  }, {
    timezone: 'America/New_York',
  });

  tLog.log(LOG_ACTIONS.LOTTERY, 'Daily reset job scheduled (00:00 NY time)');
}
