import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import Link from "next/link";
import { LeftSidebarNav } from "@/components/layout/AppShell-nav";

const REPORTS_DIR = path.join(process.cwd(), "../../tools/demo/reports");

const SCENARIOS = [
  { key: "homepage", label: "홈페이지 제작", icon: "🌐", desc: "기획·디자인·개발·QA 6명 협업" },
  { key: "ppt",      label: "PPT 발표자료",  icon: "📊", desc: "리서치·분석·카피·디자인·전략 5명 협업" },
  { key: "program",  label: "프로그램 개발", icon: "💻", desc: "설계·백엔드·프론트·QA·리뷰 6명 협업" },
];

function loadResult(scenario: string) {
  const file = path.join(REPORTS_DIR, `${scenario}-result.json`);
  if (!existsSync(file)) return null;
  try { return JSON.parse(readFileSync(file, "utf8")); } catch { return null; }
}

interface ArtifactSummary {
  hasPptx: boolean;
  htmlFiles: string[];
  pyFiles: string[];
  totalFiles: number;
}

function getArtifacts(scenario: string): ArtifactSummary {
  const pptxPath = path.join(REPORTS_DIR, `${scenario}-result.pptx`);
  const outDir = path.join(REPORTS_DIR, `${scenario}-output`);
  const hasPptx = existsSync(pptxPath);
  let htmlFiles: string[] = [];
  let pyFiles: string[] = [];
  if (existsSync(outDir)) {
    const files = readdirSync(outDir);
    htmlFiles = files.filter((f) => f.endsWith(".html"));
    pyFiles = files.filter((f) => f.endsWith(".py") && !f.startsWith("__"));
  }
  return { hasPptx, htmlFiles, pyFiles, totalFiles: (hasPptx ? 1 : 0) + htmlFiles.length + pyFiles.length };
}

function parseAo(raw: unknown) {
  if (!raw) return null;
  if (typeof raw === "string") { try { return JSON.parse(raw); } catch { return null; } }
  return raw as Record<string, unknown>;
}

