import {ButtonBuilder, ButtonStyle} from "discord.js";
import {sprintf} from "../../utils";
import {BtnFormat} from "../../utils/constants";
import {Format} from "../../models/enums";

export const ExportBtn = (taskId: string) => new ButtonBuilder()
  .setLabel('Export')
  .setStyle(ButtonStyle.Secondary)
  .setDisabled(false)
  .setCustomId(sprintf(BtnFormat.BTN_EXPORT_FORMAT, taskId));

export const ExportTaskBtns = (taskId: string) => [
  new ButtonBuilder()
    .setLabel("FBX")
    .setStyle(ButtonStyle.Success)
    .setDisabled(false)
    .setCustomId(sprintf(BtnFormat.BTN_EXPORT_TASK_FORMAT, taskId, Format.FORMAT_FBX, false)),
  new ButtonBuilder()
    .setLabel('USD')
    .setStyle(ButtonStyle.Success)
    .setDisabled(false)
    .setCustomId(sprintf(BtnFormat.BTN_EXPORT_TASK_FORMAT, taskId, Format.FORMAT_USD, false)),
  new ButtonBuilder()
    .setLabel('OBJ')
    .setStyle(ButtonStyle.Success)
    .setDisabled(false)
    .setCustomId(sprintf(BtnFormat.BTN_EXPORT_TASK_FORMAT, taskId, Format.FORMAT_OBJ, false)),
  new ButtonBuilder()
    .setLabel('STL')
    .setStyle(ButtonStyle.Success)
    .setDisabled(false)
    .setCustomId(sprintf(BtnFormat.BTN_EXPORT_TASK_FORMAT, taskId, Format.FORMAT_STL, false)),
  new ButtonBuilder()
    .setLabel('Minecraft')
    .setStyle(ButtonStyle.Success)
    .setDisabled(false)
    .setCustomId(sprintf(BtnFormat.BTN_EXPORT_TASK_FORMAT, taskId, Format.FORMAT_MINECRAFT, false))
]

export const ExportRetopoTaskBtns = (taskId: string) => [
  new ButtonBuilder()
    .setLabel("FBX+Retopo")
    .setStyle(ButtonStyle.Primary)
    .setDisabled(false)
    .setCustomId(sprintf(BtnFormat.BTN_EXPORT_TASK_FORMAT, taskId, Format.FORMAT_FBX, true)),
  new ButtonBuilder()
    .setLabel('USD+Retopo')
    .setStyle(ButtonStyle.Primary)
    .setDisabled(false)
    .setCustomId(sprintf(BtnFormat.BTN_EXPORT_TASK_FORMAT, taskId, Format.FORMAT_USD, true)),
  new ButtonBuilder()
    .setLabel('OBJ+Retopo')
    .setStyle(ButtonStyle.Primary)
    .setDisabled(false)
    .setCustomId(sprintf(BtnFormat.BTN_EXPORT_TASK_FORMAT, taskId, Format.FORMAT_OBJ, true)),
  new ButtonBuilder()
    .setLabel('STL+Retopo')
    .setStyle(ButtonStyle.Primary)
    .setDisabled(false)
    .setCustomId(sprintf(BtnFormat.BTN_EXPORT_TASK_FORMAT, taskId, Format.FORMAT_STL, true)),
];
