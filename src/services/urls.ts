let ENVS = {
  discordToken: '',
  webUrl: '',
  apiUrl: '',
  apiKey: '',
  shareUrl: '',
  roverKey: '',
  redisAddr: '',
  aiHubApiKey: '',
  twitterBearerToken: '',
  twitterAppKey: '',
  twitterAppSecret: '',
  twitterAccessToken: '',
  twitterAccessSecret: '',
  // Lottery
  channelLuckyDraw: '',
  channelUserCenter: '',
  winProbability: 0.01,
  maxDailyDraws: 50,
  dailyPrizeCount: 34,
  webDomain: '',
  adminIds: [] as string[],
  databaseUrl: '',
}

let isTest = false;

/** Strip surrounding quotes that Docker --env-file preserves literally */
function stripQuotes(s: string): string {
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}

function envInit() {
  if (process.env.IS_TEST) {
    isTest = true;
  }
  ENVS = {
    discordToken: process.env.DISCORD_BOT_TOKEN!,
    webUrl: process.env.TRIPO_URL!,
    apiUrl: process.env.TRIPO_API_URL!,
    apiKey: process.env.TRIPO_API_KEY!,
    shareUrl: process.env.TRIPO_SHARE_URL!,
    roverKey: process.env.ROVER_API_KEY!,
    redisAddr: process.env.REDIS_ADDR!,
    aiHubApiKey: process.env.AIHUBMIX_API_KEY || '',
    twitterBearerToken: process.env.TWITTER_BEARER_TOKEN || '',
    twitterAppKey: process.env.TWITTER_APP_KEY || '',
    twitterAppSecret: process.env.TWITTER_APP_SECRET || '',
    twitterAccessToken: process.env.TWITTER_ACCESS_TOKEN || '',
    twitterAccessSecret: process.env.TWITTER_ACCESS_SECRET || '',
    // Lottery
    channelLuckyDraw: stripQuotes(process.env.CHANNEL_LUCKY_DRAW || ''),
    channelUserCenter: stripQuotes(process.env.CHANNEL_USER_CENTER || ''),
    winProbability: parseFloat(stripQuotes(process.env.WIN_PROBABILITY || '0.01')),
    maxDailyDraws: parseInt(stripQuotes(process.env.MAX_DAILY_DRAWS || '50'), 10),
    dailyPrizeCount: parseInt(stripQuotes(process.env.DAILY_PRIZE_COUNT || '34'), 10),
    webDomain: stripQuotes(process.env.WEB_DOMAIN || ''),
    adminIds: stripQuotes(process.env.ADMIN_IDS || '').split(',').filter(Boolean),
    databaseUrl: stripQuotes(process.env.DATABASE_URL || ''),
  }
}

const Urls = {
  task: {
    create: '/v2/openapi/task',
    info: '/v2/openapi/task',
    upload: '/v2/openapi/upload',
  },
  discord: {
    check: '/v2/web/discord/check',
  }
}

export {
  ENVS,
  Urls,
  envInit,
  isTest,
}