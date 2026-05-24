import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { notFound } from "next/navigation";
import Link from "next/link";
import { LeftSidebarNav } from "@/components/layout/AppShell-nav";
import { ScenarioViewer } from "./ScenarioViewer";

const REPORTS_DIR = path.join(process.cwd(), "../../tools/demo/reports");

const SCENARIO_LABELS: Record<string, string> = {
  homepage: "🌐 홈페이지 제작",
  ppt:      "📊 PPT 발표자료",
  program:  "💻 프로그램 개발",
};

function getArtifacts(scenario: string) {
  const outDir = path.join(REPORTS_DIR, `${scenario}-output`);
  const hasPptx = existsSync(path.join(REPORTS_DIR, `${scenario}-result.pptx`));
  if (!existsSync(outDir)) return { hasPptx, htmlFiles: [], pyFiles: [] };
  const files = readdirSync(outDir);
  return {
    hasPptx,
    htmlFiles: files.filter((f) => f.endsWith(".html")),
    pyFiles: files.filter((f) => f.endsWith(".py") && !f.startsWith("__")),
  };
}

export default async function ScenarioDetailPage({
  params,
}: {
  params: Promise<{ scenario: string }>;
}) {
  const { scenario } = await params;

  if (!SCENARIO_LABELS[scenario]) notFound();

  const resultFile = path.join(REPORTS_DIR, `${scenario}-result.json`);
  const result = existsSync(resultFile)
    ? JSON.parse(readFileSync(resultFile, "utf8"))
    : null;

  const artifacts = getArtifacts(scenario);

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <LeftSidebarNav active="demo" />
      <main style={{
        marginLeft: "var(--nav-left-w)",
        marginTop: "var(--nav-top-h)",
        marginBottom: "var(--ticker-h)",
        flex: 1, padding: "2rem", background: "var(--color-bg)",
      }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <div style={{ fontSize: "0.8rem", color: "var(--color-muted)", marginBottom: "1rem" }}>
            <Link href="/demo" style={{ color: "var(--color-muted)", textDecoration: "none" }}>
              데모 결과
            </Link>
            {" → "}
            <span style={{ color: "var(--color-text)" }}>{SCENARIO_LABELS[scenario]}</span>
          </div>

          <div style={{ marginBottom: "1.5rem" }}>
            <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--color-text)", marginBottom: "0.25rem" }}>
              {result?.projectTitle ?? SCENARIO_LABELS[scenario]}
            </h1>
            {result?.startedAt && (
              <div style={{ fontSize: "0.8rem", color: "var(--color-muted)" }}>
                {SCENARIO_LABELS[scenario]} 시나리오 &nbsp;·&nbsp;{" "}
                {new Date(result.startedAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}
              </div>
            )}
          </div>

          <ScenarioViewer initialResult={result} scenario={scenario} artifacts={artifacts} />
        </div>
      </main>
    </div>
  );
}
