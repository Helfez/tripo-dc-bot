import { Client, TextChannel } from 'discord.js';
import { getLotteryConfig } from './lotteryConfig';
import { buildDrawEmbed, buildDrawButton, buildUserCenterEmbed, buildUserCenterButtons } from '../../utils/lotteryEmbeds';
import tLog, { LOG_ACTIONS } from '../../utils/logUtils';

/** 在 #lucky-draw 和 #user-center 频道发送常驻消息（仅首次或频道为空时） */
export async function setupChannelMessages(client: Client) {
  const config = getLotteryConfig();

  if (config.channelLuckyDraw) {
    try {
      const channel = await client.channels.fetch(config.channelLuckyDraw) as TextChannel;
      if (channel) {
        const messages = await channel.messages.fetch({ limit: 5 });
        const hasDrawMsg = messages.some(m =>
          m.author.id === client.user?.id && m.embeds.length > 0
        );
        if (!hasDrawMsg) {
          await channel.send({
            embeds: [buildDrawEmbed()],
            components: [buildDrawButton()],
          });
          tLog.log(LOG_ACTIONS.LOTTERY, 'Draw channel message sent');
        }
      }
    } catch (err: any) {
      tLog.logError(LOG_ACTIONS.LOTTERY, 'Setup draw channel error:', err?.message || err);
    }
  }

  if (config.channelUserCenter) {
    try {
      const channel = await client.channels.fetch(config.channelUserCenter) as TextChannel;
      if (channel) {
        const messages = await channel.messages.fetch({ limit: 5 });
        const hasCenterMsg = messages.some(m =>
          m.author.id === client.user?.id && m.embeds.length > 0
        );
        if (!hasCenterMsg) {
          await channel.send({
            embeds: [buildUserCenterEmbed()],
            components: [buildUserCenterButtons()],
          });
          tLog.log(LOG_ACTIONS.LOTTERY, 'User center message sent');
        }
      }
    } catch (err: any) {
      tLog.logError(LOG_ACTIONS.LOTTERY, 'Setup user center error:', err?.message || err);
    }
  }
}
