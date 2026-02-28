import { Router, Request, Response } from 'express';
import * as path from 'path';
import * as db from '../db';
import { scoreResult } from '../aiScorer';
import { getWorkflowDef } from '../pipelineAdapter';

const router = Router();

const RESULTS_DIR = path.resolve(process.cwd(), 'data/testplatform/results');

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

// Trigger AI re-score for a result
router.post('/:resultId/ai-rescore', async (req: Request, res: Response) => {
  try {
    const resultId = parseInt(req.params.resultId, 10);
    const result = await db.getResult(resultId);
    if (!result) {
      res.status(404).json({ error: 'Result not found' });
      return;
    }
    if (result.status !== 'success' || !result.resultImagePath) {
      res.status(400).json({ error: 'Result must be successful with an image to score' });
      return;
    }

    const filePath = path.join(RESULTS_DIR, result.resultImagePath);
    const task = result.task;

    // Fire-and-forget
    scoreResult(
      resultId, task.workflowId, task.workflowName,
      result.case?.prompt || undefined, result.case?.imagePath || undefined, filePath,
    ).catch(() => {});

    res.json({ ok: true, message: 'AI re-score triggered' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
