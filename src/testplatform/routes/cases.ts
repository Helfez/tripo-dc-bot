import { Router, Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import multer from 'multer';
import archiver from 'archiver';
import axios from 'axios';
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

// Set case image from pool (S3 URL)
router.patch('/:id/pool-image', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { url } = req.body;
    if (!url) {
      res.status(400).json({ error: 'url is required' });
      return;
    }
    await db.updateCaseImage(id, url);
    res.json({ ok: true, imagePath: url });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Download a single case image
router.get('/:id/download-image', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const cases = await db.listCases();
    const found = cases.find(c => c.id === id);
    if (!found || !found.imagePath) {
      res.status(404).json({ error: 'Image not found' });
      return;
    }

    if (found.imagePath.startsWith('http://') || found.imagePath.startsWith('https://')) {
      const response = await axios.get(found.imagePath, { responseType: 'arraybuffer', timeout: 15000 });
      const contentType = response.headers['content-type'] || 'image/png';
      const ext = contentType.includes('jpeg') ? '.jpg' : contentType.includes('webp') ? '.webp' : '.png';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${found.name}${ext}"`);
      res.send(Buffer.from(response.data));
    } else if (fs.existsSync(found.imagePath)) {
      const ext = path.extname(found.imagePath) || '.png';
      res.setHeader('Content-Disposition', `attachment; filename="${found.name}${ext}"`);
      res.sendFile(path.resolve(found.imagePath));
    } else {
      res.status(404).json({ error: 'Image file not found on disk' });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Download all case images as a zip
router.get('/download-images', async (_req: Request, res: Response) => {
  try {
    const cases = await db.listCases();
    const casesWithImage = cases.filter(c => c.imagePath);
    if (casesWithImage.length === 0) {
      res.status(404).json({ error: 'No images to download' });
      return;
    }

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="test-case-images.zip"');

    const archive = archiver('zip', { zlib: { level: 5 } });
    archive.on('error', (err) => { throw err; });
    archive.pipe(res as any);

    for (const c of casesWithImage) {
      const ext = path.extname(c.imagePath) || '.png';
      const fileName = `${c.name}${ext}`;

      if (c.imagePath.startsWith('http://') || c.imagePath.startsWith('https://')) {
        // Remote image: download and append to archive
        try {
          const response = await axios.get(c.imagePath, { responseType: 'arraybuffer', timeout: 15000 });
          archive.append(Buffer.from(response.data), { name: fileName });
        } catch {
          // Skip images that fail to download
        }
      } else if (fs.existsSync(c.imagePath)) {
        archive.file(c.imagePath, { name: fileName });
      }
    }

    await archive.finalize();
  } catch (err: any) {
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  }
});

export default router;
