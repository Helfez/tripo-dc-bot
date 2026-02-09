import {ButtonBuilder, ButtonStyle} from "discord.js";
import {sprintf} from "../../utils";
import {BtnFormat} from "../../utils/constants";
import {Stylize} from "../../models/enums";

export const StylizeBtns = (taskId: string) => [
  new ButtonBuilder()
    .setLabel("Lego")
    .setStyle(ButtonStyle.Success)
    .setDisabled(false)
    .setCustomId(sprintf(BtnFormat.BTN_STYLE_FORMAT, Stylize.STYLE_LEGO, taskId)),
  new ButtonBuilder()
    .setLabel('Voxelize')
    .setStyle(ButtonStyle.Success)
    .setDisabled(false)
    .setCustomId(sprintf(BtnFormat.BTN_STYLE_FORMAT, Stylize.STYLE_VOXEL, taskId)),
  new ButtonBuilder()
    .setLabel('Voronoi')
    .setStyle(ButtonStyle.Success)
    .setDisabled(false)
    .setCustomId(sprintf(BtnFormat.BTN_STYLE_FORMAT, Stylize.STYLE_VORONOI, taskId)),
];