import { Message, EmbedBuilder, TextChannel, User, ColorResolvable, Embed } from 'discord.js';
import tRedis from '../redis';
import { GiveawayConstants } from './constants';
import TMessages from './messages';
import tLog, {LOG_ACTIONS} from "./logUtils";

export async function updateGiveawayMessage(message: Message, entriesCount: number = 0, giveawayEmbed?: GiveawayEmbed) {
  try {
    const giveawayId = message.id;
    const giveawayData = await tRedis.redisDB?.hgetall(`${GiveawayConstants.GIVEAWAY_PREFIX}${giveawayId}`);

    if (!giveawayData) {
      tLog.logError(LOG_ACTIONS.GIVEAWAY, 'Giveaway data not found');
      return;
    }

    const endTime = new Date(parseInt(giveawayData.endTime));
    const winners = parseInt(giveawayData.winners);
    const hostId = giveawayData.hostId;

    const embed = giveawayEmbed ? giveawayEmbed : new GiveawayEmbed({
      prize: giveawayData.prizeMessage,
      endTime: endTime,
      host: hostId,
      entries: entriesCount,
      winners: winners,
      isEnded: false
    })

    if (giveawayEmbed) {
      embed.setEntries(entriesCount);
    }

    await message.edit({ embeds: [embed.getEmbed()] });
  } catch (error) {
    tLog.logError(LOG_ACTIONS.GIVEAWAY, 'Error updating giveaway message:', error);
  }
}

export async function endGiveaway(message: Message, giveawayEmbed?: GiveawayEmbed) {
  try {
    const giveawayId = message.id;
    const giveawayData = await tRedis.redisDB?.hgetall(`${GiveawayConstants.GIVEAWAY_PREFIX}${giveawayId}`);

    if (!giveawayData) {
      tLog.logError(LOG_ACTIONS.GIVEAWAY, 'Giveaway data not found');
      return;
    }

    const winners = parseInt(giveawayData.winners);
    const prizeMessage = giveawayData.prizeMessage;
    const endTime = new Date(parseInt(giveawayData.endTime));
    const hostId = giveawayData.hostId;

    // Get all entries
    const entries = await tRedis.redisDB?.smembers(`${GiveawayConstants.GIVEAWAY_PREFIX}${giveawayId}${GiveawayConstants.GIVEAWAY_POSTFIX}`);

    const embed = giveawayEmbed ? giveawayEmbed : new GiveawayEmbed({
      prize: prizeMessage,
      endTime: endTime,
      host: hostId,
      entries: entries?.length || 0,
      winners: winners,
      isEnded: true
    })

    if (giveawayEmbed) {
      embed.setIsEnded(true);
    }

    if (!entries || entries.length === 0) {
      await message.edit({ content: TMessages.giveawayEndedNoEntries, components: [] });
      embed.setWinners(-1);

      // Update the original giveaway message
      await message.edit({ embeds: [embed.getEmbed()], components: [] });

      tLog.log(LOG_ACTIONS.GIVEAWAY, TMessages.giveawayEndedNoEntries, `giveawayId: ${giveawayId}`, giveawayData);

    } else {

    // Randomly select winners
    const winnerIds = selectRandomWinners(entries, winners);

    // Fetch winner user objects
    const winnerUsers = await Promise.all(winnerIds.map(id => message.client.users.fetch(id)));

    const winnerMentions = winnerUsers.map(user => user.toString()).join(', ');

    embed.setWinners(winnerMentions);

    // Update the original giveaway message
    await message.edit({ embeds: [embed.getEmbed()], components: [] });

    // Send a new message announcing the winners
    if (message.channel instanceof TextChannel) {
      await message.reply({
        content: `🎉 Congratulations ${winnerMentions}! You won the giveaway for **${prizeMessage}**! 🎉`,
        allowedMentions: { users: winnerIds }
      });
      tLog.logSuccess(LOG_ACTIONS.GIVEAWAY, `Giveaway ended. Winner: ${winnerMentions}. Prize: ${prizeMessage}`, `giveawayId: ${giveawayId}`, giveawayData);
    }
  }
    // Clean up Redis data
    await tRedis.redisDB?.del(`${GiveawayConstants.GIVEAWAY_PREFIX}${giveawayId}`);
    await tRedis.redisDB?.del(`${GiveawayConstants.GIVEAWAY_PREFIX}${giveawayId}${GiveawayConstants.GIVEAWAY_POSTFIX}`);
  } catch (error) {
    tLog.logError(LOG_ACTIONS.GIVEAWAY, `Error ending ${GiveawayConstants.GIVEAWAY_PREFIX}`, error);
  }
}

