// Video generation — KIE.AI unified API (Kling, Seedance, Veo)
// Async: submits task → polls until done (or timeout)

export interface VideoGenRequest {
  prompt: string;
  aspectRatio?: "16:9" | "9:16" | "1:1";
  duration?: "5" | "10";
  sound?: boolean;
  /** Force a specific model; omit to auto-select */
  model?: "kling-2.6" | "seedance-2.0" | "veo3";
}

export interface VideoGenResult {
  ok: boolean;
  provider: string;
  modelUsed: string;
  videoUrl?: string;
  taskId?: string;
  costUsdEstimate: number;
  errorCode?: string;
}

const KIE_BASE = "https://api.kie.ai/api/v1";
const POLL_INTERVAL_MS = 8_000;
const POLL_TIMEOUT_MS = 180_000; // 3분

const MODEL_MAP: Record<string, string> = {
  "kling-2.6":   "kling-2.6/text-to-video",
  "seedance-2.0": "seedance-2.0/text-to-video",
  "veo3":         "veo3/text-to-video",
};

// Cost estimates per video (5s)
const COST_MAP: Record<string, number> = {
  "kling-2.6":   0.28,
  "seedance-2.0": 0.25,
  "veo3":         0.50,
};

async function createTask(apiKey: string, modelKey: string, req: VideoGenRequest): Promise<string | null> {
  const model = MODEL_MAP[modelKey];
  if (!model) return null;

  const res = await fetch(`${KIE_BASE}/jobs/createTask`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: {
        prompt: req.prompt,
        aspect_ratio: req.aspectRatio ?? "16:9",
        duration: req.duration ?? "5",
        sound: req.sound ?? false,
      },
    }),
  });

  if (!res.ok) {
    console.warn(`[video-gen] createTask ${res.status}`);
    return null;
  }

  const data = await res.json() as { code?: number; data?: { taskId?: string } };
  if (data.code !== 200 || !data.data?.taskId) {
    console.warn("[video-gen] unexpected createTask response", data);
    return null;
  }

  return data.data.taskId;
}

async function pollUntilDone(apiKey: string, taskId: string): Promise<string | null> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    const res = await fetch(`${KIE_BASE}/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`, {
      headers: { "Authorization": `Bearer ${apiKey}` },
    });

    if (!res.ok) {
      console.warn(`[video-gen] poll ${res.status}`);
      continue;
    }

    const body = await res.json() as {
      code?: number;
      data?: {
        state?: string;
        resultJson?: string;
        failCode?: string | null;
        failMsg?: string | null;
      };
    };

    const d = body.data;
    if (!d) continue;

    if (d.state === "success") {
      try {
        const result = JSON.parse(d.resultJson ?? "{}") as { resultUrls?: string[] };
        return result.resultUrls?.[0] ?? null;
      } catch {
        return null;
      }
    }
    if (d.state === "fail") {
      console.warn("[video-gen] task failed:", d.failCode, d.failMsg);
      return null;
    }
    // wait | queueing | generating → keep polling
    console.log(`[video-gen] state=${d.state}, waiting...`);
  }

  console.warn("[video-gen] poll timeout");
  return null;
}

// ── Public API ─────────────────────────────────────────────────────────────────

export async function generateVideo(request: VideoGenRequest): Promise<VideoGenResult> {
  const apiKey = process.env["KIE_AI_API_KEY"];
  if (!apiKey) {
    return { ok: false, provider: "kie.ai", modelUsed: "", costUsdEstimate: 0, errorCode: "NO_API_KEY" };
  }

  // 모델 선택: 명시 > 기본값 kling-2.6
  const modelKey = request.model ?? "kling-2.6";

  let taskId: string | null = null;
  try {
    taskId = await createTask(apiKey, modelKey, request);
  } catch (err) {
    console.error("[video-gen] createTask threw:", err);
    return { ok: false, provider: "kie.ai", modelUsed: modelKey, costUsdEstimate: 0, errorCode: "CREATE_FAILED" };
  }

  if (!taskId) {
    return { ok: false, provider: "kie.ai", modelUsed: modelKey, costUsdEstimate: 0, errorCode: "NO_TASK_ID" };
  }

  let videoUrl: string | null = null;
  try {
    videoUrl = await pollUntilDone(apiKey, taskId);
  } catch (err) {
    console.error("[video-gen] poll threw:", err);
    return { ok: false, provider: "kie.ai", modelUsed: modelKey, taskId, costUsdEstimate: 0, errorCode: "POLL_FAILED" };
  }

  if (!videoUrl) {
    return { ok: false, provider: "kie.ai", modelUsed: modelKey, taskId, costUsdEstimate: 0, errorCode: "GENERATION_FAILED" };
  }

  return {
    ok: true,
    provider: "kie.ai",
    modelUsed: modelKey,
    taskId,
    videoUrl,
    costUsdEstimate: COST_MAP[modelKey] ?? 0.30,
  };
}
