// Image generation — multi-provider with auto-fallback based on available API keys
import OpenAI from "openai";

export interface ImageGenRequest {
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  quality?: "standard" | "hd";
  style?: "vivid" | "natural";
  n?: number;
  /** Force a specific provider; omit to auto-select from available API keys */
  provider?: "openai" | "google" | "stability" | "fal" | "ideogram";
}

export interface ImageGenResult {
  ok: boolean;
  provider: string;
  modelUsed: string;
  imageUrl?: string;
  imageBase64?: string;
  mimeType: string;
  costUsdEstimate: number;
  errorCode?: string;
}

// ── Size helpers ──────────────────────────────────────────────────────────────

function openAISize(w?: number, h?: number): "1024x1024" | "1792x1024" | "1024x1792" {
  if (w && h && w > h) return "1792x1024";
  if (w && h && h > w) return "1024x1792";
  return "1024x1024";
}

function falSize(w?: number, h?: number): string {
  if (w && h && w > h) return "landscape_16_9";
  if (w && h && h > w) return "portrait_16_9";
  return "square_hd";
}

// ── Provider implementations ──────────────────────────────────────────────────

async function withOpenAI(req: ImageGenRequest): Promise<ImageGenResult> {
  const apiKey = process.env["OPENAI_API_KEY"];
  if (!apiKey) return noKey("openai", "gpt-image-1");

  const client = new OpenAI({ apiKey });
  const size = openAISize(req.width, req.height);
  const n = req.n ?? 1;

  try {
    // Prefer gpt-image-1 (higher quality, native base64)
    const res = await client.images.generate({
      model: "gpt-image-1",
      prompt: req.prompt,
      n,
      size,
    });
    const imageBase64 = res.data?.[0]?.b64_json;
    const imageUrl = res.data?.[0]?.url;
    return {
      ok: !!(imageBase64 || imageUrl),
      provider: "openai",
      modelUsed: "gpt-image-1",
      ...(imageBase64 ? { imageBase64 } : {}),
      ...(imageUrl ? { imageUrl } : {}),
      mimeType: "image/png",
      costUsdEstimate: 0.04 * n,
    };
  } catch {
    // Fall back to DALL-E 3
    const dall3Size = size === "1024x1024" ? "1024x1024" : size === "1792x1024" ? "1792x1024" : "1024x1792";
    const res = await client.images.generate({
      model: "dall-e-3",
      prompt: req.prompt,
      n: 1,
      size: dall3Size,
      quality: req.quality === "hd" ? "hd" : "standard",
      style: req.style ?? "vivid",
      response_format: "url",
    });
    const imageUrl = res.data?.[0]?.url;
    return {
      ok: !!imageUrl,
      provider: "openai",
      modelUsed: "dall-e-3",
      ...(imageUrl ? { imageUrl } : {}),
      mimeType: "image/png",
      costUsdEstimate: req.quality === "hd" ? 0.08 : 0.04,
    };
  }
}

async function withGoogle(req: ImageGenRequest): Promise<ImageGenResult> {
  const apiKey = process.env["GOOGLE_AI_API_KEY"];
  if (!apiKey) return noKey("google", "imagen-3.0");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict?key=${apiKey}`;
  const body = {
    instances: [{ prompt: req.prompt }],
    parameters: { sampleCount: req.n ?? 1 },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.warn("[image-gen] google failed:", res.status, detail.slice(0, 200));
    return providerError("google", "imagen-3.0");
  }

  const data = await res.json() as { predictions?: Array<{ bytesBase64Encoded?: string; mimeType?: string }> };
  const pred = data.predictions?.[0];
  return {
    ok: !!pred?.bytesBase64Encoded,
    provider: "google",
    modelUsed: "imagen-3.0-generate-001",
    ...(pred?.bytesBase64Encoded ? { imageBase64: pred.bytesBase64Encoded } : {}),
    mimeType: pred?.mimeType ?? "image/png",
    costUsdEstimate: 0.04 * (req.n ?? 1),
  };
}

async function withStability(req: ImageGenRequest): Promise<ImageGenResult> {
  const apiKey = process.env["STABILITY_API_KEY"];
  if (!apiKey) return noKey("stability", "sd3.5");

  const form = new FormData();
  form.append("prompt", req.prompt);
  if (req.negativePrompt) form.append("negative_prompt", req.negativePrompt);
  form.append("model", "sd3.5-large");
  form.append("output_format", "png");

  const res = await fetch("https://api.stability.ai/v2beta/stable-image/generate/sd3", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, Accept: "image/*" },
    body: form,
  });

  if (!res.ok) {
    console.warn("[image-gen] stability failed:", res.status);
    return providerError("stability", "sd3.5");
  }

  const buffer = await res.arrayBuffer();
  const imageBase64 = Buffer.from(buffer).toString("base64");
  return {
    ok: true,
    provider: "stability",
    modelUsed: "stable-diffusion-3.5-large",
    imageBase64,
    mimeType: "image/png",
    costUsdEstimate: 0.035,
  };
}

async function withFal(req: ImageGenRequest): Promise<ImageGenResult> {
  const apiKey = process.env["FAL_KEY"];
  if (!apiKey) return noKey("fal", "flux-pro");

  const res = await fetch("https://fal.run/fal-ai/flux-pro", {
    method: "POST",
    headers: { Authorization: `Key ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: req.prompt,
      image_size: falSize(req.width, req.height),
      num_images: req.n ?? 1,
      enable_safety_checker: false,
    }),
  });

  if (!res.ok) {
    console.warn("[image-gen] fal failed:", res.status);
    return providerError("fal", "flux-pro");
  }

  const data = await res.json() as { images?: Array<{ url?: string }> };
  const imageUrl = data.images?.[0]?.url;
  return {
    ok: !!imageUrl,
    provider: "fal",
    modelUsed: "flux-1-pro",
    ...(imageUrl ? { imageUrl } : {}),
    mimeType: "image/jpeg",
    costUsdEstimate: 0.05 * (req.n ?? 1),
  };
}

