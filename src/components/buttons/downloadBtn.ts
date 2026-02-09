import {ButtonBuilder, ButtonStyle} from "discord.js";
import {sprintf} from "../../utils";
import {ENVS} from "../../services/urls";

export const ViewDownloadBtn = (taskId: string) => new ButtonBuilder()
  .setLabel('View/Download')
  .setStyle(ButtonStyle.Link)
  .setURL(sprintf("%s%s", ENVS.shareUrl, taskId));

export const DownloadBtn = (url: string) => new ButtonBuilder()
  .setLabel('Download')
  .setStyle(ButtonStyle.Link)
  .setURL(url);