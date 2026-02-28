import * as fs from 'fs';
import * as path from 'path';
import * as db from './db';
import { runWorkflow, getWorkflowDef } from './pipelineAdapter';
import tLog, { LOG_ACTIONS } from '../utils/logUtils';

const MAX_CONCURRENT_TASKS = 2;
const BATCH_SIZE = 5;

let runningTasks = 0;
const taskQueue: Array<() => void> = [];

function acquireSlot(): Promise<void> {
  if (runningTasks < MAX_CONCURRENT_TASKS) {
    runningTasks++;
    return Promise.resolve();
  }
  return new Promise(resolve => {
    taskQueue.push(resolve);
  });
}

function releaseSlot(): void {
  if (taskQueue.length > 0) {
    const next = taskQueue.shift()!;
    next();
  } else {
    runningTasks--;
  }
}

export function getRunningCount(): number {
  return runningTasks;
}

export function getQueueLength(): number {
  return taskQueue.length;
}

const RESULTS_DIR = path.resolve(process.cwd(), 'data/testplatform/results');

function ensureResultsDir() {
  if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
  }
}

export async function startTask(taskId: number): Promise<void> {
  const task = await db.getTask(taskId);
  if (!task) throw new Error(`Task ${taskId} not found`);

  const def = getWorkflowDef(task.workflowId);
  if (!def) throw new Error(`Unknown workflow: ${task.workflowId}`);

  // Wait for a slot
  await acquireSlot();

  try {
    await db.updateTaskStatus(taskId, 'running');
    ensureResultsDir();

    const results = task.results;
    tLog.log(LOG_ACTIONS.SYS, `[test-platform] task ${taskId} started: ${task.workflowName}, ${results.length} cases`);

    // Process in batches of BATCH_SIZE
    for (let i = 0; i < results.length; i += BATCH_SIZE) {
      const batch = results.slice(i, i + BATCH_SIZE);

      const promises = batch.map(async (result) => {
        const testCase = result.case;
        await db.updateResult(result.id, { status: 'running' });

        const start = Date.now();
        try {
          const output = await runWorkflow(task.workflowId, {
            prompt: testCase.prompt || undefined,
            imagePath: testCase.imagePath || undefined,
          });

          const durationMs = Date.now() - start;
          const fileName = `task${taskId}_case${testCase.id}.png`;
          const filePath = path.join(RESULTS_DIR, fileName);
          fs.writeFileSync(filePath, output.imageBuffer);

          await db.updateResult(result.id, {
            status: 'success',
            resultImagePath: fileName,
            durationMs,
          });
          await db.incrementTaskProgress(taskId, true);
          tLog.log(LOG_ACTIONS.SYS, `[test-platform] task ${taskId} case ${testCase.id} success (${durationMs}ms)`);
        } catch (err: any) {
          const durationMs = Date.now() - start;
          const errMsg = err?.message || String(err);
          await db.updateResult(result.id, {
            status: 'error',
            error: errMsg.substring(0, 500),
            durationMs,
          });
          await db.incrementTaskProgress(taskId, false);
          tLog.logError(LOG_ACTIONS.SYS, `[test-platform] task ${taskId} case ${testCase.id} error:`, errMsg.substring(0, 120));
        }
      });

      await Promise.allSettled(promises);
    }

    const finalTask = await db.getTask(taskId);
    const allFailed = finalTask!.failedCases === finalTask!.totalCases;
    await db.updateTaskStatus(taskId, allFailed ? 'failed' : 'completed', { finishedAt: new Date() });
    tLog.logSuccess(LOG_ACTIONS.SYS, `[test-platform] task ${taskId} finished: ${finalTask!.completedCases}/${finalTask!.totalCases} (${finalTask!.failedCases} failed)`);
  } catch (err: any) {
    tLog.logError(LOG_ACTIONS.SYS, `[test-platform] task ${taskId} fatal error:`, err?.message || err);
    await db.updateTaskStatus(taskId, 'failed', { finishedAt: new Date() });
  } finally {
    releaseSlot();
  }
}
