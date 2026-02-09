import {ButtonBuilder, ButtonStyle} from "discord.js";
import {sprintf} from "../../utils";
import {BtnFormat} from "../../utils/constants";

export const BindSkeletonBtn = (taskId: string) => new ButtonBuilder()
  .setLabel('Animation')
  .setStyle(ButtonStyle.Secondary)
  .setDisabled(false)
  .setCustomId(sprintf(BtnFormat.BTN_SKELETON_FORMAT, taskId));