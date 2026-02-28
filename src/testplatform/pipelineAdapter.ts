import * as fs from 'fs';
import * as path from 'path';
import { runJujumonPipeline } from '../services/jujumonPipeline';
import { runCreatePipeline } from '../services/createPipeline';
import { runTournamentPipeline } from '../services/tournamentPipeline';
import { WorkflowType, WORKFLOW_CHOICES } from '../services/workflowConfig';
import { TournamentTemplate, TOURNAMENT_CHOICES } from '../services/tournamentConfig';

export interface WorkflowDef {
  id: string;
  name: string;
  pipeline: 'jujumon' | 'create' | 'tournament';
}

// Auto-build from config files so new workflows are picked up automatically
export const ALL_WORKFLOWS: WorkflowDef[] = [
  { id: 'jujumon_auto', name: 'JuJuMon (Auto-classify)', pipeline: 'jujumon' },
  ...WORKFLOW_CHOICES.map(w => ({ id: `create_${w.value}`, name: w.name, pipeline: 'create' as const })),
  ...TOURNAMENT_CHOICES.map(t => ({ id: `tournament_${t.value}`, name: t.name, pipeline: 'tournament' as const })),
];

export function getWorkflowDef(workflowId: string): WorkflowDef | undefined {
  return ALL_WORKFLOWS.find(w => w.id === workflowId);
}

function imagePathToDataUrl(imagePath: string): string {
  const buf = fs.readFileSync(imagePath);
  const ext = path.extname(imagePath).toLowerCase().replace('.', '');
  const mime = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
  return `data:${mime};base64,${buf.toString('base64')}`;
}

export interface TestInput {
  prompt?: string;
  imagePath?: string;
}

export interface TestOutput {
  imageBuffer: Buffer;
  metadata?: Record<string, any>;
}

export async function runWorkflow(workflowId: string, input: TestInput): Promise<TestOutput> {
  const def = getWorkflowDef(workflowId);
  if (!def) throw new Error(`Unknown workflow: ${workflowId}`);

  const imageUrl = input.imagePath ? imagePathToDataUrl(input.imagePath) : undefined;
  const prompt = input.prompt || undefined;

  if (!prompt && !imageUrl) {
    throw new Error('Test case must have at least prompt or image');
  }

  if (def.pipeline === 'jujumon') {
    const result = await runJujumonPipeline({ prompt, imageUrl: imageUrl || null });
    return { imageBuffer: result.imageBuffer, metadata: { category: result.category } };
  }

  if (def.pipeline === 'create') {
    const style = workflowId.replace('create_', '') as WorkflowType;
    const result = await runCreatePipeline({ style, prompt, imageUrl: imageUrl || null });
    return { imageBuffer: result.imageBuffer, metadata: { styleName: result.styleName } };
  }

  if (def.pipeline === 'tournament') {
    const template = workflowId.replace('tournament_', '') as TournamentTemplate;
    const result = await runTournamentPipeline({ template, prompt, imageUrl: imageUrl || null });
    return { imageBuffer: result.imageBuffer, metadata: { templateName: result.templateName } };
  }

  throw new Error(`Unhandled pipeline type: ${def.pipeline}`);
}
