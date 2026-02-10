import axios from "axios";
import tLog, {LOG_ACTIONS} from "../utils/logUtils";

const AIHUBMIX_BASE = "https://aihubmix.com";

export type ClassifyCategory = 'human' | 'creature' | 'human_creature';

export interface ClassifyResult {
  category: ClassifyCategory;
  reasoning: string;
}

const CLASSIFY_SYSTEM_PROMPT = `You are a visual classifier. Analyze the user's input (image and/or text) and determine the subject:
- "human": The subject is a human (person, portrait, character based on a real person)
- "creature": The subject is a non-human creature (animal, monster, pet, fantasy beast)
- "human_creature": The subject contains both a human AND a creature together

Respond in JSON only: {"category": "human|creature|human_creature", "reasoning": "brief explanation"}`;

/**
 * Classify user input (image and/or text) into human, creature, or human_creature
 * using Gemini text model via AIHubMix.
 */
export async function classifyInput(
  apiKey: string,
  imageUrl?: string | null,
  prompt?: string | null,
): Promise<ClassifyResult> {
  const content: any[] = [];

  if (prompt) {
    content.push({ type: "text", text: prompt });
  }

  if (imageUrl) {
    content.push({ type: "image_url", image_url: { url: imageUrl } });
  }

  if (content.length === 0) {
    throw new Error("classifyInput requires at least an image or text prompt");
  }

  const payload = {
    model: "gemini-3-pro-preview",
    messages: [
      { role: "system", content: CLASSIFY_SYSTEM_PROMPT },
      { role: "user", content },
    ],
    temperature: 0.3,
  };

  tLog.log(LOG_ACTIONS.SYS, "AI Router classify request model:", payload.model);

  const res = await axios.post(`${AIHUBMIX_BASE}/v1/chat/completions`, payload, {
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    timeout: 60000,
  });

  const message = res.data.choices?.[0]?.message;
  if (!message?.content) throw new Error("AI Router: empty response from classifier");

  // Parse JSON from response (may be wrapped in markdown code fences)
  let raw = message.content.trim();
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    raw = fenceMatch[1].trim();
  }

  const parsed = JSON.parse(raw);
  const category = parsed.category as string;

  if (!['human', 'creature', 'human_creature'].includes(category)) {
    throw new Error(`AI Router: unexpected category "${category}"`);
  }

  return {
    category: category as ClassifyCategory,
    reasoning: parsed.reasoning || '',
  };
}
