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

// Create a new tripo task (upload image + fire-and-forget generation)
router.post('/', upload.single('image') as any, async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    if (!req.file) {
      res.status(400).json({ error: 'image is required' });
      return;
    }
    const taskName = name || req.file.originalname || 'Untitled';
    const record = await db.createTripoTaskRecord(taskName, req.file.path);

    // Fire-and-forget
    runTripoGeneration(record.id).catch(err => {
      console.error(`[tripo] Generation error for task ${record.id}:`, err);
    });

    res.json(record);
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
