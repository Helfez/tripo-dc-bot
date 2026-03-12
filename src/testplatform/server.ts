import * as dotenv from 'dotenv';
dotenv.config();

import express, { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs';
import { envInit } from '../services/urls';
import { getPrisma } from './db';
import casesRouter from './routes/cases';
import datasetRouter from './routes/dataset';
import workflowsRouter from './routes/workflows';
import tasksRouter from './routes/tasks';
import resultsRouter from './routes/results';
import poolRouter from './routes/pool';
import tripoRouter from './routes/tripo';

// 全局异常捕获，防止测试平台进程崩溃
process.on('uncaughtException', (err) => {
  console.error('[test-platform] [FATAL] uncaughtException:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[test-platform] [FATAL] unhandledRejection:', reason);
});

// Initialize environment (for AIHUBMIX_API_KEY etc.)
envInit();

const PORT = parseInt(process.env.TEST_PLATFORM_PORT || '4000', 10);
const app = express();

app.use(express.json());

// ---- Auth ----
const AUTH_USER = 'vast2026';
const AUTH_PASS = 'jujubitagent';
const activeSessions = new Set<string>();

app.post('/api/login', (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (username === AUTH_USER && password === AUTH_PASS) {
    const token = crypto.randomBytes(32).toString('hex');
    activeSessions.add(token);
    res.json({ token });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token || !activeSessions.has(token)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}

// Static file serving for uploads and results (behind auth via query token)
const uploadsDir = path.resolve(process.cwd(), 'data/testplatform/uploads');
const resultsDir = path.resolve(process.cwd(), 'data/testplatform/results');
for (const dir of [uploadsDir, resultsDir]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function staticAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.query.token as string;
  if (!token || !activeSessions.has(token)) {
    res.status(401).send('Unauthorized');
    return;
  }
  next();
}

app.use('/uploads', staticAuth, express.static(uploadsDir));
app.use('/results', staticAuth, express.static(resultsDir));

// Serve the frontend (public, login page included)
app.use(express.static(path.join(__dirname, 'public')));

// Public API (no auth)
app.use('/api/dataset', datasetRouter);

// API routes (all behind auth)
app.use('/api/cases', authMiddleware, casesRouter);
app.use('/api/workflows', authMiddleware, workflowsRouter);
app.use('/api/tasks', authMiddleware, tasksRouter);
app.use('/api/results', authMiddleware, resultsRouter);
app.use('/api/pool', authMiddleware, poolRouter);
app.use('/api/tripo', authMiddleware, tripoRouter);

// Start
async function main() {
  const prisma = getPrisma();
  await prisma.$connect();
  console.log('[test-platform] Database connected');

  app.listen(PORT, () => {
    console.log(`[test-platform] Server running at http://localhost:${PORT}`);
  });
}

main().catch(err => {
  console.error('[test-platform] Failed to start:', err);
  process.exit(1);
});
