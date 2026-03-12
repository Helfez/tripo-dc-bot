import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import tRequest from '../services/config';
import { ENVS, Urls } from '../services/urls';
import * as db from './db';
import { uploadToS3WithKey } from './s3Client';

const TRIPO_MODEL_FOLDER = 'tripo-models/';

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

export async function uploadImageToTripo(buffer: Buffer, format: string): Promise<string> {
  const FormData = (await import('form-data')).default;
  const form = new FormData();
  form.append('file', buffer, { filename: `upload.${format}`, contentType: `image/${format}` });

  const res = await tRequest.instance.post(Urls.task.upload, form, {
    headers: form.getHeaders(),
  });
  return res.data.data.image_token;
}

export async function createTripoTask(fileToken: string, format: string = 'png', faceLimit: number = 200000, modelVersion: string = 'v2.0-20240919'): Promise<string> {
  const res = await tRequest.instance.post(Urls.task.create, {
    type: 'image_to_model',
    file: {
      type: format,
      file_token: fileToken,
    },
    face_limit: faceLimit,
    model_version: modelVersion,
  });
  return res.data.data.task_id;
}

interface TripoTaskStatus {
  status: string;
  progress: number;
  output?: {
    model?: string;
    rendered_image?: string;
    rendered_video?: string;
  };
}

export async function pollTripoTaskStatus(tripoTaskId: string): Promise<TripoTaskStatus> {
  const res = await tRequest.instance.get(`${Urls.task.info}/${tripoTaskId}`);
  const d = res.data.data;
  return {
    status: d.status,
    progress: d.progress || 0,
    output: d.output,
  };
}

export async function runTripoGeneration(dbTaskId: number): Promise<void> {
  const startTime = Date.now();
  try {
    const task = await db.getTripoTask(dbTaskId);
    if (!task) throw new Error(`TripoTask ${dbTaskId} not found`);

    // Read the uploaded image
    const imgPath = task.inputImagePath;
    if (!imgPath || !fs.existsSync(imgPath)) {
      throw new Error('Input image not found');
    }
    const buffer = fs.readFileSync(imgPath);
    const ext = path.extname(imgPath).replace('.', '') || 'png';

    // Update status to uploading
    await db.updateTripoTask(dbTaskId, { status: 'uploading', progress: 5 });

    // Upload image to Tripo
    const imageToken = await uploadImageToTripo(buffer, ext);

    // Create Tripo task
    await db.updateTripoTask(dbTaskId, { status: 'creating', progress: 10 });
    const tripoTaskId = await createTripoTask(imageToken, ext, task.faceLimit, task.modelVersion);
    await db.updateTripoTask(dbTaskId, { tripoTaskId, status: 'running', progress: 15 });

    // Poll until done
    const deadline = Date.now() + POLL_TIMEOUT_MS;
    while (Date.now() < deadline) {
      await sleep(POLL_INTERVAL_MS);
      const s = await pollTripoTaskStatus(tripoTaskId);

      if (s.status === 'success') {
        const durationMs = Date.now() - startTime;
        const shareUrl = `${ENVS.shareUrl}${tripoTaskId}`;

        // Persist model to S3 so the URL doesn't expire
        let modelUrl = s.output?.model || '';
        if (modelUrl) {
          try {
            const modelResp = await axios.get(modelUrl, { responseType: 'arraybuffer' });
            const modelBuffer = Buffer.from(modelResp.data);
            const s3Key = `${TRIPO_MODEL_FOLDER}${tripoTaskId}.glb`;
            const { url } = await uploadToS3WithKey(modelBuffer, s3Key, 'model/gltf-binary');
            modelUrl = url;
          } catch (e: any) {
            console.error(`[tripo] Failed to upload model to S3 for task ${tripoTaskId}:`, e.message);
            // Fall back to the temporary Tripo URL
          }
        }

        await db.updateTripoTask(dbTaskId, {
          status: 'success',
          progress: 100,
          modelUrl,
          renderedImage: s.output?.rendered_image || '',
          renderedVideo: s.output?.rendered_video || '',
          shareUrl,
          durationMs,
          finishedAt: new Date(),
        });
        return;
      }

      if (s.status === 'failed' || s.status === 'cancelled' || s.status === 'unknown') {
        throw new Error(`Tripo task ${s.status}`);
      }

      // Update progress
      await db.updateTripoTask(dbTaskId, { progress: Math.max(15, s.progress) });
    }

    throw new Error('Polling timeout (10 minutes)');
  } catch (err: any) {
    const durationMs = Date.now() - startTime;
    const errorMsg = err?.info?.message || err?.message || String(err);
    await db.updateTripoTask(dbTaskId, {
      status: 'error',
      error: errorMsg,
      durationMs,
      finishedAt: new Date(),
    });
  }
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
