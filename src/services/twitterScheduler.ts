import {
  initializeTwitterClient,
  getMentionsSince,
  uploadImageAndReply,
  replyText,
  MentionTweet,
} from './twitterClient';
import {runTournamentPipeline} from './tournamentPipeline';
import {runCreatePipeline} from './createPipeline';
import {runJujumonPipeline} from './jujumonPipeline';
import {TournamentTemplate} from './tournamentConfig';
import {WorkflowType} from './workflowConfig';
import {checkViolationByRegexp} from '../utils';
import tRedis from '../redis';
import tLog, {LOG_ACTIONS} from '../utils/logUtils';

const POLL_INTERVAL_MS = 45_000; // 45 seconds
const REDIS_KEY_LAST_TWEET = 'twitter::last_processed_tweet_id';
const RATE_LIMIT_KEY_PREFIX = 'twitter::rate::';
const RATE_LIMIT_PER_HOUR = 5;

// Keyword → pipeline routing table
interface RouteMatch {
  pipeline: 'tournament' | 'create' | 'jujumon';
  template?: TournamentTemplate;
  style?: WorkflowType;
}

const KEYWORD_ROUTES: {keywords: string[], route: RouteMatch}[] = [
  {keywords: ['liquid dragon'], route: {pipeline: 'tournament', template: 'liquid_dragon'}},
  {keywords: ['funko pop', 'funko'], route: {pipeline: 'tournament', template: 'funko_pop'}},
  {keywords: ['animal beads', 'beads'], route: {pipeline: 'tournament', template: 'animal_beads'}},
  {keywords: ['foods cc', 'food'], route: {pipeline: 'tournament', template: 'foods_cc'}},
  {keywords: ['head sculpt', 'sculpt'], route: {pipeline: 'tournament', template: 'harry_sculpt'}},
  {keywords: ['animal ashley', 'ashley'], route: {pipeline: 'tournament', template: 'animal_ashley'}},
  {keywords: ['trpg', 'board game'], route: {pipeline: 'create', style: 'board_game'}},
  {keywords: ['chibi'], route: {pipeline: 'create', style: 'chibi'}},
  {keywords: ['1:7 figure', '1:7', 'figure'], route: {pipeline: 'create', style: 'scale_1_7'}},
  {keywords: ['creative'], route: {pipeline: 'create', style: 'creative'}},
  {keywords: ['jujumon creature'], route: {pipeline: 'create', style: 'jujumon_creature'}},
  {keywords: ['jujumon trainer'], route: {pipeline: 'create', style: 'jujumon_trainer'}},
  {keywords: ['jujumon'], route: {pipeline: 'jujumon'}},
];

const HELP_TEXT = `Hi! I can generate stylized images for you. Just mention me with a style keyword + description or image.

Available styles:
- liquid dragon, funko pop, animal beads, foods cc, head sculpt, animal ashley
- trpg, chibi, 1:7 figure, creative
- jujumon creature, jujumon trainer
- jujumon (auto-classify)

Example: @me funko pop a cute cat wearing a hat`;

export class TwitterScheduler {
  private pollInterval: NodeJS.Timeout | null = null;
  private lastTweetId: string | undefined;
  private processing = new Set<string>();

  async start() {
    const initialized = initializeTwitterClient();
    if (!initialized) {
      tLog.log(LOG_ACTIONS.TWITTER, 'Twitter scheduler not started (credentials missing)');
      return;
    }

    // Load last processed tweet ID from Redis
    await this.loadLastTweetId();

    tLog.log(LOG_ACTIONS.TWITTER, `Twitter scheduler started, polling every ${POLL_INTERVAL_MS / 1000}s`);
    this.pollInterval = setInterval(() => this.poll(), POLL_INTERVAL_MS);

    // Run first poll immediately
    this.poll();
  }

