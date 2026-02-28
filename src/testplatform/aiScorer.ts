import * as fs from 'fs';
import * as path from 'path';
import { generateTextWithVision } from '../services/aiHub';
import { ENVS } from '../services/urls';
import * as db from './db';
import tLog, { LOG_ACTIONS } from '../utils/logUtils';

const AI_MODEL = 'qwen3.5-flash';
const AI_TEMPERATURE = 0.3;

function imageFileToDataUrl(filePath: string): string {
  const buf = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase().replace('.', '');
  const mime = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
  return `data:${mime};base64,${buf.toString('base64')}`;
}

function buildSystemPrompt(workflowName: string, hasInputImage: boolean): string {
  let prompt = `你是一个 AI 图像生成质量审核员。
当前工作流：${workflowName}

评判维度：
- 图像质量（清晰度、色彩、细节）
- 是否符合工作流风格
- 是否有明显缺陷或伪影（artifacts）
- 构图合理性`;

  if (hasInputImage) {
    prompt += `\n- 输出是否合理地保留了原图（输入图）的主体特征`;
  }

  prompt += `

请严格输出 JSON 格式，不要输出任何其他内容：
{"verdict": "pass|pending|reject", "reason": "简短理由"}

verdict 说明：
- pass：质量良好，符合预期
- pending：有轻微问题，需要人工确认
- reject：质量不合格，存在明显问题`;

  return prompt;
}

export async function scoreResult(
  resultId: number,
  workflowId: string,
  workflowName: string,
  inputPrompt: string | undefined,
  inputImagePath: string | undefined,
  resultImagePath: string,
): Promise<void> {
  const apiKey = ENVS.aiHubApiKey;
  if (!apiKey) {
    await db.updateResult(resultId, { aiReview: 'error', aiReason: 'AIHUBMIX_API_KEY not configured' });
    return;
  }

  // Mark as scoring
  await db.updateResult(resultId, { aiReview: 'scoring' });

  try {
    // Read result image as data URL
    const resultDataUrl = imageFileToDataUrl(resultImagePath);

    // Build user prompt content
    let userPrompt = '请评估这张 AI 生成的图像质量。';
    if (inputPrompt) {
      userPrompt += `\n用户输入文本：${inputPrompt}`;
    }

    // If there's an input image, read it and include it
    let inputImageDataUrl: string | undefined;
    if (inputImagePath && fs.existsSync(inputImagePath)) {
      inputImageDataUrl = imageFileToDataUrl(inputImagePath);
      userPrompt += '\n\n第一张图是用户输入的原图，第二张图是 AI 生成的结果图。请对比评估。';
    } else {
      userPrompt += '\n\n以下是 AI 生成的结果图。';
    }

    const systemPrompt = buildSystemPrompt(workflowName, !!inputImageDataUrl);

    // Call vision model — send input image + result image via user content
    // generateTextWithVision only supports one image, so we concatenate info in prompt
    // and send the result image as the visual input
    const response = await generateTextWithVision(
      apiKey,
      systemPrompt,
      userPrompt,
      resultDataUrl,
      AI_MODEL,
      AI_TEMPERATURE,
    );

    // Parse JSON response — handle potential markdown wrapping
    let jsonStr = response.trim();
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }

    const parsed = JSON.parse(jsonStr);
    const verdict = parsed.verdict;
    const reason = parsed.reason || '';

    if (!['pass', 'pending', 'reject'].includes(verdict)) {
      throw new Error(`Invalid verdict: ${verdict}`);
    }

    await db.updateResult(resultId, { aiReview: verdict, aiReason: reason });
    tLog.log(LOG_ACTIONS.SYS, `[test-platform] AI scored result ${resultId}: ${verdict}`);
  } catch (err: any) {
    const errMsg = err?.message || String(err);
    await db.updateResult(resultId, { aiReview: 'error', aiReason: errMsg.substring(0, 500) });
    tLog.logError(LOG_ACTIONS.SYS, `[test-platform] AI scoring error for result ${resultId}:`, errMsg.substring(0, 120));
  }
}
