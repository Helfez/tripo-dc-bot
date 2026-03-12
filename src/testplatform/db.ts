import { PrismaClient } from '@prisma/client';

let prisma: PrismaClient;

export function getPrisma(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient();
  }
  return prisma;
}

// ---- TestCase ----

export async function listCases() {
  return getPrisma().testCase.findMany({ orderBy: { createdAt: 'desc' } });
}

export async function createCase(name: string, prompt: string, imagePath: string, remark: string = '') {
  return getPrisma().testCase.create({ data: { name, prompt, imagePath, remark } });
}

export async function deleteCase(id: number) {
  // Delete associated results first
  await getPrisma().testResult.deleteMany({ where: { caseId: id } });
  return getPrisma().testCase.delete({ where: { id } });
}

export async function updateCaseImage(id: number, imagePath: string) {
  return getPrisma().testCase.update({ where: { id }, data: { imagePath } });
}

export async function getCasesByIds(ids: number[]) {
  return getPrisma().testCase.findMany({ where: { id: { in: ids } } });
}

// ---- TestTask ----

export async function listTasks() {
  return getPrisma().testTask.findMany({ orderBy: { createdAt: 'desc' } });
}

export async function createTask(workflowId: string, workflowName: string, totalCases: number, remark: string = '') {
  return getPrisma().testTask.create({
    data: { workflowId, workflowName, totalCases, status: 'pending', remark },
  });
}

export async function getTask(id: number) {
  return getPrisma().testTask.findUnique({
    where: { id },
    include: { results: { include: { case: true }, orderBy: { id: 'asc' } } },
  });
}

export async function updateTaskStatus(id: number, status: string, extra?: { completedCases?: number; failedCases?: number; finishedAt?: Date }) {
  return getPrisma().testTask.update({
    where: { id },
    data: { status, ...extra },
  });
}

export async function updateTaskReview(id: number, review: string, reviewNote: string) {
  return getPrisma().testTask.update({
    where: { id },
    data: { review, reviewNote },
  });
}

export async function incrementTaskProgress(id: number, success: boolean) {
  const data: any = { completedCases: { increment: 1 } };
  if (!success) data.failedCases = { increment: 1 };
  return getPrisma().testTask.update({ where: { id }, data });
}

// ---- TestResult ----

export async function createResults(taskId: number, caseIds: number[]) {
  const data = caseIds.map(caseId => ({ taskId, caseId, status: 'pending' }));
  await getPrisma().testResult.createMany({ data });
  return getPrisma().testResult.findMany({
    where: { taskId },
    include: { case: true },
    orderBy: { id: 'asc' },
  });
}

export async function updateResult(id: number, data: { status?: string; resultImagePath?: string; error?: string; durationMs?: number; review?: string; aiReview?: string; aiReason?: string }) {
  return getPrisma().testResult.update({ where: { id }, data });
}

export async function getResultsByTask(taskId: number) {
  return getPrisma().testResult.findMany({
    where: { taskId },
    include: { case: true },
    orderBy: { id: 'asc' },
  });
}

export async function getResult(id: number) {
  return getPrisma().testResult.findUnique({
    where: { id },
    include: { case: true, task: true },
  });
}

// ---- PoolImage ----

export async function listPoolImages() {
  return getPrisma().poolImage.findMany({ orderBy: { createdAt: 'desc' } });
}

export async function createPoolImage(name: string, s3Key: string, url: string) {
  return getPrisma().poolImage.create({ data: { name, s3Key, url } });
}

export async function getPoolImage(id: number) {
  return getPrisma().poolImage.findUnique({ where: { id } });
}

export async function deletePoolImage(id: number) {
  return getPrisma().poolImage.delete({ where: { id } });
}

// ---- TripoTask ----

export async function listTripoTasks() {
  return getPrisma().tripoTask.findMany({ orderBy: { createdAt: 'desc' } });
}

export async function createTripoTaskRecord(name: string, imagePath: string, faceLimit: number = 200000, modelVersion: string = 'v2.0-20240919') {
  return getPrisma().tripoTask.create({ data: { name, inputImagePath: imagePath, faceLimit, modelVersion } });
}

export async function getTripoTask(id: number) {
  return getPrisma().tripoTask.findUnique({ where: { id } });
}

export async function updateTripoTask(id: number, data: {
  tripoTaskId?: string;
  status?: string;
  progress?: number;
  modelUrl?: string;
  renderedImage?: string;
  renderedVideo?: string;
  shareUrl?: string;
  error?: string;
  durationMs?: number;
  finishedAt?: Date;
}) {
  return getPrisma().tripoTask.update({ where: { id }, data });
}

export async function deleteTripoTask(id: number) {
  return getPrisma().tripoTask.delete({ where: { id } });
}
