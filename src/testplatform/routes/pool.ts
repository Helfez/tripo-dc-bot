import { Router, Request, Response } from 'express';
import multer from 'multer';
import * as db from '../db';
import { uploadToS3, deleteFromS3 } from '../s3Client';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const router = Router();

// List all pool images
router.get('/', async (_req: Request, res: Response) => {
  try {
    const images = await db.listPoolImages();
    res.json(images);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Upload images to pool (batch)
router.post('/', upload.array('images', 200) as any, async (req: Request, res: Response) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      res.status(400).json({ error: 'No files uploaded' });
      return;
    }

    const results = [];
    for (const file of files) {
      const { s3Key, url } = await uploadToS3(file.buffer, file.originalname, file.mimetype);
      const record = await db.createPoolImage(file.originalname, s3Key, url);
      results.push(record);
    }

    res.json({ uploaded: results.length, images: results });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a pool image
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const image = await db.getPoolImage(id);
    if (!image) {
      res.status(404).json({ error: 'Image not found' });
      return;
    }
    await deleteFromS3(image.s3Key);
    await db.deletePoolImage(id);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
