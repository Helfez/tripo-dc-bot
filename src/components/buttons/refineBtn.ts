import {ButtonBuilder, ButtonStyle} from "discord.js";
import {sprintf} from "../../utils";
import {BtnFormat} from "../../utils/constants";

export const RefineBtn = (taskId: string) => new ButtonBuilder()
  .setLabel('Refine')
  .setStyle(ButtonStyle.Primary)
  .setDisabled(false)
  .setCustomId(sprintf(BtnFormat.BTN_REFINE_FORMAT, taskId));