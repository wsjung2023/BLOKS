/**
 * POST /api/demo/execute/[scenario]
 *
 * 시나리오에서 생성된 프로그램을 실제로 실행합니다.
 * - program: FastAPI 서버를 uvicorn으로 실행 (포트 8001)
 * - homepage: 정적 HTML — 별도 실행 불필요 (iframe 미리보기 사용)
 * - ppt: 실행 없음 (PPTX 다운로드만)
 */
import { spawn } from "node:child_process";
import { existsSync, writeFileSync, unlinkSync, readdirSync } from "node:fs";
import path from "node:path";

const VALID = new Set(["homepage", "ppt", "program"]);
const REPORTS_DIR = path.resolve(process.cwd(), "../../tools/demo/reports");

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ scenario: string }> }
) {
  const { scenario } = await params;

  if (!VALID.has(scenario)) {
    return new Response("Unknown scenario", { status: 400 });
  }

  if (scenario !== "program") {
    return new Response(
      JSON.stringify({ message: "이 시나리오는 직접 실행을 지원하지 않습니다." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const outDir = path.join(REPORTS_DIR, "program-output");

  // FastAPI 서버 파일 찾기 (fastapi 또는 main 포함 .py)
  const pyFiles = existsSync(outDir)
    ? readdirSync(outDir).filter((f) => f.endsWith(".py") && !f.startsWith("__"))
    : [];

  // 실행할 주 서버 파일 결정 (fastapi/서버/main 키워드 우선)
  const serverFile = pyFiles.find((f) =>
    /fastapi|server|서버|main/i.test(f)
  ) ?? pyFiles[0];

  if (!serverFile) {
    return new Response(
      JSON.stringify({ error: "실행할 Python 파일이 없습니다. 시나리오를 먼저 실행하세요." }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  // uvicorn은 Python 식별자를 모듈명으로 사용 — 하이픈이 있으면 실행 불가.
  // 임시 launcher 스크립트를 생성해서 importlib으로 로드 후 uvicorn.run()
  const launcherPath = path.join(outDir, "_bloks_launcher.py");
  const serverFilePath = path.join(outDir, serverFile);
  const port = 8001;

  const launcherCode = `
import importlib.util, pathlib, uvicorn

spec = importlib.util.spec_from_file_location(
    "generated_app",
    pathlib.Path(r"${serverFilePath.replace(/\\/g, "\\\\")}"),
)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)  # type: ignore

if hasattr(mod, "app"):
    uvicorn.run(mod.app, host="0.0.0.0", port=${port}, log_level="info")
else:
    raise RuntimeError("FastAPI app 객체를 찾을 수 없습니다.")
`.trim();

  writeFileSync(launcherPath, launcherCode, "utf-8");

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const push = (line: string) => {
        try { controller.enqueue(encoder.encode(line)); } catch { /* closed */ }
      };

      push(`▶ FastAPI 서버 시작 중...\n`);
      push(`파일: ${serverFile}\n`);
      push(`포트: ${port}\n`);
      push(`${"─".repeat(48)}\n`);

      const child = spawn("python", [launcherPath], {
        cwd: outDir,
        env: { ...process.env },
      });

      let started = false;

      child.stdout.on("data", (d: Buffer) => {
        const text = d.toString();
        push(text);
        if (!started && (text.includes("Application startup complete") || text.includes("Uvicorn running"))) {
          started = true;
          push(`\n✅ 서버 실행 완료 — http://localhost:${port}\n`);
          push(`__READY__:http://localhost:${port}\n`);
        }
      });

      child.stderr.on("data", (d: Buffer) => {
        const text = d.toString();
        push(text);
        if (!started && (text.includes("Application startup complete") || text.includes("Uvicorn running on"))) {
          started = true;
          push(`\n✅ 서버 실행 완료 — http://localhost:${port}\n`);
          push(`__READY__:http://localhost:${port}\n`);
        }
      });

      child.on("close", (code) => {
        try { unlinkSync(launcherPath); } catch { /* ignore */ }
        push(`\n__EXIT__:${code ?? 0}\n`);
        controller.close();
      });

      child.on("error", (err) => {
        try { unlinkSync(launcherPath); } catch { /* ignore */ }
        push(`\n❌ 실행 오류: ${err.message}\n`);
        push(`pip install fastapi uvicorn sqlalchemy 명령으로 의존성을 설치하세요.\n`);
        push(`\n__EXIT__:1\n`);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
}
