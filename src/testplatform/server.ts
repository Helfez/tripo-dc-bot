import * as dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import * as path from 'path';
import * as fs from 'fs';
import { envInit } from '../services/urls';
import { getPrisma } from './db';
import casesRouter from './routes/cases';
import workflowsRouter from './routes/workflows';
import tasksRouter from './routes/tasks';
import resultsRouter from './routes/results';

// Initialize environment (for AIHUBMIX_API_KEY etc.)
envInit();

const PORT = parseInt(process.env.TEST_PLATFORM_PORT || '4000', 10);
const app = express();

app.use(express.json());

// Static file serving for uploads and results
const uploadsDir = path.resolve(process.cwd(), 'data/testplatform/uploads');
const resultsDir = path.resolve(process.cwd(), 'data/testplatform/results');
for (const dir of [uploadsDir, resultsDir]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));
app.use('/results', express.static(resultsDir));

// Serve the frontend
app.use(express.static(path.join(__dirname, 'public')));

// API routes
app.use('/api/cases', casesRouter);
app.use('/api/workflows', workflowsRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/results', resultsRouter);

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
