import { Router, Request, Response } from 'express';
import { ALL_WORKFLOWS } from '../pipelineAdapter';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  res.json(ALL_WORKFLOWS.map(w => ({ id: w.id, name: w.name, pipeline: w.pipeline })));
});

export default router;
