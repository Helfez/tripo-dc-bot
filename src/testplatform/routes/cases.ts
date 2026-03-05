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

// Update a single case's image
router.patch('/:id/image', upload.single('image') as any, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!req.file) {
      res.status(400).json({ error: 'No image provided' });
      return;
    }
    await db.updateCaseImage(id, req.file.path);
    res.json({ ok: true, imagePath: req.file.path });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Batch upload images — match by filename to case name
router.post('/batch-upload', upload.array('images', 200) as any, async (req: Request, res: Response) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      res.status(400).json({ error: 'No files uploaded' });
      return;
    }

    const cases = await db.listCases();
    const results: Array<{ fileName: string; matched: boolean; caseId?: number; caseName?: string }> = [];

    for (const file of files) {
      // Match by filename (without extension) to case name (case-insensitive)
      const baseName = path.parse(file.originalname).name.toLowerCase().trim();
      const matched = cases.find(c => c.name.toLowerCase().trim() === baseName);

      if (matched) {
        await db.updateCaseImage(matched.id, file.path);
        results.push({ fileName: file.originalname, matched: true, caseId: matched.id, caseName: matched.name });
      } else {
        results.push({ fileName: file.originalname, matched: false });
      }
    }

    res.json({
      total: files.length,
      matched: results.filter(r => r.matched).length,
      unmatched: results.filter(r => !r.matched).length,
      details: results,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
