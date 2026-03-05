import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

const BUCKET = process.env.AWS_BUCKET_NAME || 'jujubit-test-shop-creation';
const REGION = process.env.AWS_REGION || 'ap-southeast-1';
const POOL_FOLDER = process.env.S3_POOL_FOLDER || 'uploads/agentcase/';

let client: S3Client | null = null;

function getClient(): S3Client {
  if (!client) {
    client = new S3Client({
      region: REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
    });
  }
  return client;
}

export function getPublicUrl(s3Key: string): string {
  return `https://${BUCKET}.s3.${REGION}.amazonaws.com/${s3Key}`;
}

export async function uploadToS3(buffer: Buffer, filename: string, contentType: string): Promise<{ s3Key: string; url: string }> {
  const s3Key = `${POOL_FOLDER}${Date.now()}_${filename}`;
  await getClient().send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: s3Key,
    Body: buffer,
    ContentType: contentType,
  }));
  return { s3Key, url: getPublicUrl(s3Key) };
}

export async function deleteFromS3(s3Key: string): Promise<void> {
  await getClient().send(new DeleteObjectCommand({
    Bucket: BUCKET,
    Key: s3Key,
  }));
}
