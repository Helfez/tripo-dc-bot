import dotenv from 'dotenv';
import MyBot from './client/MyBot';
import {envInit, ENVS} from "./services/urls";
import tRedis from "./redis";

// 加载.env文件中的变量
dotenv.config();
envInit();

const myClient = new MyBot();
myClient.connect(process.env.DISCORD_BOT_TOKEN);
