"use client";
import React, { useState, useCallback, useEffect, useRef } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TaskResult {
  id: string;
  title: string;
  state: string;
  assigneeCharacterId: string;
  aiOutput: Record<string, unknown> | string | null;
  artifacts: unknown[];
}

export interface ScenarioResult {
  scenario: string;
  projectId: string;
  projectTitle: string;
  startedAt: string;
  completedAt: string;
  tasks: TaskResult[];
  characters: { codeName: string; id: string; name: string }[];
}

type DeviceMode = "desktop" | "tablet" | "mobile";

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseOutput(raw: unknown): Record<string, unknown> | null {
  if (!raw) return null;
  if (typeof raw === "string") {
    try { return JSON.parse(raw) as Record<string, unknown>; } catch { return null; }
  }
  return raw as Record<string, unknown>;
}

function getOutputText(ao: Record<string, unknown> | null): string {
  if (!ao) return "";
  return String(ao.text ?? ao.output_text ?? ao.outputText ?? "");
}

function extractCodeBlocks(text: string, lang: string): string[] {
  const results: string[] = [];
  const re = new RegExp("```" + lang + "\\s*([\\s\\S]*?)```", "gi");
  let m;
  while ((m = re.exec(text)) !== null) {
    const block = m[1]?.trim();
    if (block && block.length >= 100) results.push(block);
  }
  return results;
}

function extractHtmlBlocks(text: string): string[] {
  return extractCodeBlocks(text, "html");
}

function stateLabel(s: string) {
  const m: Record<string, string> = {
    Done: "완료", Approved: "승인", InReview: "검토 중",
    InProgress: "진행 중", Cancelled: "취소", Created: "생성",
  };
  return m[s] ?? s;
}

function stateColor(s: string) {
  if (s === "Done" || s === "Approved") return "#16a34a";
  if (s === "InReview") return "#d97706";
  if (s === "InProgress") return "#2563eb";
  if (s === "Cancelled") return "#dc2626";
  return "var(--color-muted)";
}

