import axios from "axios";
import tLog, {LOG_ACTIONS} from "../utils/logUtils";

const AIHUBMIX_BASE = "https://aihubmix.com";

interface GeminiImagePart {
  url?: string;
  inline_data?: { data: string };
}

/**
 * Generate image using Gemini multimodal model via AIHubMix.
 * Supports img2img (with primaryImageUrl) and style-guided generation (with styleImageUrl).
 * Returns an image URL or base64 data URL.
 */
export async function generateWithGemini(
  apiKey: string,
  prompt: string,
  primaryImageUrl?: string | null,
  styleImageUrl?: string | null,
): Promise<string> {
  const content: any[] = [
    { type: "text", text: prompt }
  ];

  if (primaryImageUrl) {
    content.push({ type: "image_url", image_url: { url: primaryImageUrl } });
  }

  if (styleImageUrl) {
    content.push({ type: "image_url", image_url: { url: styleImageUrl } });
  }

  const payload = {
    model: "gemini-3-pro-image-preview",
    messages: [
      {
        role: "user",
        content
      }
    ],
    modalities: ["text", "image"],
    temperature: 0.7
  };

  tLog.log(LOG_ACTIONS.SYS, "Gemini request model:", payload.model);

  const res = await axios.post(`${AIHUBMIX_BASE}/v1/chat/completions`, payload, {
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    timeout: 300000,
  });

  const message = res.data.choices?.[0]?.message;
  if (!message) throw new Error("Gemini response missing message field");

  // 1. Try new images field (LiteLLM/OpenAI compatible)
  if (message.images && Array.isArray(message.images) && message.images.length > 0) {
    const imgObj = message.images[0] as GeminiImagePart;
    if (imgObj.url) return imgObj.url;
  }

  // 2. Try multi_mod_content (legacy Gemini format)
  let imageBase64: string | null = null;
  if (message.multi_mod_content && Array.isArray(message.multi_mod_content)) {
    for (const part of message.multi_mod_content as GeminiImagePart[]) {
      if (part.inline_data?.data) {
        imageBase64 = part.inline_data.data;
        break;
      }
    }
  }

  // 3. Fallback: content itself might be base64
  if (!imageBase64 && message.content && message.content.length > 1000 && !message.content.includes(' ')) {
    imageBase64 = message.content;
  }

  if (!imageBase64) {
    throw new Error("No image data in Gemini response. Model may have returned text only: " + (message.content || "").substring(0, 100));
  }

  return `data:image/png;base64,${imageBase64}`;
}

/**
 * Generate image using Doubao (seedream) model via AIHubMix.
 * Text-to-image generation, returns image URL.
 */
export async function generateWithDoubao(
  apiKey: string,
  prompt: string,
  imageUrl?: string | null,
): Promise<string> {
  const inputPayload: any = {
    prompt,
    size: "1024x1024",
    sequential_image_generation: "disabled",
    stream: false,
    response_format: "url",
    watermark: false,
  };

  if (imageUrl) {
    inputPayload.image_url = imageUrl;
  }

  const res = await axios.post(
    `${AIHUBMIX_BASE}/v1/models/doubao/doubao-seedream-4-0-250828/predictions`,
    { input: inputPayload },
    {
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      timeout: 300000,
    }
  );

  const data = res.data;
  let rawOutput = Array.isArray(data.output) ? data.output[0] : (data.output || data.url);
  const url = (typeof rawOutput === 'object' && rawOutput?.url) ? rawOutput.url : rawOutput;

  if (!url) throw new Error("No image URL in Doubao generation response");
  return url;
}