  stop() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    tLog.log(LOG_ACTIONS.TWITTER, 'Twitter scheduler stopped');
  }

  private async loadLastTweetId() {
    try {
      if (tRedis.redisDB) {
        const stored = await tRedis.redisDB.get(REDIS_KEY_LAST_TWEET);
        if (stored) {
          this.lastTweetId = stored;
          tLog.log(LOG_ACTIONS.TWITTER, `Loaded last tweet ID from Redis: ${stored}`);
        }
      }
    } catch (e) {
      tLog.logError(LOG_ACTIONS.TWITTER, 'Failed to load last tweet ID from Redis', e);
    }
  }

  private async saveLastTweetId(id: string) {
    this.lastTweetId = id;
    try {
      if (tRedis.redisDB) {
        await tRedis.redisDB.set(REDIS_KEY_LAST_TWEET, id);
      }
    } catch (e) {
      tLog.logError(LOG_ACTIONS.TWITTER, 'Failed to save last tweet ID to Redis', e);
    }
  }

  private async poll() {
    try {
      const {tweets, newestId} = await getMentionsSince(this.lastTweetId);

      if (tweets.length === 0) return;

      tLog.log(LOG_ACTIONS.TWITTER, `Got ${tweets.length} new mentions`);

      // Process tweets oldest-first
      const sorted = [...tweets].reverse();

      for (const tweet of sorted) {
        if (this.processing.has(tweet.id)) continue;
        this.processing.add(tweet.id);

        // Process async, don't block the poll loop
        this.processTweet(tweet).finally(() => {
          this.processing.delete(tweet.id);
        });
      }

      if (newestId) {
        await this.saveLastTweetId(newestId);
      }
    } catch (e: any) {
      tLog.logError(LOG_ACTIONS.TWITTER, 'Poll error:', e.message || e);
    }
  }

  private async processTweet(tweet: MentionTweet) {
    try {
      tLog.log(LOG_ACTIONS.TWITTER, `Processing tweet ${tweet.id}: ${tweet.text.substring(0, 80)}`);

      // Parse the tweet
      const parsed = this.parseTweet(tweet);

      if (!parsed.route) {
        await replyText(tweet.id, HELP_TEXT);
        return;
      }

      // Content moderation
      if (parsed.prompt && checkViolationByRegexp(parsed.prompt)) {
        await replyText(tweet.id, 'Sorry, your request contains content that violates our terms of service.');
        return;
      }

      // Rate limit per author
      const isLimited = await this.checkRateLimit(tweet.authorId);
      if (isLimited) {
        await replyText(tweet.id, `Sorry, you've reached the limit of ${RATE_LIMIT_PER_HOUR} generations per hour. Please try again later.`);
        return;
      }

      // Validate: at least prompt or image
      if (!parsed.prompt && parsed.imageUrl === null) {
        await replyText(tweet.id, 'Please provide a text description or attach an image along with a style keyword.');
        return;
      }

      // Route to the appropriate pipeline
      const {route} = parsed;
      let imageBuffer: Buffer;
      let styleName: string;

      if (route.pipeline === 'tournament' && route.template) {
        const result = await runTournamentPipeline({
          template: route.template,
          prompt: parsed.prompt,
          imageUrl: parsed.imageUrl,
        });
        imageBuffer = result.imageBuffer;
        styleName = result.templateName;
      } else if (route.pipeline === 'create' && route.style) {
        const result = await runCreatePipeline({
          style: route.style,
          prompt: parsed.prompt,
          imageUrl: parsed.imageUrl,
        });
        imageBuffer = result.imageBuffer;
        styleName = result.styleName;
      } else if (route.pipeline === 'jujumon') {
        const result = await runJujumonPipeline({
          prompt: parsed.prompt,
          imageUrl: parsed.imageUrl,
        });
        imageBuffer = result.imageBuffer;
        styleName = `JuJuMon (${result.category})`;
      } else {
        await replyText(tweet.id, HELP_TEXT);
        return;
      }

      // Reply with the generated image
      await uploadImageAndReply(
        tweet.id,
        imageBuffer,
        `Here's your ${styleName} creation!`,
      );

      tLog.logSuccess(LOG_ACTIONS.TWITTER, `Tweet ${tweet.id} processed: ${styleName}`);
    } catch (e: any) {
      tLog.logError(LOG_ACTIONS.TWITTER, `Failed to process tweet ${tweet.id}:`, e.message || e);
      try {
        await replyText(tweet.id, 'Sorry, something went wrong while generating your image. Please try again later.');
      } catch {
        // ignore reply failure
      }
    }
  }

  private parseTweet(tweet: MentionTweet): {route: RouteMatch | null, prompt: string | undefined, imageUrl: string | null} {
    // Remove @mentions from the text to get the clean content
    let text = tweet.text.replace(/@\w+/g, '').trim();
    const textLower = text.toLowerCase();

    // Try to match keywords (longest first for proper matching)
    let matchedRoute: RouteMatch | null = null;
    let matchedKeyword = '';

    for (const entry of KEYWORD_ROUTES) {
      for (const kw of entry.keywords) {
        if (textLower.includes(kw) && kw.length > matchedKeyword.length) {
          matchedRoute = entry.route;
          matchedKeyword = kw;
        }
      }
    }

    // Extract prompt by removing the matched keyword
    let prompt: string | undefined;
    if (matchedKeyword) {
      // Case-insensitive removal of the keyword from text
      const idx = textLower.indexOf(matchedKeyword);
      const cleaned = (text.substring(0, idx) + text.substring(idx + matchedKeyword.length)).trim();
      prompt = cleaned || undefined;
    } else {
      prompt = text || undefined;
    }

    // Get first image URL from media
    const imageUrl = tweet.mediaUrls.length > 0 ? tweet.mediaUrls[0] : null;

    return {route: matchedRoute, prompt, imageUrl};
  }

  private async checkRateLimit(authorId: string): Promise<boolean> {
    try {
      if (tRedis.redisDB) {
        const key = `${RATE_LIMIT_KEY_PREFIX}${authorId}`;
        const [, isOver] = await tRedis.checkRateLimit(key, RATE_LIMIT_PER_HOUR);
        return isOver;
      }
    } catch (e) {
      tLog.logError(LOG_ACTIONS.TWITTER, 'Rate limit check error:', e);
    }
    return false; // Allow if Redis is not available
  }
}