function formatDuration(startedAt: string, completedAt: string) {
  const ms = new Date(completedAt).getTime() - new Date(startedAt).getTime();
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}초` : `${Math.floor(s / 60)}분 ${s % 60}초`;
}

// ── Markdown Renderer ─────────────────────────────────────────────────────────

function escHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderMarkdown(md: string): string {
  // 1. protect code blocks
  const codeBlocks: string[] = [];
  let html = md.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    const idx = codeBlocks.length;
    codeBlocks.push(
      `<pre style="background:#1e1e2e;color:#cdd6f4;padding:1rem;border-radius:8px;overflow-x:auto;font-size:0.78rem;margin:0.75rem 0;border:1px solid rgba(255,255,255,0.08)"><div style="color:#6c7086;font-size:0.68rem;margin-bottom:0.4rem;text-transform:uppercase">${lang || "code"}</div><code>${escHtml(code.trim())}</code></pre>`
    );
    return `\x00CODE${idx}\x00`;
  });

  // 2. inline code
  html = html.replace(/`([^`]+)`/g,
    `<code style="background:rgba(0,0,0,0.08);padding:0.1em 0.4em;border-radius:4px;font-size:0.85em;font-family:monospace">$1</code>`
  );

  // 3. headings
  html = html
    .replace(/^###### (.+)$/gm, `<h6 style="font-size:0.8rem;font-weight:700;margin:0.75rem 0 0.2rem;color:var(--color-text)">$1</h6>`)
    .replace(/^##### (.+)$/gm, `<h5 style="font-size:0.85rem;font-weight:700;margin:0.9rem 0 0.25rem;color:var(--color-text)">$1</h5>`)
    .replace(/^#### (.+)$/gm, `<h4 style="font-size:0.9rem;font-weight:700;margin:1rem 0 0.3rem;color:var(--color-text)">$1</h4>`)
    .replace(/^### (.+)$/gm, `<h3 style="font-size:1rem;font-weight:700;margin:1.25rem 0 0.35rem;color:var(--color-text)">$1</h3>`)
    .replace(/^## (.+)$/gm, `<h2 style="font-size:1.1rem;font-weight:700;margin:1.5rem 0 0.4rem;color:var(--color-text)">$1</h2>`)
    .replace(/^# (.+)$/gm, `<h1 style="font-size:1.3rem;font-weight:800;margin:1.5rem 0 0.5rem;color:var(--color-text)">$1</h1>`);

  // 4. bold / italic
  html = html
    .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/__(.+?)__/g, "<strong>$1</strong>")
    .replace(/_(.+?)_/g, "<em>$1</em>");

  // 5. checkboxes
  html = html
    .replace(/^- \[ \] (.+)$/gm, `<div style="display:flex;gap:0.5rem;align-items:flex-start;margin:0.25rem 0"><input type="checkbox" disabled style="margin-top:0.2rem;accent-color:var(--color-brand)"> <span>$1</span></div>`)
    .replace(/^- \[x\] (.+)$/gim, `<div style="display:flex;gap:0.5rem;align-items:flex-start;margin:0.25rem 0"><input type="checkbox" disabled checked style="margin-top:0.2rem;accent-color:var(--color-brand)"> <span style="text-decoration:line-through;opacity:0.55">$1</span></div>`);

  // 6. tables
  html = html.replace(/((?:^\|.+\|$\n?)+)/gm, (table) => {
    const rows = table.trim().split("\n");
    let out = `<table style="border-collapse:collapse;width:100%;margin:0.75rem 0;font-size:0.82rem">`;
    rows.forEach((row, i) => {
      if (/^\|[-| :]+\|$/.test(row.trim())) return;
      const cells = row.split("|").slice(1, -1).map((c) => c.trim());
      const tag = i === 0 ? "th" : "td";
      const style = i === 0
        ? `style="background:var(--color-bg);padding:0.4rem 0.75rem;border:1px solid var(--color-border);font-weight:700;text-align:left"`
        : `style="padding:0.35rem 0.75rem;border:1px solid var(--color-border)"`;
      out += `<tr>${cells.map((c) => `<${tag} ${style}>${c}</${tag}>`).join("")}</tr>`;
    });
    return out + "</table>";
  });

  // 7. blockquotes
  html = html.replace(/^> (.+)$/gm,
    `<blockquote style="border-left:3px solid var(--color-brand);margin:0.5rem 0;padding:0.25rem 0.875rem;color:var(--color-muted);font-style:italic">$1</blockquote>`
  );

  // 8. lists (must come after checkboxes)
  // collect consecutive list items
  html = html.replace(/((?:^[-*] .+$\n?)+)/gm, (block) => {
    const items = block.trim().split("\n")
      .filter((l) => /^[-*] /.test(l))
      .map((l) => `<li style="margin:0.2rem 0">${l.replace(/^[-*] /, "")}</li>`)
      .join("");
    return `<ul style="padding-left:1.5rem;margin:0.4rem 0">${items}</ul>\n`;
  });

  html = html.replace(/((?:^\d+\. .+$\n?)+)/gm, (block) => {
    const items = block.trim().split("\n")
      .filter((l) => /^\d+\. /.test(l))
      .map((l) => `<li style="margin:0.2rem 0">${l.replace(/^\d+\. /, "")}</li>`)
      .join("");
    return `<ol style="padding-left:1.5rem;margin:0.4rem 0">${items}</ol>\n`;
  });

  // 9. hr
  html = html.replace(/^---$/gm,
    `<hr style="border:none;border-top:1px solid var(--color-border);margin:1rem 0">`
  );

  // 10. paragraphs
  html = html
    .replace(/\n\n+/g, "</p><p style='margin:0.6rem 0'>")
    .replace(/\n/g, "<br>");

  html = `<p style="margin:0.4rem 0">${html}</p>`;

  // 11. restore code blocks
  codeBlocks.forEach((block, i) => {
    html = html.replace(`\x00CODE${i}\x00`, block);
  });

  return html;
}

// ── Download helpers ──────────────────────────────────────────────────────────

function downloadBlob(filename: string, content: string, type = "text/plain") {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function downloadAll(tasks: TaskResult[]) {
  tasks.forEach((task) => {
    const ao = parseOutput(task.aiOutput);
    const text = getOutputText(ao);
    if (!text) return;
    const htmlBlocks = extractHtmlBlocks(text);
    if (htmlBlocks.length > 0) {
      htmlBlocks.forEach((html, i) => {
        const suffix = htmlBlocks.length > 1 ? `-${i + 1}` : "";
        downloadBlob(`${task.title}${suffix}.html`, html, "text/html");
      });
    } else {
      downloadBlob(`${task.title}.md`, text, "text/markdown");
    }
  });
}

// ── HTML Preview with device simulation ──────────────────────────────────────

const DEVICES: { key: DeviceMode; label: string; width: number | string; icon: string }[] = [
  { key: "mobile",  label: "Mobile",  width: 375,    icon: "📱" },
  { key: "tablet",  label: "Tablet",  width: 768,    icon: "⬛" },
  { key: "desktop", label: "Desktop", width: "100%", icon: "🖥️" },
];

function HtmlPreview({ html, title }: { html: string; title: string }) {
  const [device, setDevice] = useState<DeviceMode>("desktop");
  const [viewMode, setViewMode] = useState<"preview" | "source">("preview");
  const [fullscreen, setFullscreen] = useState(false);
  const blobUrl = React.useMemo(
    () => URL.createObjectURL(new Blob([html], { type: "text/html" })),
    [html]
  );
  useEffect(() => () => URL.revokeObjectURL(blobUrl), [blobUrl]);

  const deviceWidth = DEVICES.find((d) => d.key === device)?.width ?? "100%";

  const previewContent = (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: "0.5rem" }}>
      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0, flexWrap: "wrap" }}>
        {/* View mode */}
        <div style={{ display: "flex", border: "1px solid var(--color-border)", borderRadius: 6, overflow: "hidden" }}>
          {(["preview", "source"] as const).map((m) => (
            <button key={m} onClick={() => setViewMode(m)} style={{
              padding: "0.3rem 0.7rem", fontSize: "0.78rem", border: "none",
              background: viewMode === m ? "var(--color-brand)" : "var(--color-bg)",
              color: viewMode === m ? "#fff" : "var(--color-text)",
              cursor: "pointer", fontWeight: viewMode === m ? 600 : 400,
            }}>
              {m === "preview" ? "🖥️ 미리보기" : "📄 소스"}
            </button>
          ))}
        </div>

        {/* Device selector (preview only) */}
        {viewMode === "preview" && (
          <div style={{ display: "flex", border: "1px solid var(--color-border)", borderRadius: 6, overflow: "hidden" }}>
            {DEVICES.map((d) => (
              <button key={d.key} onClick={() => setDevice(d.key)} title={d.label} style={{
                padding: "0.3rem 0.6rem", fontSize: "0.82rem", border: "none",
                background: device === d.key ? "var(--color-brand)" : "var(--color-bg)",
                color: device === d.key ? "#fff" : "var(--color-text)",
                cursor: "pointer",
              }}>
                {d.icon}
              </button>
            ))}
          </div>
        )}

        <div style={{ marginLeft: "auto", display: "flex", gap: "0.4rem" }}>
          <a href={blobUrl} target="_blank" rel="noopener noreferrer" style={{
            padding: "0.3rem 0.7rem", borderRadius: 6, fontSize: "0.78rem",
            border: "1px solid var(--color-border)", background: "var(--color-bg)",
            color: "var(--color-text)", textDecoration: "none",
          }}>
            ↗ 새 탭
          </a>
          <button onClick={() => downloadBlob(`${title}.html`, html, "text/html")} style={{
            padding: "0.3rem 0.7rem", borderRadius: 6, fontSize: "0.78rem",
            border: "1px solid var(--color-border)", background: "var(--color-bg)",
            color: "var(--color-text)", cursor: "pointer",
          }}>
            ⬇️ HTML
          </button>
          <button onClick={() => setFullscreen((v) => !v)} style={{
            padding: "0.3rem 0.7rem", borderRadius: 6, fontSize: "0.78rem",
            border: "1px solid var(--color-border)", background: "var(--color-bg)",
            color: "var(--color-text)", cursor: "pointer",
          }}>
            {fullscreen ? "⊠ 닫기" : "⛶ 전체화면"}
          </button>
        </div>
      </div>

      {/* Preview area */}
      <div style={{
        flex: 1, overflow: "hidden", display: "flex", justifyContent: "center",
        background: "#e5e7eb", borderRadius: 8, padding: viewMode === "preview" ? "0.75rem" : 0,
      }}>
        {viewMode === "preview" ? (
          <iframe
            src={blobUrl}
            style={{
              width: typeof deviceWidth === "number" ? deviceWidth : deviceWidth,
              maxWidth: "100%",
              height: "100%",
              border: "none",
              borderRadius: typeof deviceWidth === "number" ? 8 : 0,
              boxShadow: typeof deviceWidth === "number" ? "0 4px 24px rgba(0,0,0,0.18)" : "none",
              background: "#fff",
              transition: "width 0.2s ease",
            }}
            title={title}
            sandbox="allow-same-origin allow-scripts allow-forms"
          />
        ) : (
          <pre style={{
            width: "100%", height: "100%", margin: 0,
            padding: "1rem", overflow: "auto",
            fontSize: "0.75rem", lineHeight: 1.5,
            background: "#1e1e2e", color: "#cdd6f4",
            borderRadius: 8, boxSizing: "border-box",
          }}>
            <code>{html}</code>
          </pre>
        )}
      </div>
    </div>
  );

  if (fullscreen) {
    return (
      <>
        {/* Fullscreen overlay */}
        <div style={{
          position: "fixed", inset: 0, zIndex: 9999,
          background: "var(--color-bg)", display: "flex", flexDirection: "column",
          padding: "1rem",
        }}>
          {previewContent}
        </div>
        {/* Placeholder keeping layout */}
        <div style={{ height: 520 }} />
      </>
    );
  }

  return <div style={{ height: 560 }}>{previewContent}</div>;
}

// ── Terminal output ───────────────────────────────────────────────────────────

function TerminalOutput({ lines, running }: { lines: string[]; running: boolean }) {
  const ref = useRef<HTMLPreElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [lines]);

  return (
    <pre ref={ref} style={{
      background: "#0d1117", color: "#e6edf3", borderRadius: 8,
      padding: "0.875rem 1rem", fontSize: "0.75rem", lineHeight: 1.6,
      height: 320, overflow: "auto", margin: 0,
      border: "1px solid #30363d", fontFamily: "monospace",
      whiteSpace: "pre-wrap", wordBreak: "break-all",
    }}>
      {lines.map((l, i) => (
        <span key={i} style={{
          color: l.startsWith("[stderr]") ? "#f85149"
            : l.startsWith("✓") || l.includes("completed") ? "#3fb950"
            : l.startsWith("  polling") ? "#8b949e"
            : "#e6edf3",
        }}>
          {l}{"\n"}
        </span>
      ))}
      {running && <span style={{ color: "#58a6ff" }}>█</span>}
    </pre>
  );
}

// ── TaskCard ──────────────────────────────────────────────────────────────────

function TaskCard({
  task, charName, idx, defaultOpen,
}: {
  task: TaskResult; charName: string; idx: number; defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const ao = parseOutput(task.aiOutput);
  const text = getOutputText(ao);
  const htmlBlocks = text ? extractHtmlBlocks(text) : [];
  const pyBlocks = text ? extractCodeBlocks(text, "python") : [];
  const hasHtml = htmlBlocks.length > 0;
  const hasPython = pyBlocks.length > 0 && !hasHtml;
  const tokens = Number(ao?.tokens_used ?? ao?.tokensUsed ?? 0);
  const cost = Number(ao?.cost_usd ?? ao?.costUsd ?? 0);
  const model = String(ao?.model_used ?? ao?.modelUsed ?? "");
  const docText = hasHtml
    ? text.replace(/```html[\s\S]*?```/gi, "").trim()
    : text;

  return (
    <div style={{
      border: "1px solid var(--color-border)", borderRadius: 10,
      background: "var(--color-panel)", overflow: "hidden",
    }}>
      {/* Header — always visible */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => e.key === "Enter" && setOpen((v) => !v)}
        style={{
          display: "flex", alignItems: "center", gap: "0.75rem",
          padding: "0.875rem 1.125rem", width: "100%",
          cursor: "pointer",
          borderBottom: open ? "1px solid var(--color-border)" : "none",
        }}
      >
        <span style={{
          width: 28, height: 28, borderRadius: "50%",
          background: "var(--color-bg)", border: "1px solid var(--color-border)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "0.78rem", fontWeight: 700, color: "var(--color-muted)", flexShrink: 0,
        }}>
          {idx + 1}
        </span>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: "0.9rem", color: "var(--color-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {task.title}
          </div>
          <div style={{ fontSize: "0.72rem", color: "var(--color-muted)", marginTop: 2 }}>
            {charName}
            {model && <span style={{ marginLeft: 6, background: "var(--color-bg)", padding: "0 0.3rem", borderRadius: 3, border: "1px solid var(--color-border)" }}>{model}</span>}
            {tokens > 0 && <span style={{ marginLeft: 6 }}>{tokens.toLocaleString()} tokens</span>}
            {cost > 0 && <span style={{ marginLeft: 6, color: "#16a34a" }}>${cost.toFixed(4)}</span>}
          </div>
        </div>

        <span style={{
          fontSize: "0.72rem", fontWeight: 700,
          color: stateColor(task.state),
          background: `${stateColor(task.state)}18`,
          padding: "0.15rem 0.5rem", borderRadius: 4, flexShrink: 0,
        }}>
          {stateLabel(task.state)}
        </span>

        {hasHtml && (
          <span style={{ fontSize: "0.7rem", background: "#2563eb18", color: "#2563eb", padding: "0.15rem 0.5rem", borderRadius: 4, flexShrink: 0 }}>
            HTML
          </span>
        )}
        {hasPython && (
          <span style={{ fontSize: "0.7rem", background: "#16a34a18", color: "#16a34a", padding: "0.15rem 0.5rem", borderRadius: 4, flexShrink: 0 }}>
            PY
          </span>
        )}

        {text && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (hasHtml) {
                htmlBlocks.forEach((html, i) => {
                  const suffix = htmlBlocks.length > 1 ? `-${i + 1}` : "";
                  downloadBlob(`${task.title}${suffix}.html`, html, "text/html");
                });
              } else if (hasPython) {
                pyBlocks.forEach((py, i) => {
                  const suffix = pyBlocks.length > 1 ? `-${i + 1}` : "";
                  downloadBlob(`${task.title}${suffix}.py`, py, "text/plain");
                });
              } else {
                downloadBlob(`${task.title}.md`, text, "text/markdown");
              }
            }}
            title="다운로드"
            style={{
              background: "none", border: "1px solid var(--color-border)", borderRadius: 5,
              padding: "0.2rem 0.45rem", cursor: "pointer", fontSize: "0.75rem",
              color: "var(--color-muted)", flexShrink: 0,
            }}
          >
            ⬇️
          </button>
        )}

        <span style={{ color: "var(--color-muted)", fontSize: "0.7rem", flexShrink: 0 }}>
          {open ? "▲" : "▼"}
        </span>
      </div>

      {/* Body */}
      {open && (
        <div style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
          {hasHtml && (
            <>
              <HtmlPreview html={htmlBlocks[0]!} title={task.title} />
              {htmlBlocks.length > 1 && htmlBlocks.slice(1).map((html, i) => (
                <HtmlPreview key={i} html={html} title={`${task.title}-${i + 2}`} />
              ))}
            </>
          )}
          {docText && (
            <div
              style={{ fontSize: "0.85rem", color: "var(--color-text)", lineHeight: 1.75 }}
              dangerouslySetInnerHTML={{ __html: renderMarkdown(docText) }}
            />
          )}
          {!text && (
            <div style={{ color: "var(--color-muted)", fontSize: "0.85rem", padding: "1rem 0" }}>
              AI 출력 없음
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Run Panel ─────────────────────────────────────────────────────────────────

function RunPanel({
  scenario,
  onComplete,
}: {
  scenario: string;
  onComplete: () => void;
}) {
  const [running, setRunning] = useState(false);
  const [lines, setLines] = useState<string[]>([]);
  const [exitCode, setExitCode] = useState<number | null>(null);

  const run = useCallback(async () => {
    setRunning(true);
    setLines([`> pnpm demo:${scenario}`, "─".repeat(48)]);
    setExitCode(null);

    try {
      const res = await fetch(`/api/demo/run/${scenario}`, { method: "POST" });
      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });

        const exitMatch = buf.match(/__EXIT__:(\d+)/);
        if (exitMatch) {
          const code = parseInt(exitMatch[1]!);
          buf = buf.replace(/__EXIT__:\d+/, "");
          setExitCode(code);
        }

        const parts = buf.split("\n");
        buf = parts.pop() ?? "";
        setLines((prev) => [...prev, ...parts.filter((l) => l !== "")]);
      }

      if (buf.trim()) setLines((prev) => [...prev, buf.trim()]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setLines((prev) => [...prev, `[ERROR] ${msg}`]);
      setExitCode(1);
    } finally {
      setRunning(false);
      onComplete();
    }
  }, [scenario, onComplete]);

  return (
    <div style={{
      border: "1px solid var(--color-border)", borderRadius: 10,
      background: "var(--color-panel)", padding: "1.25rem",
      display: "flex", flexDirection: "column", gap: "0.75rem",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <h3 style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--color-text)", flex: 1 }}>
          🚀 시나리오 실행
        </h3>
        <button
          onClick={run}
          disabled={running}
          style={{
            padding: "0.45rem 1.125rem", borderRadius: 7, fontSize: "0.85rem",
            border: "none", cursor: running ? "not-allowed" : "pointer",
            background: running ? "var(--color-muted)" : "var(--color-brand)",
            color: "#fff", fontWeight: 700,
            display: "flex", alignItems: "center", gap: "0.4rem",
          }}
        >
          {running ? "⏳ 실행 중..." : "▶ 재실행"}
        </button>
      </div>

      {lines.length > 0 && (
        <>
          <TerminalOutput lines={lines} running={running} />
          {!running && exitCode !== null && (
            <div style={{
              fontSize: "0.8rem", fontWeight: 600, textAlign: "right",
              color: exitCode === 0 ? "#16a34a" : "#dc2626",
            }}>
              {exitCode === 0 ? "✓ 완료 — 페이지를 새로고침하면 결과가 반영됩니다" : `✗ 실패 (exit ${exitCode})`}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Overview tab ─────────────────────────────────────────────────────────────

function OverviewTab({ result }: { result: ScenarioResult }) {
  const totalCost = result.tasks.reduce((s, t) => {
    const ao = parseOutput(t.aiOutput);
    return s + Number(ao?.cost_usd ?? ao?.costUsd ?? 0);
  }, 0);
  const totalTokens = result.tasks.reduce((s, t) => {
    const ao = parseOutput(t.aiOutput);
    return s + Number(ao?.tokens_used ?? ao?.tokensUsed ?? 0);
  }, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {/* Characters */}
      <div style={{ background: "var(--color-panel)", border: "1px solid var(--color-border)", borderRadius: 10, padding: "1.25rem" }}>
        <h3 style={{ fontWeight: 700, fontSize: "0.9rem", marginBottom: "0.75rem", color: "var(--color-text)" }}>
          참여 캐릭터
        </h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          {result.characters.map((c) => (
            <div key={c.id} style={{
              background: "var(--color-bg)", border: "1px solid var(--color-border)",
              borderRadius: 20, padding: "0.3rem 0.875rem",
              fontSize: "0.82rem", color: "var(--color-text)",
              display: "flex", alignItems: "center", gap: "0.4rem",
            }}>
              <span style={{ fontWeight: 600 }}>{c.name}</span>
              <span style={{ color: "var(--color-muted)", fontSize: "0.72rem" }}>{c.codeName}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Task breakdown */}
      <div style={{ background: "var(--color-panel)", border: "1px solid var(--color-border)", borderRadius: 10, padding: "1.25rem" }}>
        <h3 style={{ fontWeight: 700, fontSize: "0.9rem", marginBottom: "0.75rem", color: "var(--color-text)" }}>
          태스크 비용 분석
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {result.tasks.map((t, i) => {
            const ao = parseOutput(t.aiOutput);
            const cost = Number(ao?.cost_usd ?? ao?.costUsd ?? 0);
            const tokens = Number(ao?.tokens_used ?? ao?.tokensUsed ?? 0);
            const model = String(ao?.model_used ?? ao?.modelUsed ?? "-");
            const pct = totalCost > 0 ? (cost / totalCost) * 100 : 0;
            return (
              <div key={t.id} style={{
                display: "grid", gridTemplateColumns: "1.5rem 1fr 5rem 4rem 5rem",
                alignItems: "center", gap: "0.75rem",
                padding: "0.5rem 0",
                borderBottom: i < result.tasks.length - 1 ? "1px solid var(--color-border)" : "none",
                fontSize: "0.81rem",
              }}>
                <span style={{ color: "var(--color-muted)", fontWeight: 700, textAlign: "center" }}>{i + 1}</span>
                <span style={{ color: "var(--color-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</span>
                <span style={{ color: "var(--color-muted)", fontSize: "0.72rem", textAlign: "right" }}>{model}</span>
                <span style={{ color: "var(--color-muted)", textAlign: "right" }}>{tokens > 0 ? tokens.toLocaleString() : "-"}</span>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <span style={{ color: cost > 0 ? "#16a34a" : "var(--color-muted)", fontWeight: 600, textAlign: "right" }}>
                    {cost > 0 ? `$${cost.toFixed(4)}` : "-"}
                  </span>
                  {pct > 0 && (
                    <div style={{ height: 3, background: "var(--color-border)", borderRadius: 2, overflow: "hidden" }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: "#16a34a" }} />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div style={{
          display: "flex", justifyContent: "flex-end", gap: "1.5rem",
          paddingTop: "0.75rem", fontSize: "0.82rem", fontWeight: 700,
          borderTop: "1px solid var(--color-border)", color: "var(--color-text)", marginTop: "0.25rem",
        }}>
          <span>총 토큰: {totalTokens.toLocaleString()}</span>
          <span style={{ color: "#16a34a" }}>총 비용: ${totalCost.toFixed(4)}</span>
        </div>
      </div>

      {/* Meta */}
      <div style={{
        background: "var(--color-panel)", border: "1px solid var(--color-border)",
        borderRadius: 10, padding: "1.25rem", fontSize: "0.8rem",
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem",
      }}>
        {[
          ["프로젝트 ID", result.projectId],
          ["시나리오", result.scenario],
          ["시작", new Date(result.startedAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })],
          ["완료", result.completedAt ? new Date(result.completedAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }) : "-"],
        ].map(([label, value]) => (
          <div key={label}>
            <div style={{ color: "var(--color-muted)", fontSize: "0.7rem", marginBottom: 2 }}>{label}</div>
            <div style={{ color: "var(--color-text)", fontFamily: label === "프로젝트 ID" ? "monospace" : "inherit", fontSize: label === "프로젝트 ID" ? "0.72rem" : "inherit" }}>{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Artifacts type ────────────────────────────────────────────────────────────

interface Artifacts {
  hasPptx: boolean;
  htmlFiles: string[];
  pyFiles: string[];
}

// ── ExecutePanel — FastAPI 서버 실행 ─────────────────────────────────────────

function ExecutePanel({ scenario }: { scenario: string }) {
  const [running, setRunning] = useState(false);
  const [lines, setLines] = useState<string[]>([]);
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [exitCode, setExitCode] = useState<number | null>(null);

  const run = useCallback(async () => {
    setRunning(true);
    setServerUrl(null);
    setExitCode(null);
    setLines([]);

    try {
      const res = await fetch(`/api/demo/execute/${scenario}`, { method: "POST" });
      if (!res.ok) {
        const msg = await res.text();
        setLines([`❌ ${msg}`]);
        setRunning(false);
        return;
      }
      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });

        const readyMatch = buf.match(/__READY__:(https?:\/\/\S+)/);
        if (readyMatch) {
          setServerUrl(readyMatch[1]!);
          buf = buf.replace(/__READY__:\S+/, "");
        }

        const exitMatch = buf.match(/__EXIT__:(\d+)/);
        if (exitMatch) {
          setExitCode(parseInt(exitMatch[1]!));
          buf = buf.replace(/__EXIT__:\d+/, "");
        }

        const parts = buf.split("\n");
        buf = parts.pop() ?? "";
        setLines((prev) => [...prev, ...parts.filter((l) => l !== "")]);
      }
      if (buf.trim()) setLines((prev) => [...prev, buf.trim()]);
    } catch (e) {
      setLines((prev) => [...prev, `❌ ${e instanceof Error ? e.message : String(e)}`]);
      setExitCode(1);
    } finally {
      setRunning(false);
    }
  }, [scenario]);

  return (
    <div style={{
      border: "1px solid var(--color-border)", borderRadius: 10,
      background: "var(--color-panel)", padding: "1.25rem",
      display: "flex", flexDirection: "column", gap: "0.875rem",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--color-text)" }}>
            ▶ FastAPI 서버 실행
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--color-muted)", marginTop: 2 }}>
            생성된 Python 서버를 로컬에서 실행합니다 (포트 8001).
            fastapi, uvicorn, sqlalchemy가 설치되어 있어야 합니다.
          </div>
        </div>
        <button
          onClick={run}
          disabled={running}
          style={{
            padding: "0.5rem 1.125rem", borderRadius: 7, fontSize: "0.85rem",
            border: "none", cursor: running ? "not-allowed" : "pointer",
            background: running ? "var(--color-muted)" : "#16a34a",
            color: "#fff", fontWeight: 700, flexShrink: 0,
            display: "flex", alignItems: "center", gap: "0.4rem",
          }}
        >
          {running ? "⏳ 실행 중..." : "▶ 서버 시작"}
        </button>
      </div>

      {/* 서버 URL 배너 */}
      {serverUrl && (
        <div style={{
          display: "flex", alignItems: "center", gap: "0.75rem",
          padding: "0.625rem 0.875rem", borderRadius: 8,
          background: "#16a34a18", border: "1px solid #16a34a40",
        }}>
          <span style={{ color: "#16a34a", fontWeight: 700, fontSize: "0.85rem" }}>
            ✅ 서버 실행 중
          </span>
          <a
            href={serverUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#16a34a", fontWeight: 600, fontSize: "0.85rem", fontFamily: "monospace" }}
          >
            {serverUrl}
          </a>
          <a
            href={`${serverUrl}/docs`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              marginLeft: "auto", padding: "0.25rem 0.625rem", borderRadius: 5, fontSize: "0.75rem",
              background: "#16a34a", color: "#fff", textDecoration: "none", fontWeight: 600,
            }}
          >
            📋 API Docs
          </a>
        </div>
      )}

      {/* 설치 가이드 */}
      {!running && exitCode === 1 && (
        <div style={{
          padding: "0.625rem 0.875rem", borderRadius: 8, fontSize: "0.78rem",
          background: "#d9770618", border: "1px solid #d9770640", color: "#d97706",
        }}>
          <strong>의존성 설치 필요:</strong>
          <pre style={{ margin: "0.375rem 0 0", fontFamily: "monospace", fontSize: "0.75rem", color: "#d97706" }}>
            pip install fastapi uvicorn sqlalchemy
          </pre>
        </div>
      )}

      {/* 터미널 출력 */}
      {lines.length > 0 && (
        <TerminalOutput lines={lines} running={running} />
      )}

      {!running && exitCode === 0 && !serverUrl && (
        <div style={{ fontSize: "0.8rem", color: "var(--color-muted)", textAlign: "right" }}>
          서버가 종료되었습니다.
        </div>
      )}
    </div>
  );
}

// ── ArtifactsTab ──────────────────────────────────────────────────────────────

function ArtifactsTab({
  scenario,
  artifacts,
  tasks,
}: {
  scenario: string;
  artifacts: Artifacts;
  tasks: TaskResult[];
}) {
  const hasAnything = artifacts.hasPptx || artifacts.htmlFiles.length > 0 || artifacts.pyFiles.length > 0;

  // HTML 산출물 텍스트를 태스크에서 추출
  const htmlTaskContents = tasks
    .map((t) => {
      const ao = parseOutput(t.aiOutput);
      const text = getOutputText(ao);
      const blocks = text ? extractHtmlBlocks(text) : [];
      return blocks.map((html) => ({ title: t.title, html }));
    })
    .flat();

  if (!hasAnything) {
    return (
      <div style={{
        textAlign: "center", padding: "3rem", color: "var(--color-muted)",
        border: "2px dashed var(--color-border)", borderRadius: 12,
      }}>
        <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>📭</div>
        <div style={{ fontWeight: 600, marginBottom: "0.25rem" }}>산출물이 없습니다</div>
        <div style={{ fontSize: "0.82rem" }}>🚀 실행 탭에서 시나리오를 실행하세요.</div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

      {/* PPTX */}
      {artifacts.hasPptx && (
        <div style={{ border: "1px solid var(--color-border)", borderRadius: 10, overflow: "hidden" }}>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "0.875rem 1.125rem", background: "var(--color-panel)",
            borderBottom: "1px solid var(--color-border)",
          }}>
            <div>
              <span style={{ fontWeight: 700, color: "var(--color-text)" }}>📊 프레젠테이션 (PPTX)</span>
              <span style={{ marginLeft: "0.5rem", fontSize: "0.75rem", color: "var(--color-muted)" }}>
                {scenario}-result.pptx
              </span>
            </div>
            <a
              href={`/api/demo/download/${scenario}`}
              download={`${scenario}-result.pptx`}
              style={{
                padding: "0.4rem 0.875rem", borderRadius: 7, fontSize: "0.82rem",
                background: "#2563eb", color: "#fff",
                textDecoration: "none", fontWeight: 600,
              }}
            >
              ⬇️ PPTX 다운로드
            </a>
          </div>
          <div style={{ padding: "1rem 1.125rem", background: "var(--color-bg)" }}>
            <div style={{ fontSize: "0.82rem", color: "var(--color-muted)" }}>
              Microsoft PowerPoint 또는 Google Slides에서 열 수 있습니다.
            </div>
          </div>
        </div>
      )}

      {/* Python 파일 목록 + 실행 패널 (program 시나리오 — HTML 미리보기 전에 먼저) */}
      {artifacts.pyFiles.length > 0 && (
        <div style={{ border: "1px solid var(--color-border)", borderRadius: 10, overflow: "hidden" }}>
          <div style={{
            padding: "0.875rem 1.125rem",
            background: "var(--color-panel)",
            borderBottom: "1px solid var(--color-border)",
          }}>
            <span style={{ fontWeight: 700, color: "var(--color-text)" }}>
              🐍 Python 파일 ({artifacts.pyFiles.length}개)
            </span>
          </div>
          <div style={{ padding: "0.75rem 1.125rem", display: "flex", flexDirection: "column", gap: "0.375rem" }}>
            {artifacts.pyFiles.map((f) => (
              <div key={f} style={{
                display: "flex", alignItems: "center", gap: "0.5rem",
                padding: "0.4rem 0.625rem", borderRadius: 6,
                background: "var(--color-bg)", border: "1px solid var(--color-border)",
                fontSize: "0.82rem",
              }}>
                <span style={{ fontFamily: "monospace", flex: 1, color: "var(--color-text)" }}>{f}</span>
                <span style={{
                  fontSize: "0.7rem", padding: "0.15rem 0.4rem", borderRadius: 3,
                  background: "#d9770618", color: "#d97706", border: "1px solid #d9770640",
                }}>
                  .py
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {scenario === "program" && artifacts.pyFiles.length > 0 && (
        <ExecutePanel scenario={scenario} />
      )}

      {/* HTML 산출물 — 태스크에서 추출한 것 */}
      {htmlTaskContents.map(({ title, html }, idx) => (
        <div key={idx} style={{ border: "1px solid var(--color-border)", borderRadius: 10, overflow: "hidden" }}>
          <div style={{
            padding: "0.875rem 1.125rem",
            background: "var(--color-panel)",
            borderBottom: "1px solid var(--color-border)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <span style={{ fontWeight: 700, color: "var(--color-text)" }}>🌐 {title}</span>
            <button
              onClick={() => downloadBlob(`${title}.html`, html, "text/html")}
              style={{
                padding: "0.3rem 0.7rem", borderRadius: 6, fontSize: "0.78rem",
                border: "1px solid var(--color-border)", background: "var(--color-bg)",
                color: "var(--color-text)", cursor: "pointer",
              }}
            >
              ⬇️ HTML 저장
            </button>
          </div>
          {scenario === "program" && (
            <div style={{
              padding: "0.5rem 1.125rem",
              background: "#2563eb0a",
              borderBottom: "1px solid #2563eb30",
              fontSize: "0.78rem", color: "#2563eb",
              display: "flex", alignItems: "center", gap: "0.4rem",
            }}>
              ℹ️ 이 UI는 FastAPI 서버(포트 8001)에 연결합니다 — 위 <strong>▶ 서버 시작</strong> 버튼을 먼저 눌러주세요.
            </div>
          )}
          <div style={{ padding: "0" }}>
            <HtmlPreview html={html} title={title} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main ScenarioViewer ───────────────────────────────────────────────────────

export function ScenarioViewer({
  initialResult,
  scenario,
  artifacts,
}: {
  initialResult: ScenarioResult | null;
  scenario: string;
  artifacts?: Artifacts;
}) {
  const [result, setResult] = useState<ScenarioResult | null>(initialResult);
  const [tab, setTab] = useState<"artifacts" | "tasks" | "overview" | "run">(
    initialResult ? "artifacts" : "run"
  );

  const doneCount = result
    ? result.tasks.filter((t) => ["Done", "Approved", "InReview"].includes(t.state)).length
    : 0;
  const totalCost = result
    ? result.tasks.reduce((s, t) => {
        const ao = parseOutput(t.aiOutput);
        return s + Number(ao?.cost_usd ?? ao?.costUsd ?? 0);
      }, 0)
    : 0;
  const totalTokens = result
    ? result.tasks.reduce((s, t) => {
        const ao = parseOutput(t.aiOutput);
        return s + Number(ao?.tokens_used ?? ao?.tokensUsed ?? 0);
      }, 0)
    : 0;
  const duration = result?.completedAt ? formatDuration(result.startedAt, result.completedAt) : "–";

  const charMap = result
    ? Object.fromEntries(result.characters.map((c) => [c.id, c.name]))
    : {};

  const refreshResult = useCallback(async () => {
    try {
      const res = await fetch(`/api/demo/results/${scenario}`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json() as ScenarioResult & { notFound?: boolean };
        if (!data.notFound) setResult(data);
      }
    } catch { /* ignore */ }
  }, [scenario]);

  const hasArtifacts = artifacts && (artifacts.hasPptx || artifacts.htmlFiles.length > 0 || artifacts.pyFiles.length > 0);

  const TABS = [
    { key: "artifacts" as const, label: "📦 산출물" },
    { key: "tasks" as const,     label: "📋 태스크 결과" },
    { key: "overview" as const,  label: "📊 개요 · 비용" },
    { key: "run" as const,       label: "🚀 재실행" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Summary strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "0.75rem" }}>
        {[
          { label: "완료율",    value: result ? `${doneCount}/${result.tasks.length}` : "–", sub: result ? `${Math.round(doneCount / result.tasks.length * 100)}%` : undefined },
          { label: "소요 시간", value: duration },
          { label: "총 토큰",  value: totalTokens > 0 ? totalTokens.toLocaleString() : "–" },
          { label: "총 비용",  value: totalCost > 0 ? `$${totalCost.toFixed(4)}` : "–", highlight: totalCost > 0 },
          { label: "캐릭터",   value: result ? `${result.characters.length}명` : "–" },
        ].map(({ label, value, sub, highlight }) => (
          <div key={label} style={{
            background: "var(--color-panel)", border: "1px solid var(--color-border)",
            borderRadius: 8, padding: "0.625rem 0.875rem",
          }}>
            <div style={{ fontSize: "0.68rem", color: "var(--color-muted)", marginBottom: 2 }}>{label}</div>
            <div style={{
              fontSize: "1rem", fontWeight: 700,
              color: highlight ? "#16a34a" : "var(--color-text)",
            }}>{value}</div>
            {sub && <div style={{ fontSize: "0.7rem", color: "var(--color-muted)" }}>{sub}</div>}
          </div>
        ))}
      </div>

      {/* Tabs + download all */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", borderBottom: "1px solid var(--color-border)", paddingBottom: "0.625rem" }}>
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: "0.4rem 0.875rem", borderRadius: 7, fontSize: "0.83rem",
            border: `1px solid ${tab === t.key ? "transparent" : "var(--color-border)"}`,
            background: tab === t.key ? "var(--color-brand)" : "var(--color-bg)",
            color: tab === t.key ? "#fff" : "var(--color-text)",
            cursor: "pointer", fontWeight: tab === t.key ? 600 : 400,
            display: "flex", alignItems: "center", gap: "0.3rem",
          }}>
            {t.label}
            {t.key === "artifacts" && hasArtifacts && (
              <span style={{
                fontSize: "0.65rem", padding: "0.1rem 0.35rem", borderRadius: 10,
                background: tab === t.key ? "rgba(255,255,255,0.25)" : "#16a34a",
                color: "#fff", fontWeight: 700,
              }}>
                있음
              </span>
            )}
          </button>
        ))}
        {result && (
          <div style={{ marginLeft: "auto", display: "flex", gap: "0.5rem" }}>
            <a
              href={`/api/demo/download/${scenario}`}
              download={`${scenario}-result.pptx`}
              style={{
                padding: "0.4rem 0.875rem", borderRadius: 7, fontSize: "0.82rem",
                border: "1px solid var(--color-accent)", background: "transparent",
                color: "var(--color-accent)", cursor: "pointer", fontWeight: 500,
                textDecoration: "none", display: "flex", alignItems: "center", gap: "0.3rem",
              }}
            >
              📊 PPTX
            </a>
            <button
              onClick={() => downloadAll(result.tasks)}
              style={{
                padding: "0.4rem 0.875rem", borderRadius: 7, fontSize: "0.82rem",
                border: "1px solid var(--color-border)", background: "var(--color-bg)",
                color: "var(--color-text)", cursor: "pointer", fontWeight: 500,
              }}
            >
              ⬇️ 전체 다운로드
            </button>
          </div>
        )}
      </div>

      {/* Tab content */}
      {tab === "artifacts" && (
        <ArtifactsTab
          scenario={scenario}
          artifacts={artifacts ?? { hasPptx: false, htmlFiles: [], pyFiles: [] }}
          tasks={result?.tasks ?? []}
        />
      )}

      {tab === "tasks" && (
        result ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {result.tasks.map((task, i) => (
              <TaskCard
                key={task.id}
                task={task}
                charName={charMap[task.assigneeCharacterId] ?? "–"}
                idx={i}
                defaultOpen={i === 0}
              />
            ))}
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: "3rem", color: "var(--color-muted)" }}>
            아직 실행 결과가 없습니다. 🚀 실행 탭에서 시나리오를 실행해 주세요.
          </div>
        )
      )}

      {tab === "overview" && (
        result ? <OverviewTab result={result} /> : (
          <div style={{ textAlign: "center", padding: "3rem", color: "var(--color-muted)" }}>
            아직 실행 결과가 없습니다. 🚀 실행 탭에서 시나리오를 실행해 주세요.
          </div>
        )
      )}

      {tab === "run" && (
        <RunPanel scenario={scenario} onComplete={refreshResult} />
      )}
    </div>
  );
}
