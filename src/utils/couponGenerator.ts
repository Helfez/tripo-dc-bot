/**
 * 券码生成器
 * 格式: PREFIX-XXXX-XXXX  (大写字母+数字)
 * 例: JJM90-A3K7-M9P2
 */

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 去掉易混淆的 I/O/0/1

function randomBlock(len: number): string {
  let result = '';
  for (let i = 0; i < len; i++) {
    result += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return result;
}

export function generateCoupon(prefix: string): string {
  return `${prefix}-${randomBlock(4)}-${randomBlock(4)}`;
}
