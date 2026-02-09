import axios from 'axios';
import {AttachmentBuilder} from "discord.js";
import {Readable} from 'stream';
import tLog, {LOG_ACTIONS} from "./logUtils";

export function sprintf(formatString: string, ...args: any[]): string {
  try {
    let i = 0;
    return formatString.replace(/%[stvd]/g, match => {
      if (i >= args.length) {
        throw new Error('Not enough arguments provided for format string');
      }
      const arg = args[i++];
      switch (match) {
        case '%s':
          return String(arg);
        case '%t':
          return String(Boolean(arg));
        case '%v':
          return formatValue(arg);
        case '%d':
          return String(Number(arg));
        default:
          return formatString;
      }
    });
  } catch (e: any) {
    return formatString;
  }
}

function formatValue(value: any): string {
  if (value === null) {
    return 'null';
  } else if (value === undefined) {
    return 'undefined';
  } else if (typeof value === 'object') {
    if (Array.isArray(value)) {
      return `[${value.map(formatValue).join(', ')}]`;
    } else {
      return `{${Object.entries(value).map(([key, val]) => `${key}: ${formatValue(val)}`).join(', ')}}`;
    }
  } else {
    return String(value);
  }
}

export function reverseSprintf(formatString: string, inputString: string): any[] {
  // 将格式化字符串中的 %s 和 %t 占位符替换为捕获组
  const regexString = formatString.replace(/%[st]/g, '(.*?)');
  const regex = new RegExp(`^${regexString}$`);

  const match = inputString.match(regex);

  if (!match) {
    throw new Error('Input string does not match the format string');
  }

  // 从第一个捕获组开始（忽略完整匹配）
  return match.slice(1);
}

const VIOLATION_PATTERNS: RegExp[] = [
  new RegExp(
    `1yearold|2yearold|3yearold|4yearold|5yearold|6yearold|7yearold|8yearold|9yearold|10yearold|11yearold|12yearold|13yearold|14yearold|15yearold|16yearold|17yearold|1yearsold|2yearsold|3yearsold|4yearsold|5yearsold|6yearsold|7yearsold|8yearsold|9yearsold|10yearsold|11yearsold|12yearsold|13yearsold|14yearsold|15yearsold|16yearsold|17yearsold|1years old|2years old|3years old|4years old|5years old|6years old|7years old|8years old|9years old|10years old|11years old|12years old|13years old|14years old|15years old|16years old|17years old|1year old|2year old|3year old|4year old|5year old|6year old|7year old|8year old|9year old|10year old|11year old|12year old|13year old|14year old|15year old|16year old|17year old|1 year old|2 year old|3 year old|4 year old|5 year old|6 year old|7 year old|8 year old|9 year old|10 year old|11 year old|12 year old|13 year old|14 year old|15 year old|16 year old|17 year old|1 years old|2 years old|3 years old|4 years old|5 years old|6 years old|7 years old|8 years old|9 years old|10 years old|11 years old|12 years old|13 years old|14 years old|15 years old|16 years old|17 years old|oneyearold|twoyearold|threeyearold|fouryearold|fiveyearold|sixyearold|sevenyearold|eightyearold|nineyearold|tenyearold|elevenyearold|twelveyearold|thirteenyearold|fourteenyearold|fifteenyearold|sixteenyearold|seventeenyearold|oneyear old|twoyear old|threeyear old|fouryear old|fiveyear old|sixyear old|sevenyear old|eightyear old|nineyear old|tenyear old|elevenyear old|twelveyear old|thirteenyear old|fourteenyear old|fifteenyear old|sixteenyear old|seventeenyear old|one year old|two year old|three year old|four year old|five year old|six year old|seven year old|eight year old|nine year old|ten year old|eleven year old|twelve year old|thirteen year old|fourteen year old|fifteen year old|sixteen year old|seventeen year old|one years old|two years old|three years old|four years old|five years old|six years old|seven years old|eight years old|nine years old|ten years old|eleven years old|twelve years old|thirteen years old|fourteen years old|fifteen years old|sixteen years old|seventeen years old|child|children|teen|teens|teenager|teenagers|schoolboy|school boy|schoolgirl|school girl|schoolboys|schoolgirls|youngling|younglings|youngster|youngsters|underage|adolescents|adolescent|juvenile|juveniles|minor|minors|infant|infants|newborn|newborns|toddler|toddlers|baby|babies|little one|little ones|stripling|striplings|preteen|preteens|kid|tiny`,
    'i'
  ),
  new RegExp(
    `porn|naked|gangbang|dildo|pussy|pussies|dick|cock|cocks|sex|boobs|boob|vagina|vaginas|cum|wet|threesome|foursome|fivesome|nipple|nipples|titties|tits|hentai|s&m|penis|creampie|creampied|orgasm|condom|condoms|naked|whore|whores|bitch|bitches|slut|sluts|prostitute|prostitutes|hooker|hookers|breast|breasts|sexy costume|undress|undressed|drug|dom|sub|bondage|fuck machine|double penetration|hoe|escort|fellatio|coitus|glory hole|cum toilet|fetish|futanari|whore|yaoi|yuri|cunnilingus|anilingus|bareback|urethal opening|clit|clitoris`,
    'i'
  ),
  new RegExp(
    `masturbate|masturbation|masterbated|masterbating|gangbanging|ganbang|gangbanged|piss|pissing|stripper|stripping|showering|swallowing|swallow|swallowed|cum|cummed|cumming|groom|groomed|grooming|shower|showered|showering|fucking|fuck|fucked|sucking|suck|sucked|rape|raping|raped|erotica|pornography|nudity|squirt|squirting`,
    'i'
  )
];

export function checkViolationByRegexp(prompt: string): boolean {
  return VIOLATION_PATTERNS.some(pattern => pattern.test(prompt));
}

export function generateProgressBar(progress: number): string {
  const totalBlocks = 20;
  const filledBlocks = Math.round((progress / 100) * totalBlocks);
  const emptyBlocks = totalBlocks - filledBlocks;

  return '█'.repeat(filledBlocks) + '░'.repeat(emptyBlocks);
  // return `${progress}`
}

export function userMention(userId: string) {
  return `<@${userId}>`;
}

export function replaceMention(content: string, userId: string): string {
  // 正则表达式匹配 Discord 提及格式 <@!1234567890>
  const rx = /<@!\w*>/g;
  return content.replace(rx, userMention(userId));
}

export async function createDiscordFileFromUrlForVideo(url: string, taskID: string): Promise<AttachmentBuilder | undefined> {
  try {
    // 使用 axios 进行 HTTP 请求
    const response = await axios.get(url, { responseType: 'arraybuffer' });

    // 将响应数据转换为 Buffer
    const buffer = Buffer.from(response.data);

    // 创建 Readable 流
    const stream = Readable.from(buffer);

    // 创建 Discord 文件附件
    const attachment = new AttachmentBuilder(stream, {
      name: `${taskID}.mp4`,
      description: 'video/mp4',
    });

    return attachment;
  } catch (error) {
    tLog.logError(LOG_ACTIONS.DEFAULT, 'Error fetching video from URL:', error);
    return undefined;
  }
}

