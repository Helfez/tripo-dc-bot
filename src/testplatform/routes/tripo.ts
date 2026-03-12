import { Router, Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import multer from 'multer';
import * as db from '../db';
import { runTripoGeneration } from '../tripoService';

const UPLOADS_DIR = path.resolve(process.cwd(), 'data/testplatform/uploads');

function ensureUploadsDir() {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    ensureUploadsDir();
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.png';
    cb(null, `tripo_${Date.now()}${ext}`);
  },
});

const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

const router = Router();

// List all tripo tasks
router.get('/', async (_req: Request, res: Response) => {
  try {
    const tasks = await db.listTripoTasks();
    res.json(tasks);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create tripo tasks (upload image + batch create by versions x repeatCount)
router.post('/', upload.single('image') as any, async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    if (!req.file) {
      res.status(400).json({ error: 'image is required' });
      return;
    }

    const faceLimit = Math.min(5000000, Math.max(50000, parseInt(req.body.faceLimit, 10) || 200000));
    const repeatCount = Math.min(10, Math.max(1, parseInt(req.body.repeatCount, 10) || 1));
    let modelVersions: string[];
    try {
      modelVersions = JSON.parse(req.body.modelVersions || '[]');
    } catch {
      modelVersions = [];
    }
    if (!modelVersions.length) {
      modelVersions = ['v2.0-20240919'];
    }

    const originalName = req.file.originalname
      ? Buffer.from(req.file.originalname, 'latin1').toString('utf8')
      : 'Untitled';
    const taskName = name || originalName;
    const imagePath = req.file.path;
    const records = [];

    for (const version of modelVersions) {
      for (let i = 0; i < repeatCount; i++) {
        const suffix = modelVersions.length > 1 || repeatCount > 1
          ? ` [${version}${repeatCount > 1 ? ` #${i + 1}` : ''}]`
          : '';
        const record = await db.createTripoTaskRecord(taskName + suffix, imagePath, faceLimit, version);
        records.push(record);

        // Fire-and-forget
        runTripoGeneration(record.id).catch(err => {
          console.error(`[tripo] Generation error for task ${record.id}:`, err);
        });
      }
    }

    res.json(records);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get task detail
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const task = await db.getTripoTask(parseInt(req.params.id, 10));
    if (!task) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.json(task);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Lightweight status polling endpoint
router.get('/:id/status', async (req: Request, res: Response) => {
  try {
    const task = await db.getTripoTask(parseInt(req.params.id, 10));
    if (!task) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.json({
      id: task.id,
      status: task.status,
      progress: task.progress,
      shareUrl: task.shareUrl,
      renderedImage: task.renderedImage,
      modelUrl: task.modelUrl,
      error: task.error,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a tripo task
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const task = await db.getTripoTask(id);
    if (task?.inputImagePath && fs.existsSync(task.inputImagePath)) {
      fs.unlinkSync(task.inputImagePath);
    }
    await db.deleteTripoTask(id);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
