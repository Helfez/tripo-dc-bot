import dotenv from 'dotenv';
import MyBot from './client/MyBot';
import {envInit, ENVS} from "./services/urls";
import tRedis from "./redis";
import tLog, { LOG_ACTIONS } from "./utils/logUtils";
import { initS3 } from "./services/s3Upload";

// 全局异常捕获，防止进程崩溃
process.on('uncaughtException', (err) => {
  tLog.logError(LOG_ACTIONS.SYS, '[FATAL] uncaughtException:', err?.message || String(err));
  console.error('[FATAL] uncaughtException:', err);
});

process.on('unhandledRejection', (reason) => {
  const msg = reason instanceof Error ? reason.message : String(reason);
  tLog.logError(LOG_ACTIONS.SYS, '[FATAL] unhandledRejection:', msg);
  console.error('[FATAL] unhandledRejection:', reason);
});

// 加载.env文件中的变量
dotenv.config();
envInit();

// 初始化 S3 客户端
initS3();

const myClient = new MyBot();
myClient.connect(process.env.DISCORD_BOT_TOKEN);
