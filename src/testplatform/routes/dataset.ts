import { Router, Request, Response } from 'express';
import * as path from 'path';
import * as db from '../db';

const router = Router();

// Public dataset API — returns all cases with image URLs for external consumption
// No auth required so external workflows / middleware can fetch the test dataset
router.get('/', async (req: Request, res: Response) => {
  try {
    const cases = await db.listCases();
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const dataset = cases.map(c => {
      let imageUrl = '';
      if (c.imagePath) {
        if (c.imagePath.startsWith('http://') || c.imagePath.startsWith('https://')) {
          imageUrl = c.imagePath;
        } else {
          imageUrl = `${baseUrl}/uploads/${path.basename(c.imagePath)}`;
        }
      }
      return {
        id: c.id,
        name: c.name,
        prompt: c.prompt || '',
        imageUrl,
        remark: c.remark || '',
      };
    });
    res.json({ total: dataset.length, data: dataset });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
