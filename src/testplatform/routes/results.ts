import { Router, Request, Response } from 'express';
import * as db from '../db';

const router = Router();

// Get results for a task
router.get('/:taskId', async (req: Request, res: Response) => {
  try {
    const taskId = parseInt(req.params.taskId, 10);
    const results = await db.getResultsByTask(taskId);
    res.json(results);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update review status for a result
router.patch('/:resultId/review', async (req: Request, res: Response) => {
  try {
    const resultId = parseInt(req.params.resultId, 10);
    const { review } = req.body;
    if (!['pass', 'pending', 'reject', 'skip', 'none'].includes(review)) {
      res.status(400).json({ error: 'review must be pass, pending, reject, or skip' });
      return;
    }
    const updated = await db.updateResult(resultId, { review });
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
