import {ButtonInteraction, Client} from "discord.js";
import {BtnFormat} from "../utils/constants";
import {onBindHandler} from '../utils/bindUtils';

export const name = BtnFormat.BTN_BIND_CHECK;

export async function onHandler(client: Client, interaction: ButtonInteraction) {
  await onBindHandler(interaction);
}
