import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import * as robloxCodeService from '../services/lottery/robloxCodeService';
import tLog, { LOG_ACTIONS } from './logUtils';

/**
 * 创作成功后，领取一个 Roblox 兑换码并以仅用户可见的消息发送。
 * 不影响主创作流程：出错时仅记录日志。
 */
export async function sendRobloxCode(interaction: ChatInputCommandInteraction): Promise<void> {
  try {
    const result = await robloxCodeService.claimCode(interaction.user.id);

    if (result.status === 'no_codes' || result.status === 'daily_limit') {
      await interaction.followUp({
        content: 'All 3000 redemption codes are gone! Look forward to our next event~',
        ephemeral: true,
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0x00B06B)
      .setTitle('🎮 Roblox Reward Code')
      .setDescription(
        `Thanks for creating! Here is your Roblox redemption code:\n\n` +
        `\`${result.code}\`\n\n` +
        `💡 Redeem this code in Roblox.`,
      )
      .setFooter({ text: 'This message is only visible to you' })
      .setTimestamp();

    await interaction.followUp({ embeds: [embed], ephemeral: true });
  } catch (err: any) {
    tLog.logError(LOG_ACTIONS.LOTTERY, 'Failed to send Roblox code:', err?.message || err);
  }
}
