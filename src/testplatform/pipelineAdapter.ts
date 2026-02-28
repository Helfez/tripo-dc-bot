import * as fs from 'fs';
import * as path from 'path';
import { runJujumonPipeline } from '../services/jujumonPipeline';
import { runCreatePipeline } from '../services/createPipeline';
import { runTournamentPipeline } from '../services/tournamentPipeline';
import { WorkflowType } from '../services/workflowConfig';
import { TournamentTemplate } from '../services/tournamentConfig';

export interface WorkflowDef {
  id: string;
  name: string;
  pipeline: 'jujumon' | 'create' | 'tournament';
}

export const ALL_WORKFLOWS: WorkflowDef[] = [
  // JuJuMon pipeline
  { id: 'jujumon_auto', name: 'JuJuMon (Auto-classify)', pipeline: 'jujumon' },
  // Create pipeline
  { id: 'create_board_game', name: 'TRPG Style', pipeline: 'create' },
  { id: 'create_chibi', name: 'Chibi Style', pipeline: 'create' },
  { id: 'create_scale_1_7', name: '1:7 Figure Style', pipeline: 'create' },
  { id: 'create_creative', name: 'Creative Style', pipeline: 'create' },
  { id: 'create_jujumon_creature', name: 'JuJuMon Creature', pipeline: 'create' },
  { id: 'create_jujumon_trainer', name: 'JuJuMon Trainer', pipeline: 'create' },
  // Tournament pipeline
  { id: 'tournament_liquid_dragon', name: 'Liquid Dragon', pipeline: 'tournament' },
  { id: 'tournament_harry_sculpt', name: 'Head Sculpt Harry', pipeline: 'tournament' },
  { id: 'tournament_foods_cc', name: 'Foods CC', pipeline: 'tournament' },
  { id: 'tournament_animal_ashley', name: 'Animal Ashley', pipeline: 'tournament' },
  { id: 'tournament_funko_pop', name: 'Funko Pop', pipeline: 'tournament' },
  { id: 'tournament_animal_beads', name: 'Animal Beads', pipeline: 'tournament' },
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