async function withIdeogram(req: ImageGenRequest): Promise<ImageGenResult> {
  const apiKey = process.env["IDEOGRAM_API_KEY"];
  if (!apiKey) return noKey("ideogram", "ideogram-v3");

  const res = await fetch("https://api.ideogram.ai/v1/ideogram-v3/generate", {
    method: "POST",
    headers: { "Api-Key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: req.prompt,
      negative_prompt: req.negativePrompt,
      rendering_speed: "DEFAULT",
      num_images: req.n ?? 1,
    }),
  });

  if (!res.ok) {
    console.warn("[image-gen] ideogram failed:", res.status);
    return providerError("ideogram", "ideogram-v3");
  }

  const data = await res.json() as { data?: Array<{ url?: string }> };
  const imageUrl = data.data?.[0]?.url;
  return {
    ok: !!imageUrl,
    provider: "ideogram",
    modelUsed: "ideogram-v3",
    ...(imageUrl ? { imageUrl } : {}),
    mimeType: "image/jpeg",
    costUsdEstimate: 0.08 * (req.n ?? 1),
  };
}

// ── Error helpers ─────────────────────────────────────────────────────────────

function noKey(provider: string, modelUsed: string): ImageGenResult {
  return { ok: false, provider, modelUsed, mimeType: "image/png", costUsdEstimate: 0, errorCode: "NO_API_KEY" };
}

function providerError(provider: string, modelUsed: string): ImageGenResult {
  return { ok: false, provider, modelUsed, mimeType: "image/png", costUsdEstimate: 0, errorCode: "PROVIDER_ERROR" };
}

// ── Provider auto-selection ───────────────────────────────────────────────────

const PROVIDER_PRIORITY = ["openai", "google", "stability", "fal", "ideogram"] as const;
type ProviderKey = (typeof PROVIDER_PRIORITY)[number];

const PROVIDER_ENV: Record<ProviderKey, string> = {
  openai: "OPENAI_API_KEY",
  google: "GOOGLE_AI_API_KEY",
  stability: "STABILITY_API_KEY",
  fal: "FAL_KEY",
  ideogram: "IDEOGRAM_API_KEY",
};

const PROVIDER_FN: Record<ProviderKey, (req: ImageGenRequest) => Promise<ImageGenResult>> = {
  openai: withOpenAI,
  google: withGoogle,
  stability: withStability,
  fal: withFal,
  ideogram: withIdeogram,
};

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Generate an image using the best available provider.
 * Auto-selects based on which API keys are set in the environment.
 * Provider priority: openai → google → stability → fal → ideogram
 */
export async function generateImage(request: ImageGenRequest): Promise<ImageGenResult> {
  const order: ProviderKey[] = request.provider
    ? [request.provider]
    : PROVIDER_PRIORITY.filter((p) => !!process.env[PROVIDER_ENV[p]]);

  if (order.length === 0) {
    return { ok: false, provider: "none", modelUsed: "", mimeType: "image/png", costUsdEstimate: 0, errorCode: "NO_PROVIDER_AVAILABLE" };
  }

  for (const providerName of order) {
    try {
      const result = await PROVIDER_FN[providerName](request);
      if (result.ok) return result;
    } catch (err) {
      console.warn(`[image-gen] ${providerName} threw:`, err instanceof Error ? err.message : err);
    }
  }

  return { ok: false, provider: "none", modelUsed: "", mimeType: "image/png", costUsdEstimate: 0, errorCode: "ALL_PROVIDERS_FAILED" };
}

export function listAvailableImageProviders(): ProviderKey[] {
  return PROVIDER_PRIORITY.filter((p) => !!process.env[PROVIDER_ENV[p]]);
}