function selectRandomWinners(entries: string[], count: number): string[] {
  const shuffled = entries.sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

interface GiveawayStatus {
  prize: string;
  endTime: Date;
  isEnded: boolean;
  host: User | string;
  entries: number;
  winners: string | number;
}

export class GiveawayEmbed {
  private embed: EmbedBuilder;
  private status: GiveawayStatus;

  constructor(props: GiveawayStatus) {
    this.embed = new EmbedBuilder()
      .setColor('#FF1493')
      .setAuthor({ name: TMessages.giveawayEmbedTitle })
      .setTimestamp();
    this.status = {
      prize: props.prize,
      entries: props.entries,
      winners: props.winners,
      endTime: props.endTime,
      host: props.host,
      isEnded: props.isEnded
    };
    this.updateEmbed();
  }

  setEndTime(endTime: Date): this {
    this.status.endTime = endTime;
    this.updateEmbed();
    return this;
  }

  setHost(user: User | string): this {
    this.status.host = user;
    this.updateEmbed();
    return this;
  }

  setEntries(count: number): this {
    this.status.entries = count;
    this.updateEmbed();
    return this;
  }

  setWinners(winners: number | string): this {
    this.status.winners = winners;
    this.updateEmbed();
    return this;
  }

  setTitle(title: string): this {
    this.embed.setTitle(title);
    this.updateEmbed();
    return this;
  }

  setIsEnded(isEnded: boolean): this {
    this.status.isEnded = isEnded;
    this.updateEmbed();
    return this;
  }

  private updateEmbed(): void {
    this.embed.setTitle(`${this.status.prize}`);

    const timestamp = Math.floor(this.status.endTime.getTime() / 1000);
    this.updateEndTimeField(timestamp);

    if (typeof this.status.host === 'string') {
      this.updateField(TMessages.giveawayEmbedHostBy, `<@${this.status.host}>`);
    } else {
      this.updateField(TMessages.giveawayEmbedHostBy, this.status.host.toString());
    }
    if (this.status.entries < 1 && this.status.isEnded) {
      this.updateField(TMessages.giveawayEmbedEntries, TMessages.giveawayNoEntries);
    } else {
      this.updateField(TMessages.giveawayEmbedEntries, `**${this.status.entries}**`);
    }
    if (typeof this.status.winners === 'number') {
      if (this.status.winners < 0 || (this.status.isEnded && this.status.entries < 1)) {
        this.updateField(TMessages.giveawayEmbedWinners, TMessages.giveawayNoWinners);
      } else {
      this.updateField(TMessages.giveawayEmbedWinners, `**${this.status.winners}**`);
      }
    } else if (this.status.winners) {
      this.updateField(TMessages.giveawayEmbedWinners, this.status.winners);
    }
  }

  private updateField(name: string, value: string): void {
    const existingField = this.embed.data.fields?.find(field => field.name === name);
    if (existingField) {
      existingField.value = value;
    } else {
      this.embed.addFields({ name, value });
    }
  }

  private updateEndTimeField(timestamp: number): void {
    this.updateField(TMessages.giveawayEmbedEnds, `<t:${timestamp}:R> (<t:${timestamp}:f>)`);
    if (this.status.isEnded) {
      this.embed.setAuthor({ name: TMessages.giveawayEmbedTitleEnded });
    }
    // const endsField = this.embed.data.fields?.find(field => field.name === TMessages.giveawayEmbedEnds);
    // const endedField = this.embed.data.fields?.find(field => field.name === TMessages.giveawayEmbedEnded);
    // const isEnded = this.status.isEnded
    // if (endsField && !isEnded) {
    //   this.updateField(TMessages.giveawayEmbedEnds, `<t:${timestamp}:R> (<t:${timestamp}:f>)`);
    // } else if (endsField && isEnded) {
    //   this.embed.data.fields = this.embed.data.fields?.map(field =>
    //     field.name === TMessages.giveawayEmbedEnds
    //       ? { ...field, name: TMessages.giveawayEmbedEnded }
    //       : field
    //   );
    // } else if (endedField && !isEnded) {
    //   this.embed.data.fields = this.embed.data.fields?.map(field =>
    //     field.name === TMessages.giveawayEmbedEnded
    //       ? { ...field, name: TMessages.giveawayEmbedEnds }
    //       : field
    //   );
    // } else if (endedField && isEnded) {
    //   this.updateField(TMessages.giveawayEmbedEnded, `<t:${timestamp}:R> (<t:${timestamp}:f>)`);
    // } else {
    //   this.updateField(TMessages.giveawayEmbedEnds, `<t:${timestamp}:R> (<t:${timestamp}:f>)`);
    // }
  }

  getEmbed(): EmbedBuilder {
    return this.embed;
  }
}
