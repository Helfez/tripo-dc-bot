import { ButtonInteraction, Client } from 'discord.js';
import { BtnFormat } from '../utils/constants';
import * as prizeService from '../services/lottery/prizeService';
import tLog, { LOG_ACTIONS } from '../utils/logUtils';

export const name = BtnFormat.BTN_COPY_CODE_PREFIX;

export async function onHandler(client: Client, interaction: ButtonInteraction) {
  const prizeIdStr = interaction.customId.replace('copy_code_', '');
  const prizeId = parseInt(prizeIdStr, 10);

  if (isNaN(prizeId)) {
    await interaction.reply({ content: '❌ Invalid prize ID.', ephemeral: true });
    return;
  }

  try {
    // 标记已复制
    await prizeService.markCopied(prizeId);

    // 从数据库重新拉取（获取 couponCode）
    const prizes = await prizeService.getUserPrizes(interaction.user.id);
    const prize = prizes.find(p => p.id === prizeId);

    if (!prize) {
      await interaction.reply({ content: '❌ Prize not found.', ephemeral: true });
      return;
    }

    // 单独发一条纯文本消息，方便手机用户长按复制
    await interaction.reply({
      content: `✂️ Your coupon code:\n\n\`\`\`\n${prize.couponCode}\n\`\`\`\n\n💡 Long press or select the code above to copy.`,
      ephemeral: true,
    });
  } catch (err: any) {
    tLog.logError(LOG_ACTIONS.LOTTERY, 'Copy code error:', err?.message || err);
    await interaction.reply({ content: '❌ Failed to retrieve code.', ephemeral: true });
  }
}
