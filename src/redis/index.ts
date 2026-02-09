import Redis from 'ioredis';
import {ENVS} from "../services/urls";
import tLog, {LOG_ACTIONS} from "../utils/logUtils";

const SERVERID_TO_TOKEN = "postprocess::serverid-to-token";

class TRedis {
  redisDB?: Redis;

  init = async () => {
    try {
      if (!this.redisDB) {
        if (!ENVS.redisAddr) {
          tLog.log(LOG_ACTIONS.SYS, 'Redis address not configured, skipping Redis connection.');
          return;
        }
        
        const redis = new Redis(ENVS.redisAddr, {
          // 如果连接失败，不要无限重试，防止刷屏报错
          maxRetriesPerRequest: 3,
        });

        // 必须监听 error 事件，否则连接失败会导致进程崩溃
        redis.on('error', (err) => {
          tLog.logError(LOG_ACTIONS.SYS, 'Redis client error:', err);
        });

        await redis.ping();
        this.redisDB = redis;
        tLog.log(LOG_ACTIONS.SYS, 'Connected to Redis');
      }
    } catch (e: any) {
      tLog.logError(LOG_ACTIONS.SYS, 'Error connecting to Redis:', e);
    }
  }

  checkRateLimit = async (key: string, rateLimit: number): Promise<[number, boolean]> => {
    if (this.redisDB) {
      try {
        const value = await this.redisDB.get(key);
        if (value === null) {
          await this.redisDB.set(key, 1, 'EX', 3600); // Set key with 1 hour expiration
          return [1, false];
        }

        const increValue = await this.redisDB.incr(key);
        return [increValue, increValue > rateLimit];
      } catch (e: any) {
        tLog.logError(LOG_ACTIONS.SYS, 'Error checking rate limit:', e);
        return [0, false];
      }
    }
    return [0, false];
  }

  exit = () => {
    if (this.redisDB) {
      this.redisDB.disconnect();
    }
  }
}

const tRedis = new TRedis();
export default tRedis;
