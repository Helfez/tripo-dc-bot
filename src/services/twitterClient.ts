import {TwitterApi} from 'twitter-api-v2';
import {ENVS} from './urls';
import tLog, {LOG_ACTIONS} from '../utils/logUtils';

let readClient: TwitterApi | null = null;
let writeClient: TwitterApi | null = null;
let botUserId: string | null = null;

export function initializeTwitterClient() {
  const {twitterBearerToken, twitterAppKey, twitterAppSecret, twitterAccessToken, twitterAccessSecret} = ENVS;

  if (!twitterAppKey || !twitterAccessToken) {
    tLog.log(LOG_ACTIONS.TWITTER, 'Twitter credentials not configured, skipping Twitter init');
    return false;
  }

  // Read client using Bearer Token (app-level, for v2 endpoints)
  if (twitterBearerToken) {
    readClient = new TwitterApi(twitterBearerToken);
  }

  // Write client using OAuth 1.0a (user-level, for posting tweets + v1.1 media upload)
  writeClient = new TwitterApi({
    appKey: twitterAppKey,
    appSecret: twitterAppSecret,
    accessToken: twitterAccessToken,
    accessSecret: twitterAccessSecret,
  });

  tLog.log(LOG_ACTIONS.TWITTER, 'Twitter clients initialized');
  return true;
}

export async function getBotUserId(): Promise<string> {
  if (botUserId) return botUserId;

  const client = writeClient;
  if (!client) throw new Error('Twitter write client not initialized');

  const me = await client.v2.me();
  botUserId = me.data.id;
  tLog.log(LOG_ACTIONS.TWITTER, `Twitter bot user ID: ${botUserId}, username: @${me.data.username}`);
  return botUserId;
}

export interface MentionTweet {
  id: string;
  text: string;
  authorId: string;
  mediaUrls: string[];
}

export async function getMentionsSince(sinceId?: string): Promise<{tweets: MentionTweet[], newestId?: string}> {
  const client = writeClient;
  if (!client) throw new Error('Twitter client not initialized');

  const userId = await getBotUserId();

  const params: any = {
    max_results: 10,
    'tweet.fields': ['author_id', 'attachments'],
    'media.fields': ['url', 'preview_image_url'],
    expansions: ['attachments.media_keys'],
  };

  if (sinceId) {
    params.since_id = sinceId;
  }

  const mentions = await client.v2.userMentionTimeline(userId, params);

  if (!mentions.data?.data || mentions.data.data.length === 0) {
    return {tweets: [], newestId: undefined};
  }

  // Build media lookup from includes
  const mediaMap = new Map<string, string>();
  if (mentions.includes?.media) {
    for (const media of mentions.includes.media) {
      const url = media.url || media.preview_image_url;
      if (url && media.media_key) {
        mediaMap.set(media.media_key, url);
      }
    }
  }

  const tweets: MentionTweet[] = mentions.data.data.map(tweet => {
    const mediaUrls: string[] = [];
    if (tweet.attachments?.media_keys) {
      for (const key of tweet.attachments.media_keys) {
        const url = mediaMap.get(key);
        if (url) mediaUrls.push(url);
      }
    }

    return {
      id: tweet.id,
      text: tweet.text,
      authorId: tweet.author_id || '',
      mediaUrls,
    };
  });

  const newestId = mentions.data.meta?.newest_id;
  return {tweets, newestId};
}

export async function uploadImageAndReply(tweetId: string, imageBuffer: Buffer, text: string): Promise<string> {
  const client = writeClient;
  if (!client) throw new Error('Twitter write client not initialized');

  // Upload image via v1.1 media upload
  const mediaId = await client.v1.uploadMedia(imageBuffer, {mimeType: 'image/png'});

  // Reply with the image
  const reply = await client.v2.reply(text, tweetId, {
    media: {media_ids: [mediaId]},
  });

  tLog.logSuccess(LOG_ACTIONS.TWITTER, `Replied to tweet ${tweetId} with media, reply id: ${reply.data.id}`);
  return reply.data.id;
}

export async function replyText(tweetId: string, text: string): Promise<string> {
  const client = writeClient;
  if (!client) throw new Error('Twitter write client not initialized');

  const reply = await client.v2.reply(text, tweetId);
  return reply.data.id;
}
