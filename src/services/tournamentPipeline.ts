import {TOURNAMENT_CONFIG, TOURNAMENT_CHOICES, TournamentTemplate} from "./tournamentConfig";
import {generateTextWithVision, generateWithGemini} from "./aiHub";
import {ENVS} from "./urls";
import axios from "axios";
import tLog, {LOG_ACTIONS} from "../utils/logUtils";

export interface TournamentRequest {
  template: TournamentTemplate;
  prompt?: string;
  imageUrl?: string | null;
}

export interface GenerationCallbacks {
  onAnalyzing?: () => Promise<any> | void;
  onGenerating?: () => Promise<any> | void;
  onRefining?: () => Promise<any> | void;
}

export interface TournamentResult {
  imageBuffer: Buffer;
  templateName: string;
}

export async function runTournamentPipeline(
  request: TournamentRequest,
  callbacks?: GenerationCallbacks,
): Promise<TournamentResult> {
  const {template, prompt, imageUrl} = request;

  if (!prompt && !imageUrl) {
    throw new Error("At least one of prompt or imageUrl is required");
  }

  const apiKey = ENVS.aiHubApiKey;
  if (!apiKey) {
    throw new Error("Server config error: AIHUBMIX_API_KEY not set");
  }

  const config = TOURNAMENT_CONFIG[template];
  const templateName = TOURNAMENT_CHOICES.find(c => c.value === template)?.name || template;

  // Step 1: Semantic analysis
  await callbacks?.onAnalyzing?.();
  tLog.log(LOG_ACTIONS.SYS, `pipeline [${template}] step1: semantic analysis`);
  const generatedPrompt = await generateTextWithVision(
    apiKey,
    config.systemPrompt,
    prompt || '',
    imageUrl,
    config.visionModel,
  );
  tLog.log(LOG_ACTIONS.SYS, `pipeline [${template}] generated prompt:`, generatedPrompt.substring(0, 120));

  // Step 2: Image generation
  await callbacks?.onGenerating?.();
  const imagePrompt = (config.imagePromptPrefix || '') + generatedPrompt;
  tLog.log(LOG_ACTIONS.SYS, `pipeline [${template}] step2: image generation`);
  let resultImageUrl = await generateWithGemini(
    apiKey,
    imagePrompt,
    imageUrl,
    null,
    config.imageModel,
  );

  // Step 3 (optional): Refinement
  if (config.refinement) {
    await callbacks?.onRefining?.();
    tLog.log(LOG_ACTIONS.SYS, `pipeline [${template}] step3: refinement`);
    resultImageUrl = await generateWithGemini(
      apiKey,
      generatedPrompt,
      resultImageUrl,
      null,
      config.refinement.model,
    );
  }

  const resultBuffer = await imageToBuffer(resultImageUrl);
  tLog.logSuccess(LOG_ACTIONS.SYS, `pipeline [${template}] success`);
  return {imageBuffer: resultBuffer, templateName};
}

export async function imageToBuffer(imageUrlOrBase64: string): Promise<Buffer> {
  if (imageUrlOrBase64.startsWith('data:')) {
    const base64Data = imageUrlOrBase64.replace(/^data:image\/\w+;base64,/, "");
    return Buffer.from(base64Data, 'base64');
  }
  const res = await axios.get(imageUrlOrBase64, {responseType: 'arraybuffer', timeout: 30000});
  return Buffer.from(res.data);
}
