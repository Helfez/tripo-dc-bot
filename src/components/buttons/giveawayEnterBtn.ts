import { ButtonBuilder, ButtonStyle } from "discord.js";
import { sprintf } from "../../utils";
import { BtnFormat } from "../../utils/constants";

export const GiveawayEnterBtn = (id: string) => new ButtonBuilder()
  .setCustomId(sprintf(BtnFormat.BTN_GIVEAWAY_ENTER_FORMAT, id))
  .setLabel('Enter Giveaway')
  .setStyle(ButtonStyle.Primary)
  .setEmoji('🎉');