import tRequest from "./config";
import {ResponseProtocol} from "../models/protocol";
import {ENVS, Urls} from "./urls";
import axios from "axios";

export async function discordCheck(user_id: string) {
  return tRequest.instance.post<ResponseProtocol.WebBindStatusResp>(Urls.discord.check, {
    discord_id: user_id,
  });
}

export async function roverBind(guildId: string, userId: string) {
  return axios.create({
    baseURL: 'https://registry.rover.link/api', // 替换为你的API baseURL
  }).get(`/guilds/${guildId}/discord-to-roblox/${userId}`,{
    headers: {
      Authorization: `Bearer ${ENVS.roverKey}`
    }
  });
}