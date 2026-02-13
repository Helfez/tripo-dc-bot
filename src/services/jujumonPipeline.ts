import {classifyInput, ClassifyCategory} from "./aiRouter";
import {generateWithGemini} from "./aiHub";
import {ENVS} from "./urls";
import tLog, {LOG_ACTIONS} from "../utils/logUtils";
import {imageToBuffer} from "./tournamentPipeline";
import {CREATURE_STYLE_PROMPT, HUMAN_STEP1_PROMPT, HUMAN_STEP2_PROMPT} from "./createPipeline";

export interface JujumonRequest {
  prompt?: string;
  imageUrl?: string | null;
}

export interface JujumonCallbacks {
  onClassifying?: () => Promise<any> | void;
  onGenerating?: (category: ClassifyCategory) => Promise<any> | void;
}

export interface JujumonResult {
  imageBuffer: Buffer;
  category: ClassifyCategory;
}

export async function runJujumonPipeline(
  request: JujumonRequest,
  callbacks?: JujumonCallbacks,
): Promise<JujumonResult> {
  const {prompt, imageUrl} = request;

  if (!prompt && !imageUrl) {
    throw new Error("At least one of prompt or imageUrl is required");
  }

  const apiKey = ENVS.aiHubApiKey;
  if (!apiKey) {
    throw new Error("Server config error: AIHUBMIX_API_KEY not set");
  }

  // Step 1: Classify input
  await callbacks?.onClassifying?.();
  tLog.log(LOG_ACTIONS.SYS, 'pipeline jujumon classifying', prompt || '(no prompt)', imageUrl ? '(has image)' : '(no image)');
  const classResult = await classifyInput(apiKey, imageUrl, prompt);
  tLog.logSuccess(LOG_ACTIONS.SYS, 'pipeline jujumon classified', classResult.category);

  await callbacks?.onGenerating?.(classResult.category);

  let resultImageUrl: string;

  // --- Creature workflow ---
  if (classResult.category === 'creature') {
    let finalPrompt: string;
    if (imageUrl && prompt) {
      finalPrompt = `[主体]\n${prompt}\n\n[任务指令]\n请严格按照主体描述，结合图片参考，以下面的风格绘制。必须保留主体的物种特征和外观。\n\n[风格约束]\n${CREATURE_STYLE_PROMPT}`;
    } else if (imageUrl) {
      finalPrompt = `[任务指令]\n请将图片中的生物主体，以下面的风格重新绘制。严格保留原图生物的物种、体型特征、毛色/皮肤颜色和姿势。\n\n[风格约束]\n${CREATURE_STYLE_PROMPT}`;
    } else {
      finalPrompt = `[主体]\n请绘制：${prompt}。必须清晰体现"${prompt}"的物种外观特征（体型、耳朵、尾巴、毛色等）。\n\n[风格约束]\n${CREATURE_STYLE_PROMPT}`;
    }

    tLog.log(LOG_ACTIONS.SYS, 'pipeline jujumon creature generating');
    resultImageUrl = await generateWithGemini(apiKey, finalPrompt, imageUrl);
  }
  // --- Human workflow ---
  else if (classResult.category === 'human') {
    let step2InputUrl: string | null = imageUrl || null;

    // Real photo → Step 1: convert to 2D Ken Sugimori style first
    if (imageUrl && classResult.isRealPhoto) {
      tLog.log(LOG_ACTIONS.SYS, 'pipeline jujumon human step1: real photo → 2D');
      const step1Prompt = prompt
        ? `${HUMAN_STEP1_PROMPT}\n\n[补充描述]\n${prompt}`
        : HUMAN_STEP1_PROMPT;
      const step1Result = await generateWithGemini(apiKey, step1Prompt, imageUrl);
      const step1Buffer = await imageToBuffer(step1Result);
      step2InputUrl = `data:image/png;base64,${step1Buffer.toString('base64')}`;
      tLog.logSuccess(LOG_ACTIONS.SYS, 'pipeline jujumon human step1 done');
    }

    // Step 2: generate PVC statue
    tLog.log(LOG_ACTIONS.SYS, 'pipeline jujumon human step2: → PVC statue');
    let step2Prompt: string;
    if (step2InputUrl) {
      step2Prompt = prompt
        ? `${HUMAN_STEP2_PROMPT}\n\n[补充描述]\n${prompt}`
        : HUMAN_STEP2_PROMPT;
    } else {
      step2Prompt = `[主体]\n${prompt}\n\n${HUMAN_STEP2_PROMPT}`;
    }

    resultImageUrl = await generateWithGemini(apiKey, step2Prompt, step2InputUrl);
  }
  // --- Human + Creature: not yet supported, fall back to creature ---
  else {
    tLog.log(LOG_ACTIONS.SYS, 'pipeline jujumon human_creature → fallback to creature');
    let finalPrompt: string;
    if (imageUrl && prompt) {
      finalPrompt = `[主体]\n${prompt}\n\n[任务指令]\n请严格按照主体描述，结合图片参考，以下面的风格绘制。必须保留主体的物种特征和外观。\n\n[风格约束]\n${CREATURE_STYLE_PROMPT}`;
    } else if (imageUrl) {
      finalPrompt = `[任务指令]\n请将图片中的生物主体，以下面的风格重新绘制。严格保留原图生物的物种、体型特征、毛色/皮肤颜色和姿势。\n\n[风格约束]\n${CREATURE_STYLE_PROMPT}`;
    } else {
      finalPrompt = `[主体]\n请绘制：${prompt}。必须清晰体现"${prompt}"的物种外观特征（体型、耳朵、尾巴、毛色等）。\n\n[风格约束]\n${CREATURE_STYLE_PROMPT}`;
    }

    tLog.log(LOG_ACTIONS.SYS, 'pipeline jujumon human_creature generating');
    resultImageUrl = await generateWithGemini(apiKey, finalPrompt, imageUrl);
  }

  const resultBuffer = await imageToBuffer(resultImageUrl);
  tLog.logSuccess(LOG_ACTIONS.SYS, `pipeline jujumon [${classResult.category}] success`);
  return {imageBuffer: resultBuffer, category: classResult.category};
}
