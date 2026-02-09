import { Client } from 'discord.js';
import tRedis from '../redis';
import { endGiveaway } from '../utils/giveawayUtils';
import { GiveawayConstants } from '../utils/constants';
import tLog, {LOG_ACTIONS} from '../utils/logUtils';

export class GiveawayScheduler {
  private client: Client;
  private checkInterval: NodeJS.Timeout | null = null;

  constructor(client: Client) {
    this.client = client;
  }

  public start() {
    // Check for ended giveaways every 15 seconds
    this.checkInterval = setInterval(() => this.checkGiveaways(), 15000);
  }

  public stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  private async checkGiveaways() {
    try {
      const now = Date.now();
      const giveaways = await this.getActiveGiveaways();

      for (const giveaway of giveaways) {
        if (now >= giveaway.endTime) {
          await this.endGiveaway(giveaway.id, giveaway.channelId);
        }
      }
    } catch (error) {
      tLog.logError(LOG_ACTIONS.GIVEAWAY, 'Error checking giveaways:', error);
    }
  }

  private async getActiveGiveaways() {
    const giveaways = [];
    const keys = await tRedis.redisDB?.keys(`${GiveawayConstants.GIVEAWAY_PREFIX}*`);

    if (keys) {
      for (const key of keys) {
        if (!key.includes(GiveawayConstants.GIVEAWAY_POSTFIX)) {  // Skip entry sets
          const giveawayData = await tRedis.redisDB?.hgetall(key);
          if (giveawayData) {
            giveaways.push({
              id: key.split(':')[1],
              endTime: parseInt(giveawayData.endTime),
              channelId: giveawayData.channelId
            });
          }
        }
      }
    }

    return giveaways;
  }

  private async endGiveaway(giveawayId: string, channelId: string) {
    try {
      const channel = await this.client.channels.fetch(channelId);
      if (channel && channel.isTextBased()) {
        const message = await channel.messages.fetch(giveawayId);
        if (message) {
          await endGiveaway(message);
        }
      }
    } catch (error) {
      tLog.logError(LOG_ACTIONS.GIVEAWAY, `Error ending giveaway ${giveawayId}:`, error);
    }
  }
}
