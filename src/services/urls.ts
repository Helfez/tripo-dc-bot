let ENVS = {
  discordToken: '',
  webUrl: '',
  apiUrl: '',
  apiKey: '',
  shareUrl: '',
  roverKey: '',
  redisAddr: '',
  aiHubApiKey: '',
}

let isTest = false;

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