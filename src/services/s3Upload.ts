import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";
import tLog, { LOG_ACTIONS } from "../utils/logUtils";

let s3Client: S3Client | null = null;
let s3Bucket: string = "";
let s3Region: string = "";
let cdnDomain: string = "";

export function initS3() {
  const accessKeyId = process.env.DISCORD_AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.DISCORD_AWS_SECRET_ACCESS_KEY;
  s3Bucket = process.env.DISCORD_AWS_BUCKET_NAME || '';
  s3Region = process.env.DISCORD_AWS_REGION || 'ap-southeast-1';
  cdnDomain = process.env.DISCORD_CDN_DOMAIN || "";

  if (!accessKeyId || !secretAccessKey || !s3Bucket) {
    tLog.logError(LOG_ACTIONS.SYS, "S3 credentials not configured, image upload will be skipped");
    return;
  }

  s3Client = new S3Client({
    region: s3Region,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  tLog.logSuccess(LOG_ACTIONS.SYS, `S3 client initialized: bucket=${s3Bucket}, region=${s3Region}`);
}

function buildUrl(key: string): string {
  if (cdnDomain) {
    return `${cdnDomain}/${key}`;
  }
  return `https://${s3Bucket}.s3.${s3Region}.amazonaws.com/${key}`;
}

/**
 * Upload base64 image to S3 and return URL
 * @param base64Data - Base64 string (with or without data URL prefix)
 * @returns URL of uploaded image, or null if upload fails
 */
export async function uploadBase64ToS3(
  base64Data: string
): Promise<string | null> {
  if (!s3Client || !s3Bucket) {
    tLog.logError(LOG_ACTIONS.SYS, "S3 not initialized, skipping upload");
    return null;
  }

  try {
    let base64String = base64Data;
    if (base64Data.startsWith("data:")) {
      const matches = base64Data.match(/^data:image\/\w+;base64,(.+)$/);
      if (matches && matches[1]) {
        base64String = matches[1];
      }
    }

    const buffer = Buffer.from(base64String, "base64");
    const key = `uploads/discord/${uuidv4()}.png`;

    await s3Client.send(new PutObjectCommand({
      Bucket: s3Bucket,
      Key: key,
      Body: buffer,
      ContentType: "image/png",
      CacheControl: "public, max-age=31536000",
    }));

    const url = buildUrl(key);
    tLog.logSuccess(LOG_ACTIONS.SYS, `Image uploaded to S3: ${url}`);
    return url;
  } catch (error: any) {
    tLog.logError(LOG_ACTIONS.SYS, "Failed to upload image to S3:", error.message);
    return null;
  }
}

/**
 * Upload image buffer to S3 and return URL
 * @param buffer - Image buffer
 * @returns URL of uploaded image, or null if upload fails
 */
export async function uploadBufferToS3(
  buffer: Buffer
): Promise<string | null> {
  if (!s3Client || !s3Bucket) {
    tLog.log(LOG_ACTIONS.SYS, "S3 not initialized, skipping upload");
    return null;
  }

  try {
    const key = `uploads/discord/${uuidv4()}.png`;

    await s3Client.send(new PutObjectCommand({
      Bucket: s3Bucket,
      Key: key,
      Body: buffer,
      ContentType: "image/png",
      CacheControl: "public, max-age=31536000",
    }));

    const url = buildUrl(key);
    tLog.logSuccess(LOG_ACTIONS.SYS, `Image uploaded to S3: ${url}`);
    return url;
  } catch (error: any) {
    tLog.logError(LOG_ACTIONS.SYS, "Failed to upload image to S3:", error.message);
    return null;
  }
}

/**
 * Check if S3 is configured and ready
 */
export function isS3Configured(): boolean {
  return s3Client !== null && !!s3Bucket;
}
