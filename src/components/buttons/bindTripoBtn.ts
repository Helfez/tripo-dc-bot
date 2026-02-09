import { ButtonBuilder, ButtonStyle } from "discord.js";
import TMessages from "../../utils/messages";
import { ENVS } from "../../services/urls";
import {BtnFormat} from "../../utils/constants";

export const BindTripoBtn = () => new ButtonBuilder()
  .setLabel(TMessages.bindWeb)
  .setStyle(ButtonStyle.Link)
  .setURL(`${ENVS.webUrl}/discord/bind`)

export const BindCheckBtn = () => new ButtonBuilder()
  .setLabel(TMessages.checkBind)
  .setStyle(ButtonStyle.Primary)
  .setCustomId(BtnFormat.BTN_BIND_CHECK)
