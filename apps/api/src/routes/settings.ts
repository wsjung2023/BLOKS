/**
 * 설정 API — API 키 관리 (로컬 전용)
 *
 * 보안 원칙:
 * - localhost (127.0.0.1 / ::1) 에서만 접근 허용
 * - GET: 키가 "설정됨/미설정" 여부만 반환 (실제 값 절대 노출 안 함)
 * - POST: .env 파일에 저장 (외부 서버 전송 없음)
 * - 키 형식 검증 후 저장
 */

import type { Request, Response } from "express";
import { Router } from "express";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const ENV_PATH = resolve(ROOT, ".env");

function requireLocalhost(req: Request, res: Response): boolean {
  const ip = req.socket.remoteAddress ?? "";
  const isLocal = ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1";
  if (!isLocal) {
    res.status(403).json({ ok: false, error: { code: "FORBIDDEN", message: "이 기능은 내 PC에서만 사용할 수 있습니다." } });
    return false;
  }
  return true;
}

function readEnv(): Record<string, string> {
  if (!existsSync(ENV_PATH)) return {};
  const result: Record<string, string> = {};
  for (const line of readFileSync(ENV_PATH, "utf-8").split(/\r?\n/)) {
    const m = line.match(/^([^#\s][^=]*)=(.*)/);
    if (m) result[m[1]!.trim()] = m[2]!.trim();
  }
  return result;
}

function writeEnv(vars: Record<string, string>): void {
  const existing = existsSync(ENV_PATH) ? readFileSync(ENV_PATH, "utf-8") : "";
  const lines = existing.split(/\r?\n/);
  for (const [key, value] of Object.entries(vars)) {
    const idx = lines.findIndex((l) => l.match(new RegExp(`^${key}=`)));
    if (idx >= 0) {
      lines[idx] = `${key}=${value}`;
    } else {
      lines.push(`${key}=${value}`);
    }
  }
  writeFileSync(ENV_PATH, lines.filter((l, i) => l !== "" || i < lines.length - 1).join("\n") + "\n", "utf-8");
}

// 지원하는 API 키 목록 (프런트에 표시할 메타 포함)
const KEY_DEFS = [
  {
    key: "OPENAI_API_KEY",
    label: "OpenAI (ChatGPT 제작사)",
    description: "글쓰기, 코딩, 이미지 생성에 사용됩니다. 가장 기본적인 키입니다.",
    costNote: "사용한 만큼만 — 가볍게 쓰면 월 1~3달러 수준",
    isFree: false,
    getUrl: "https://platform.openai.com/api-keys",
    prefix: "sk-",
    group: "text",
  },
  {
    key: "ANTHROPIC_API_KEY",
    label: "Anthropic (Claude 제작사)",
    description: "Claude AI를 사용해 더 긴 문서나 분석 작업에 활용됩니다.",
    costNote: "사용한 만큼만 — OpenAI와 비슷한 수준",
    isFree: false,
    getUrl: "https://console.anthropic.com",
    prefix: "sk-ant-",
    group: "text",
  },
  {
    key: "GOOGLE_AI_API_KEY",
    label: "Google AI (Gemini 제작사)",
    description: "Google Gemini AI를 사용합니다. 무료 사용량이 있습니다.",
    costNote: "무료 플랜 있음 (월 일정량 무료)",
    isFree: true,
    getUrl: "https://aistudio.google.com/app/apikey",
    prefix: "AIza",
    group: "text",
  },
  {
    key: "TAVILY_API_KEY",
    label: "Tavily (실시간 웹 검색)",
    description: "AI가 인터넷에서 최신 정보를 찾아 결과물에 반영합니다. 없어도 동작하지만 있으면 훨씬 정확해집니다.",
    costNote: "무료 플랜 있음 (월 1,000회 무료)",
    isFree: true,
    getUrl: "https://app.tavily.com",
    prefix: "tvly-",
    group: "search",
  },
  {
    key: "KIE_AI_API_KEY",
    label: "KIE.AI (영상 생성)",
    description: "영상·릴스·쇼츠·유튜브 영상을 AI로 만들 때 사용합니다.",
    costNote: "5초 영상 1개당 약 300~600원 수준",
    isFree: false,
    getUrl: "https://kie.ai",
    prefix: "",
    group: "video",
  },
  {
    key: "STABILITY_API_KEY",
    label: "Stability AI (아트/일러스트 이미지)",
    description: "그림체·일러스트 스타일 이미지 생성에 사용합니다. OpenAI 키만 있어도 이미지는 생성됩니다.",
    costNote: "사용한 만큼만",
    isFree: false,
    getUrl: "https://platform.stability.ai",
    prefix: "sk-",
    group: "image",
  },
  {
    key: "FAL_KEY",
    label: "fal.ai (FLUX 이미지)",
    description: "빠르고 고품질 이미지 생성. OpenAI 키만 있어도 이미지는 생성됩니다.",
    costNote: "사용한 만큼만",
    isFree: false,
    getUrl: "https://fal.ai/dashboard/keys",
    prefix: "",
    group: "image",
  },
  {
    key: "IDEOGRAM_API_KEY",
    label: "Ideogram (텍스트 포함 이미지)",
    description: "포스터처럼 글자가 들어간 이미지를 잘 만드는 AI입니다.",
    costNote: "사용한 만큼만",
    isFree: false,
    getUrl: "https://ideogram.ai/manage-api",
    prefix: "",
    group: "image",
  },
] as const;

export const settingsRouter = Router();

// GET /api/v1/settings/api-keys — 설정 상태 반환 (실제 키 값 노출 안 함)
settingsRouter.get("/api-keys", (req, res) => {
  if (!requireLocalhost(req, res)) return;

  const env = readEnv();
  const status = KEY_DEFS.map((def) => {
    const val = env[def.key] ?? process.env[def.key] ?? "";
    return {
      key: def.key,
      label: def.label,
      description: def.description,
      costNote: def.costNote,
      isFree: def.isFree,
      getUrl: def.getUrl,
      group: def.group,
      isSet: val.length > 0,
      // prefix hint — 예: "sk-pr..." 형태로 앞 6자만 (보안상 나머지는 *)
      hint: val.length > 0 ? val.slice(0, 6) + "****" : "",
    };
  });

  res.json({ ok: true, data: status });
});

// POST /api/v1/settings/api-keys — 키 저장
settingsRouter.post("/api-keys", (req: Request, res: Response) => {
  if (!requireLocalhost(req, res)) return;

  const { key, value } = req.body as { key?: string; value?: string };

  if (!key || typeof key !== "string") {
    res.status(400).json({ ok: false, error: { code: "BAD_REQUEST", message: "key가 필요합니다." } });
    return;
  }

  const def = KEY_DEFS.find((d) => d.key === key);
  if (!def) {
    res.status(400).json({ ok: false, error: { code: "UNKNOWN_KEY", message: `알 수 없는 키: ${key}` } });
    return;
  }

  // 빈 값 = 키 삭제
  if (!value || value.trim() === "") {
    writeEnv({ [key]: "" });
    // 실제로는 빈 값으로 저장 (삭제 처리)
    res.json({ ok: true, data: { key, isSet: false } });
    return;
  }

  const trimmed = value.trim();

  // prefix 검증 (prefix가 정의된 경우만)
  if (def.prefix && !trimmed.startsWith(def.prefix)) {
    res.status(400).json({
      ok: false,
      error: {
        code: "INVALID_FORMAT",
        message: `${def.label} 키는 "${def.prefix}"로 시작해야 합니다. 키를 다시 확인해주세요.`,
      },
    });
    return;
  }

  writeEnv({ [key]: trimmed });
  process.env[key] = trimmed;

  res.json({ ok: true, data: { key, isSet: true, hint: trimmed.slice(0, 6) + "****" } });
});
