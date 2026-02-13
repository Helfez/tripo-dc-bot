/**
 * 种子脚本：初始化配置 + 第一天奖池
 * 运行: npx ts-node scripts/seed.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- 开始初始化数据 ---');

  // 1. 初始化 config 表
  const configs = [
    { key: 'first_prize_enabled', value: 'false' },
    { key: 'daily_prize_count',   value: '34' },
    { key: 'max_daily_draws',     value: '50' },
    { key: 'win_probability',     value: '0.01' },
    { key: 'activity_start',     value: '2026-02-23' },
    { key: 'activity_end',       value: '2026-03-27' },
    { key: 'max_daily_wins',     value: '34' },         // 每天总中奖上限
    { key: 'max_user_daily_wins', value: '5' },          // 每人每天中奖上限
  ];

  for (const c of configs) {
    await prisma.config.upsert({
      where: { key: c.key },
      update: { value: c.value },
      create: c,
    });
  }
  console.log(`  ✓ config 表已初始化 (${configs.length} 项)`);

  // 2. 初始化今日奖池
  const today = new Date().toISOString().split('T')[0];
  const poolEntries = [
    { prizeDate: today, prizeTier: 'second',      totalCount: 1,  remaining: 1 },
    { prizeDate: today, prizeTier: 'third',        totalCount: 3,  remaining: 3 },
    { prizeDate: today, prizeTier: 'discount_90',  totalCount: 999, remaining: 999 },  // 无限用大数
    { prizeDate: today, prizeTier: 'discount_80',  totalCount: 30, remaining: 30 },
    { prizeDate: today, prizeTier: 'discount_70',  totalCount: 15, remaining: 15 },
  ];

  for (const p of poolEntries) {
    await prisma.dailyPrizePool.upsert({
      where: { prizeDate_prizeTier: { prizeDate: p.prizeDate, prizeTier: p.prizeTier } },
      update: { totalCount: p.totalCount, remaining: p.remaining },
      create: p,
    });
  }
  console.log(`  ✓ 今日奖池已初始化 (${today}, ${poolEntries.length} 类奖品)`);

  console.log('--- 初始化完成 ---');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