export default function DemoListPage() {
  const results = SCENARIOS.map((s) => ({
    ...s,
    result: loadResult(s.key),
    artifacts: getArtifacts(s.key),
  }));

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <LeftSidebarNav active="demo" />
      <main style={{
        marginLeft: "var(--nav-left-w)",
        marginTop: "var(--nav-top-h)",
        marginBottom: "var(--ticker-h)",
        flex: 1, padding: "2rem", background: "var(--color-bg)",
      }}>
        <div style={{ maxWidth: 920, margin: "0 auto" }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--color-text)", marginBottom: "0.375rem" }}>
            🎬 데모 시나리오 결과
          </h1>
          <p style={{ color: "var(--color-muted)", fontSize: "0.875rem", marginBottom: "2rem" }}>
            AI 캐릭터 협업 시나리오를 실행하고 결과물을 확인하세요.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1.25rem" }}>
            {results.map(({ key, label, icon, desc, result, artifacts }) => {
              const done = result !== null;
              const doneCount = done
                ? result.tasks.filter((t: { state: string }) =>
                    ["Done", "Approved", "InReview"].includes(t.state)
                  ).length
                : 0;
              const totalCost = done
                ? result.tasks.reduce((s: number, t: { aiOutput: unknown }) => {
                    const ao = parseAo(t.aiOutput);
                    return s + Number(ao?.cost_usd ?? ao?.costUsd ?? 0);
                  }, 0)
                : 0;
              const totalTokens = done
                ? result.tasks.reduce((s: number, t: { aiOutput: unknown }) => {
                    const ao = parseAo(t.aiOutput);
                    return s + Number(ao?.tokens_used ?? ao?.tokensUsed ?? 0);
                  }, 0)
                : 0;
              const duration = done && result.completedAt
                ? (() => {
                    const ms = new Date(result.completedAt).getTime() - new Date(result.startedAt).getTime();
                    const s = Math.round(ms / 1000);
                    return s < 60 ? `${s}초` : `${Math.floor(s / 60)}분 ${s % 60}초`;
                  })()
                : null;

              const hasArtifacts = artifacts.totalFiles > 0;

              return (
                <div key={key} style={{
                  background: "var(--color-panel)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 12,
                  padding: "1.25rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.875rem",
                }}>
                  {/* 헤더 */}
                  <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
                    <span style={{ fontSize: "1.75rem" }}>{icon}</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: "1rem", color: "var(--color-text)" }}>{label}</div>
                      <div style={{ fontSize: "0.75rem", color: "var(--color-muted)" }}>{desc}</div>
                    </div>
                  </div>

                  {done ? (
                    <>
                      {/* 수치 그리드 */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                        {[
                          { label: "완료 태스크", value: `${doneCount}/${result.tasks.length}` },
                          { label: "소요 시간",   value: duration ?? "-" },
                          { label: "AI 비용",     value: totalCost > 0 ? `$${totalCost.toFixed(4)}` : "-" },
                          { label: "총 토큰",     value: totalTokens > 0 ? totalTokens.toLocaleString() : "-" },
                        ].map(({ label: l, value }) => (
                          <div key={l} style={{ background: "var(--color-bg)", borderRadius: 6, padding: "0.5rem 0.625rem" }}>
                            <div style={{ fontSize: "0.68rem", color: "var(--color-muted)" }}>{l}</div>
                            <div style={{ fontSize: "0.88rem", fontWeight: 600, color: "var(--color-text)" }}>{value}</div>
                          </div>
                        ))}
                      </div>

                      {/* 산출물 배지 — 핵심 */}
                      {hasArtifacts ? (
                        <div>
                          <div style={{ fontSize: "0.7rem", color: "var(--color-muted)", marginBottom: "0.375rem", fontWeight: 600 }}>
                            📦 생성된 산출물
                          </div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem" }}>
                            {artifacts.hasPptx && (
                              <a
                                href={`/api/demo/download/${key}`}
                                download
                                style={{
                                  display: "inline-flex", alignItems: "center", gap: "0.3rem",
                                  padding: "0.25rem 0.625rem", borderRadius: 20, fontSize: "0.75rem",
                                  background: "#2563eb18", color: "#2563eb",
                                  border: "1px solid #2563eb40", textDecoration: "none", fontWeight: 600,
                                }}
                              >
                                📊 PPTX 다운로드
                              </a>
                            )}
                            {artifacts.htmlFiles.map((f) => (
                              <Link
                                key={f}
                                href={`/demo/${key}?highlight=html`}
                                style={{
                                  display: "inline-flex", alignItems: "center", gap: "0.3rem",
                                  padding: "0.25rem 0.625rem", borderRadius: 20, fontSize: "0.75rem",
                                  background: "#16a34a18", color: "#16a34a",
                                  border: "1px solid #16a34a40", textDecoration: "none", fontWeight: 600,
                                }}
                              >
                                🌐 {f.length > 18 ? f.slice(0, 15) + "…" : f}
                              </Link>
                            ))}
                            {artifacts.pyFiles.length > 0 && (
                              <Link
                                href={`/demo/${key}?highlight=python`}
                                style={{
                                  display: "inline-flex", alignItems: "center", gap: "0.3rem",
                                  padding: "0.25rem 0.625rem", borderRadius: 20, fontSize: "0.75rem",
                                  background: "#d9770618", color: "#d97706",
                                  border: "1px solid #d9770640", textDecoration: "none", fontWeight: 600,
                                }}
                              >
                                🐍 Python {artifacts.pyFiles.length}개
                              </Link>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div style={{
                          padding: "0.5rem 0.75rem", borderRadius: 6, fontSize: "0.78rem",
                          background: "#dc262618", color: "#dc2626",
                          border: "1px solid #dc262640",
                        }}>
                          ⚠️ 산출물 없음 — 시나리오 재실행 필요
                        </div>
                      )}

                      <div style={{ fontSize: "0.7rem", color: "var(--color-muted)" }}>
                        {new Date(result.startedAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}
                      </div>

                      <Link href={`/demo/${key}`} style={{
                        display: "block", textAlign: "center",
                        padding: "0.5rem 1rem", borderRadius: 7,
                        background: "var(--color-brand)", color: "#fff",
                        textDecoration: "none", fontWeight: 600, fontSize: "0.85rem",
                      }}>
                        결과 보기 →
                      </Link>
                    </>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                      <div style={{ fontSize: "0.8rem", color: "var(--color-muted)" }}>
                        아직 실행되지 않았습니다
                      </div>
                      <Link href={`/demo/${key}`} style={{
                        display: "block", textAlign: "center",
                        padding: "0.5rem 1rem", borderRadius: 7,
                        background: "var(--color-accent)", color: "#fff",
                        textDecoration: "none", fontWeight: 600, fontSize: "0.85rem",
                      }}>
                        🚀 지금 실행하기 →
                      </Link>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
