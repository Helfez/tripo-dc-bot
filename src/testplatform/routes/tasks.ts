import { Router, Request, Response } from 'express';
import * as db from '../db';
import { getWorkflowDef } from '../pipelineAdapter';
import { startTask, getRunningCount, getQueueLength } from '../taskRunner';

const router = Router();

// List all tasks
router.get('/', async (_req: Request, res: Response) => {
  try {
    const tasks = await db.listTasks();
    res.json({ tasks, running: getRunningCount(), queued: getQueueLength() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create a new test task
router.post('/', async (req: Request, res: Response) => {
  try {
    const { workflowId, remark } = req.body;
    const def = getWorkflowDef(workflowId);
    if (!def) {
      res.status(400).json({ error: `Unknown workflow: ${workflowId}` });
      return;
    }

    // Snapshot current cases
    const allCases = await db.listCases();
    if (allCases.length === 0) {
      res.status(400).json({ error: 'No test cases available' });
      return;
    }

    const task = await db.createTask(def.id, def.name, allCases.length, remark || '');
    const caseIds = allCases.map(c => c.id);
    await db.createResults(task.id, caseIds);

    // Fire and forget — task runs in background
    startTask(task.id).catch(() => {});

    res.json(task);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get task detail
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const task = await db.getTask(id);
    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }
    res.json(task);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
