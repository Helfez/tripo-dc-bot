import { Router, Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import multer from 'multer';
import * as db from '../db';

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
    cb(null, `${Date.now()}${ext}`);
  },
});

const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

const router = Router();

// List all test cases
router.get('/', async (_req: Request, res: Response) => {
  try {
    const cases = await db.listCases();
    res.json(cases);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create a test case
router.post('/', upload.single('image') as any, async (req: Request, res: Response) => {
  try {
    const { name, prompt, remark } = req.body;
    if (!name) {
      res.status(400).json({ error: 'name is required' });
      return;
    }
    const imagePath = req.file ? req.file.path : '';
    if (!prompt && !imagePath) {
      res.status(400).json({ error: 'At least prompt or image is required' });
      return;
    }
    const testCase = await db.createCase(name, prompt || '', imagePath, remark || '');
    res.json(testCase);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a test case
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const cases = await db.listCases();
    const found = cases.find(c => c.id === id);
    if (found && found.imagePath && fs.existsSync(found.imagePath)) {
      fs.unlinkSync(found.imagePath);
    }
    await db.deleteCase(id);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
