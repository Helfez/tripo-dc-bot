import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import { runJujumonPipeline } from '../services/jujumonPipeline';
import { runCreatePipeline } from '../services/createPipeline';
import { runTournamentPipeline } from '../services/tournamentPipeline';
import { WorkflowType, WORKFLOW_CHOICES } from '../services/workflowConfig';
import { TournamentTemplate, TOURNAMENT_CHOICES } from '../services/tournamentConfig';

export interface WorkflowDef {
  id: string;
  name: string;
  pipeline: 'jujumon' | 'create' | 'tournament' | 'external';
}

const EXTERNAL_API_URL = 'http://test-middleware.juju-bit.com/proxy/c3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pbGF6eWZja3pmd/shop-toolbox-s/jujubit/9745/workflow/run';

const EXTERNAL_WORKFLOWS: WorkflowDef[] = [
  { id: 'ext_colorful_dragon', name: '彩色龙摆件', pipeline: 'external' },
  { id: 'ext_animal_head_scupld_bracelet', name: '动物头部手串', pipeline: 'external' },
  { id: 'ext_pets_birthday', name: '给小动物戴上生日帽', pipeline: 'external' },
  { id: 'ext_fantasy_biology_keycap', name: '华丽生物键帽', pipeline: 'external' },
  { id: 'ext_mushroom_universe', name: '蘑菇', pipeline: 'external' },
  { id: 'ext_pixar_style_arttoy', name: '皮克斯人偶', pipeline: 'external' },
  { id: 'ext_animals_on_the_sofa', name: '沙发生物键帽', pipeline: 'external' },
  { id: 'ext_liquid_dragon', name: '透色龙摆件', pipeline: 'external' },
  { id: 'ext_ashley_animal', name: 'Ashley Animal', pipeline: 'external' },
  { id: 'ext_dark_head_scupld', name: 'Fantasy Head Sculpt', pipeline: 'external' },
  { id: 'ext_funko_pop', name: 'Funko Pop', pipeline: 'external' },
  { id: 'ext_scenery_magsafe', name: 'MagSafe 城市旅行', pipeline: 'external' },
  { id: 'ext_astronaut', name: '宇航员', pipeline: 'external' },
  { id: 'ext_frog_arttoy', name: '青蛙 Art Toy', pipeline: 'external' },
  { id: 'ext_dessert_keycap', name: 'Sweet Keycap', pipeline: 'external' },
  { id: 'ext_chibi_figure_arttoy', name: '动森小人', pipeline: 'external' },
  { id: 'ext_jujumon_keycap', name: 'JuJuMon 键帽', pipeline: 'external' },
  { id: 'ext_jujumon_card', name: 'JuJuMon 卡牌', pipeline: 'external' },
  { id: 'ext_jujumon_clay', name: 'JuJuMon 萌版大眼睛', pipeline: 'external' },
  { id: 'ext_jujumon_trainer', name: 'JuJuMon Trainer', pipeline: 'external' },
  { id: 'ext_harry_fantasy', name: 'Harry Fantasy', pipeline: 'external' },
  { id: 'ext_DND_human', name: 'DND-Aetherra世界-用户角色生成', pipeline: 'external' },
  { id: 'ext_DND_creature', name: 'DND-Aetherra世界-生物生成', pipeline: 'external' },
];

// Auto-build from config files so new workflows are picked up automatically
export const ALL_WORKFLOWS: WorkflowDef[] = [
  { id: 'jujumon_auto', name: 'JuJuMon (Auto-classify)', pipeline: 'jujumon' },
  ...WORKFLOW_CHOICES.map(w => ({ id: `create_${w.value}`, name: w.name, pipeline: 'create' as const })),
  ...TOURNAMENT_CHOICES.map(t => ({ id: `tournament_${t.value}`, name: t.name, pipeline: 'tournament' as const })),
  ...EXTERNAL_WORKFLOWS,
];

export function getWorkflowDef(workflowId: string): WorkflowDef | undefined {
  return ALL_WORKFLOWS.find(w => w.id === workflowId);
}

function imagePathToDataUrl(imagePath: string): string {
  if (!fs.existsSync(imagePath)) {
    throw new Error(`Image file not found: ${imagePath}`);
  }
  const buf = fs.readFileSync(imagePath);
  const ext = path.extname(imagePath).toLowerCase().replace('.', '');
  const mime = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
  return `data:${mime};base64,${buf.toString('base64')}`;
}

async function resolveImageUrl(imagePath: string): Promise<string> {
  // S3 / remote URL — download and convert to data URL
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    const resp = await axios.get(imagePath, { responseType: 'arraybuffer' });
    const contentType = resp.headers['content-type'] || 'image/png';
    const b64 = Buffer.from(resp.data).toString('base64');
    return `data:${contentType};base64,${b64}`;
  }
  // Local file path
  return imagePathToDataUrl(imagePath);
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

  const imageUrl = input.imagePath ? await resolveImageUrl(input.imagePath) : undefined;
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

  if (def.pipeline === 'external') {
    return runExternalWorkflow(workflowId, input);
  }

  throw new Error(`Unhandled pipeline type: ${def.pipeline}`);
}

async function runExternalWorkflow(workflowId: string, input: TestInput): Promise<TestOutput> {
  // Strip the ext_ prefix to get the actual workflow name for the API
  const workflowName = workflowId.replace(/^ext_/, '');

  const inputs: Record<string, string> = {};
  if (input.prompt) inputs.prompt = input.prompt;

  // For image_url: use remote URL directly, convert local file to base64 data URL
  if (input.imagePath) {
    if (input.imagePath.startsWith('http://') || input.imagePath.startsWith('https://')) {
      inputs.image_url = input.imagePath;
    } else if (fs.existsSync(input.imagePath)) {
      inputs.image_url = imagePathToDataUrl(input.imagePath);
    }
  }

  const body = {
    name: workflowName,
    userId: '',
    callbackUrl: '',
    metadata: {},
    inputs,
  };

  const resp = await axios.post(EXTERNAL_API_URL, body, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 300_000,
  });

  const { code, data, success } = resp.data;
  if (code !== 200 || !success || data?.status !== 'succeeded') {
    const msg = data?.message || JSON.stringify(resp.data);
    throw new Error(`External API failed: ${msg}`);
  }

  const resultImageUrl: string = data.outputs?.data;
  if (!resultImageUrl) {
    throw new Error('External API returned no image URL');
  }

  // Download result image
  const imgResp = await axios.get(resultImageUrl, { responseType: 'arraybuffer', timeout: 30_000 });
  return { imageBuffer: Buffer.from(imgResp.data), metadata: { source: 'external', workflowName } };
}
