import { ENVS } from '../urls';

// 奖品等级配置
export const PRIZE_TIERS = {
  first:       { name: '一等奖 - 2g黄金怪兽($400)',     prefix: 'JJMG1', total: 1,    dailyQuota: 0,  weight: 0 },
  second:      { name: '二等奖 - JuJuBit伴手礼盒($100)', prefix: 'JJMG2', total: 10,   dailyQuota: 1,  weight: 5 },
  third:       { name: '三等奖 - 4cm模型免单券($25)',     prefix: 'JJMG3', total: 100,  dailyQuota: 3,  weight: 15 },
  discount_90: { name: '九折优惠券',                      prefix: 'JJM90', total: -1,   dailyQuota: -1, weight: 40 },  // -1 = 无限
  discount_80: { name: '八折优惠券',                      prefix: 'JJM80', total: 1000, dailyQuota: 30, weight: 25 },
  discount_70: { name: '七折优惠券',                      prefix: 'JJM70', total: 500,  dailyQuota: 15, weight: 15 },
} as const;

export type PrizeTier = keyof typeof PRIZE_TIERS;

// 等级奖列表（互斥用）
export const TIER_PRIZES: PrizeTier[] = ['first', 'second', 'third'];

// 折扣券列表
export const DISCOUNT_PRIZES: PrizeTier[] = ['discount_90', 'discount_80', 'discount_70'];

// 纽约时区
export const NY_TIMEZONE = 'America/New_York';

/** 从 ENVS 读取运营参数 */
export function getLotteryConfig() {
  return {
    winProbability: ENVS.winProbability,
    maxDailyDraws: ENVS.maxDailyDraws,
    dailyPrizeCount: ENVS.dailyPrizeCount,
    webDomain: ENVS.webDomain,
    adminIds: ENVS.adminIds,
    channelLuckyDraw: ENVS.channelLuckyDraw,
    channelUserCenter: ENVS.channelUserCenter,
  };
}
