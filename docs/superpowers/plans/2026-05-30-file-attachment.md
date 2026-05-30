# 파일 첨부 기능 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 프로젝트 의뢰 및 캐릭터 대화 시 다양한 파일을 첨부하면 AI가 내용을 분석해 작업에 활용한다.

**Architecture:** 파일 업로드 → API에서 multer 수신 + 유형별 파싱(pdf-parse/mammoth/xlsx/Vision/Whisper) → extracted_text를 로컬 DB `attachments` 테이블에 저장 → 프로젝트 brief 또는 캐릭터 메시지에 병합해 AI 프롬프트에 포함.

**Tech Stack:** multer, pdf-parse, mammoth, xlsx, officeparser, OpenAI Vision/Whisper, React file input

---

## Task 1: 서버 의존성 설치

**Files:**
- Modify: `apps/api/package.json`

- [ ] **Step 1: 패키지 설치**

```bash
pnpm --filter api add multer pdf-parse mammoth xlsx officeparser
pnpm --filter api add -D @types/multer @types/pdf-parse @types/mammoth
```

- [ ] **Step 2: 설치 확인**

```bash
pnpm --filter api exec node -e "require('multer'); require('pdf-parse'); require('mammoth'); require('xlsx'); console.log('OK')"
```
Expected: `OK`

- [ ] **Step 3: 커밋**

```bash
git add apps/api/package.json pnpm-lock.yaml
git commit -m "chore: 파일 파싱 의존성 추가 (multer, pdf-parse, mammoth, xlsx, officeparser)"
```

---

## Task 2: attachments 테이블 추가

**Files:**
- Modify: `packages/db/src/local-stub.ts`

- [ ] **Step 1: localTables에 attachments 추가**

`packages/db/src/local-stub.ts` 에서 `localTables` 객체의 `outbox_events` 바로 다음에 추가:

```typescript
  attachments: _persisted["attachments"] ?? [],
```

- [ ] **Step 2: db 패키지 빌드**

```bash
pnpm --filter @bloks/db build
```
Expected: 오류 없음

- [ ] **Step 3: 커밋**

```bash
git add packages/db/src/local-stub.ts
git commit -m "feat: local-stub에 attachments 테이블 추가"
```

---

## Task 3: 파일 파서 모듈

**Files:**
- Create: `apps/api/src/lib/file-parser.ts`

- [ ] **Step 1: file-parser.ts 생성**

```typescript
// apps/api/src/lib/file-parser.ts
import { readFileSync } from "node:fs";
import OpenAI from "openai";

const OPENAI_KEY = process.env["OPENAI_API_KEY"];

export async function parseFile(filePath: string, mimeType: string, originalName: string): Promise<string> {
  try {
    // PDF
    if (mimeType === "application/pdf") {
      const pdfParse = (await import("pdf-parse")).default;
      const buf = readFileSync(filePath);
      const data = await pdfParse(buf);
      return data.text.trim().slice(0, 20000);
    }

    // DOCX
    if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        mimeType === "application/msword") {
      const mammoth = await import("mammoth");
      const buf = readFileSync(filePath);
      const result = await mammoth.extractRawText({ buffer: buf });
      return result.value.trim().slice(0, 20000);
    }

    // XLSX / XLS / CSV
    if (mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
        mimeType === "application/vnd.ms-excel" ||
        mimeType === "text/csv") {
      const XLSX = await import("xlsx");
      const wb = XLSX.readFile(filePath);
      const lines: string[] = [];
      for (const sheetName of wb.SheetNames) {
        const ws = wb.Sheets[sheetName]!;
        const csv = XLSX.utils.sheet_to_csv(ws);
        lines.push(`[시트: ${sheetName}]\n${csv}`);
      }
      return lines.join("\n\n").slice(0, 20000);
    }

    // PPTX
    if (mimeType === "application/vnd.openxmlformats-officedocument.presentationml.presentation") {
      const { parseOffice } = await import("officeparser");
      const text = await new Promise<string>((resolve, reject) => {
        parseOffice(filePath, (data: string, err: Error | null) => {
          if (err) reject(err); else resolve(data);
        });
      });
      return text.trim().slice(0, 20000);
    }

    // 이미지 — OpenAI Vision
    if (mimeType.startsWith("image/")) {
      if (!OPENAI_KEY) return `[이미지 첨부: ${originalName}] (Vision 분석 불가 — OPENAI_API_KEY 미설정)`;
      const client = new OpenAI({ apiKey: OPENAI_KEY });
      const buf = readFileSync(filePath);
      const b64 = buf.toString("base64");
      const resp = await client.chat.completions.create({
        model: "gpt-4o",
        max_tokens: 1000,
        messages: [{
          role: "user",
          content: [
            { type: "text", text: "이 이미지의 내용을 한국어로 상세히 설명해주세요." },
            { type: "image_url", image_url: { url: `data:${mimeType};base64,${b64}` } },
          ],
        }],
      });
      return `[이미지 분석: ${originalName}]\n${resp.choices[0]?.message?.content ?? ""}`;
    }

    // 영상/음성 — OpenAI Whisper
    if (mimeType.startsWith("video/") || mimeType.startsWith("audio/")) {
      if (!OPENAI_KEY) return `[영상/음성 첨부: ${originalName}] (Whisper 분석 불가 — OPENAI_API_KEY 미설정)`;
      const client = new OpenAI({ apiKey: OPENAI_KEY });
      const { createReadStream } = await import("node:fs");
      const stream = createReadStream(filePath) as unknown as File;
      const resp = await client.audio.transcriptions.create({
        file: stream,
        model: "whisper-1",
        language: "ko",
        response_format: "text",
      });
      return `[음성 전사: ${originalName}]\n${resp}`;
    }

    // 기타 — 파일명만
    return `[첨부파일: ${originalName}]`;
  } catch (err) {
    console.error("[file-parser] 파싱 실패", originalName, err);
    return `[첨부파일: ${originalName}] (파싱 실패)`;
  }
}
```

- [ ] **Step 2: 타입 체크**

```bash
cd apps/api && npx tsc --noEmit
```
Expected: 오류 없음

- [ ] **Step 3: 커밋**

```bash
git add apps/api/src/lib/file-parser.ts
git commit -m "feat: file-parser.ts — PDF/DOCX/XLSX/PPTX/이미지/영상 텍스트 추출"
```

---

## Task 4: 첨부파일 업로드 API

**Files:**
- Create: `apps/api/src/routes/attachments.ts`

- [ ] **Step 1: attachments.ts 생성**

```typescript
// apps/api/src/routes/attachments.ts
import { Router } from "express";
import multer from "multer";
import { mkdirSync } from "node:fs";
import { join, extname } from "node:path";
import { getDb } from "@bloks/db";
import { parseFile } from "../lib/file-parser.js";

export const attachmentsRouter = Router();

const DATA_DIR = process.env["BLOKS_DATA_DIR"]
  ?? join(process.cwd(), ".bloks-data");

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = join(DATA_DIR, "attachments");
    mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const id = `att_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const ext = extname(file.originalname);
    cb(null, `${id}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

// POST /api/v1/attachments
attachmentsRouter.post("/", upload.single("file"), async (req, res) => {
  const file = req.file;
  if (!file) {
    res.status(400).json({ ok: false, error: { code: "NO_FILE", message: "파일이 없습니다." } });
    return;
  }

  try {
    const extracted_text = await parseFile(file.path, file.mimetype, file.originalname);

    const sb = getDb();
    const now = new Date().toISOString();
    const id = file.filename.replace(extname(file.filename), "");

    const row = {
      id,
      filename: file.originalname,
      stored_path: file.path,
      mime_type: file.mimetype,
      size: file.size,
      extracted_text,
      created_at: now,
    };

    await sb.from("attachments").insert(row);

    res.json({ ok: true, data: { id, filename: file.originalname, extracted_text: extracted_text.slice(0, 200) } });
  } catch (err) {
    console.error("[attachments] upload error", err);
    res.status(500).json({ ok: false, error: { code: "INTERNAL_ERROR", message: "파일 처리 중 오류가 발생했습니다." } });
  }
});
```

- [ ] **Step 2: 타입 체크**

```bash
cd apps/api && npx tsc --noEmit
```

- [ ] **Step 3: 커밋**

```bash
git add apps/api/src/routes/attachments.ts
git commit -m "feat: POST /api/v1/attachments — 파일 업로드 + 텍스트 추출"
```

---

## Task 5: API 라우터에 attachments 등록

**Files:**
- Modify: `apps/api/src/index.ts`

- [ ] **Step 1: attachmentsRouter import 및 등록**

`apps/api/src/index.ts` 에서 기존 라우터 import 목록 찾아 추가:

```typescript
import { attachmentsRouter } from "./routes/attachments.js";
```

라우터 등록 부분에 추가 (다른 `app.use("/api/v1/` 줄들 옆에):
```typescript
app.use("/api/v1/attachments", authMiddleware, attachmentsRouter);
```

- [ ] **Step 2: 서버 실행 및 엔드포인트 확인**

```bash
# 별도 터미널에서 API 서버가 이미 실행 중이어야 함
curl -X POST http://localhost:4000/api/v1/attachments \
  -H "Authorization: Bearer dev-bypass" \
  -F "file=@README.md"
```
Expected: `{"ok":true,"data":{"id":"att_...","filename":"README.md","extracted_text":"..."}}`

- [ ] **Step 3: 커밋**

```bash
git add apps/api/src/index.ts
git commit -m "feat: /api/v1/attachments 라우터 등록"
```

---

## Task 6: 프로젝트 생성에 attachmentIds 연동

**Files:**
- Modify: `apps/api/src/routes/projects.ts`

- [ ] **Step 1: createProjectSchema에 attachmentIds 추가 + brief 병합 로직**

`apps/api/src/routes/projects.ts` 의 `createProjectSchema` 수정:

```typescript
const createProjectSchema = z.object({
  title: z.string().min(1).max(200),
  brief: z.string().min(1).max(2000).optional(),
  priority: z.enum(["Critical", "High", "Medium", "Low"]).default("Medium"),
  ownerId: z.string().min(1).optional(),
  virtualBudgetAllocated: z.number().positive().optional(),
  attachmentIds: z.array(z.string()).max(10).optional(),
});
```

`POST /projects` 핸들러에서 DB insert 직전에 다음 추가:

```typescript
    // 첨부파일 컨텍스트 병합
    let enrichedBrief = parsed.data.brief ?? "";
    if (parsed.data.attachmentIds?.length) {
      const sb = getDb();
      const { data: atts } = await sb.from("attachments").select("filename, extracted_text").in("id", parsed.data.attachmentIds);
      if (atts?.length) {
        const attContext = (atts as Array<{ filename: string; extracted_text: string }>)
          .map(a => `[첨부: ${a.filename}]\n${a.extracted_text}`)
          .join("\n\n---\n\n");
        enrichedBrief = enrichedBrief
          ? `${enrichedBrief}\n\n[첨부 파일 내용]\n${attContext}`
          : `[첨부 파일 내용]\n${attContext}`;
      }
    }
```

그리고 insert 시 `description: parsed.data.brief ?? null` → `description: enrichedBrief || null` 로 변경.

jobPayload도 `brief: parsed.data.brief ?? ""` → `brief: enrichedBrief` 로 변경.

- [ ] **Step 2: 타입 체크**

```bash
cd apps/api && npx tsc --noEmit
```

- [ ] **Step 3: 커밋**

```bash
git add apps/api/src/routes/projects.ts
git commit -m "feat: 프로젝트 생성 시 첨부파일 내용 brief에 자동 병합"
```

---

## Task 7: 프로젝트 생성 폼 파일 드롭존 UI

**Files:**
- Modify: `apps/web/src/components/project/ProjectIntakeForm.tsx`

- [ ] **Step 1: 파일 업로드 state + 핸들러 추가**

`ProjectIntakeForm.tsx` 의 기존 state 선언 아래 추가:

```typescript
  const [attachments, setAttachments] = useState<Array<{ id: string; filename: string; uploading?: boolean }>>([]);

  const uploadFile = async (file: File) => {
    const tempId = `temp_${Date.now()}`;
    setAttachments(prev => [...prev, { id: tempId, filename: file.name, uploading: true }]);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/v1/attachments", {
        method: "POST",
        headers: { Authorization: "Bearer dev-bypass" },
        body: fd,
      });
      const json = await res.json() as { ok: boolean; data?: { id: string; filename: string } };
      if (json.ok && json.data) {
        setAttachments(prev => prev.map(a => a.id === tempId ? { id: json.data!.id, filename: json.data!.filename } : a));
      } else {
        setAttachments(prev => prev.filter(a => a.id !== tempId));
      }
    } catch {
      setAttachments(prev => prev.filter(a => a.id !== tempId));
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    Array.from(e.dataTransfer.files).forEach(f => void uploadFile(f));
  };
```

- [ ] **Step 2: submit에 attachmentIds 포함**

기존 `apiPost("/projects", { ... })` 호출을:

```typescript
      const res = await apiPost<ProjectResponse>("/projects", {
        title: title.trim(),
        brief: brief.trim(),
        ...(deadline ? { dueAt: deadline } : {}),
        ...(attachments.filter(a => !a.uploading).length > 0
          ? { attachmentIds: attachments.filter(a => !a.uploading).map(a => a.id) }
          : {}),
      });
```

- [ ] **Step 3: 드롭존 UI — 마감일 input 아래, 버튼 위에 삽입**

```tsx
        <div>
          <label style={{ display: "block", fontSize: "0.8rem", color: "var(--color-muted)", marginBottom: "0.4rem" }}>
            참고 파일 첨부 <span style={{ fontWeight: 400 }}>(선택 — PDF, DOCX, XLSX, PPTX, 이미지, 영상)</span>
          </label>
          <div
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            onClick={() => document.getElementById("file-input")?.click()}
            style={{
              border: "2px dashed var(--color-border)", borderRadius: 8,
              padding: "1.25rem", textAlign: "center", cursor: "pointer",
              color: "var(--color-muted)", fontSize: "0.82rem",
              background: "rgba(255,255,255,0.02)",
            }}
          >
            파일을 여기에 드래그하거나 클릭해서 선택
            <input
              id="file-input"
              type="file"
              multiple
              style={{ display: "none" }}
              onChange={e => Array.from(e.target.files ?? []).forEach(f => void uploadFile(f))}
            />
          </div>
          {attachments.length > 0 && (
            <div style={{ marginTop: "0.5rem", display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
              {attachments.map(a => (
                <span key={a.id} style={{
                  background: a.uploading ? "rgba(255,255,255,0.05)" : "rgba(100,180,255,0.12)",
                  border: `1px solid ${a.uploading ? "var(--color-border)" : "rgba(100,180,255,0.3)"}`,
                  borderRadius: 6, padding: "0.2rem 0.6rem",
                  fontSize: "0.75rem", color: a.uploading ? "var(--color-muted)" : "#7aaee8",
                  display: "flex", alignItems: "center", gap: "0.3rem",
                }}>
                  {a.uploading ? "⏳" : "✓"} {a.filename}
                  {!a.uploading && (
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); setAttachments(prev => prev.filter(x => x.id !== a.id)); }}
                      style={{ background: "none", border: "none", color: "var(--color-muted)", cursor: "pointer", padding: 0, marginLeft: 2 }}
                    >×</button>
                  )}
                </span>
              ))}
            </div>
          )}
        </div>
```

- [ ] **Step 4: 타입 체크**

```bash
cd apps/web && npx tsc --noEmit
```

- [ ] **Step 5: 커밋**

```bash
git add apps/web/src/components/project/ProjectIntakeForm.tsx
git commit -m "feat: 프로젝트 의뢰 폼에 파일 드롭존 추가"
```

---

## Task 8: 캐릭터 메시지 API에 attachmentIds 연동

**Files:**
- Modify: `apps/api/src/routes/characters.ts`

- [ ] **Step 1: messageSchema에 attachmentIds 추가**

`apps/api/src/routes/characters.ts` 에서:

```typescript
const messageSchema = z.object({
  message: z.string().min(1).max(500),
  attachmentIds: z.array(z.string()).max(10).optional(),
});
```

- [ ] **Step 2: 핸들러에서 attachmentIds 처리 + 큐 payload에 포함**

`POST /:id/message` 핸들러에서 `const { message } = parsed.data;` 를:

```typescript
    const { message, attachmentIds } = parsed.data;

    // 첨부파일 컨텍스트 조회
    let attachmentContext = "";
    if (attachmentIds?.length) {
      const { data: atts } = await sb.from("attachments").select("filename, extracted_text").in("id", attachmentIds);
      if (atts?.length) {
        attachmentContext = (atts as Array<{ filename: string; extracted_text: string }>)
          .map(a => `[첨부: ${a.filename}]\n${a.extracted_text}`)
          .join("\n\n---\n\n");
      }
    }

    const fullMessage = attachmentContext
      ? `${message}\n\n[첨부 파일 내용]\n${attachmentContext}`
      : message;
```

그리고 `enqueueJob` payload를:
```typescript
        payload: { characterId: charId, message: fullMessage },
```

- [ ] **Step 3: 타입 체크**

```bash
cd apps/api && npx tsc --noEmit
```

- [ ] **Step 4: 커밋**

```bash
git add apps/api/src/routes/characters.ts
git commit -m "feat: 캐릭터 메시지 API — 첨부파일 컨텍스트 메시지에 병합"
```

---

## Task 9: FounderMessageInput 파일 첨부 UI

**Files:**
- Modify: `apps/web/src/components/world/IsometricWorldCanvas.tsx`

- [ ] **Step 1: FounderMessageInput에 attachment state + 업로드 핸들러 추가**

`IsometricWorldCanvas.tsx` 의 `FounderMessageInput` 함수 내부 (기존 state 선언 아래) 추가:

```typescript
  const [attachments, setAttachments] = useState<Array<{ id: string; filename: string; uploading?: boolean }>>([]);

  const uploadFile = async (file: File) => {
    const tempId = `temp_${Date.now()}`;
    setAttachments(prev => [...prev, { id: tempId, filename: file.name, uploading: true }]);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const token = window.localStorage.getItem("BLOKS_AUTH_TOKEN") ?? "dev-bypass";
      const res = await fetch("/api/v1/attachments", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const json = await res.json() as { ok: boolean; data?: { id: string; filename: string } };
      if (json.ok && json.data) {
        setAttachments(prev => prev.map(a => a.id === tempId ? { id: json.data!.id, filename: json.data!.filename } : a));
      } else {
        setAttachments(prev => prev.filter(a => a.id !== tempId));
      }
    } catch {
      setAttachments(prev => prev.filter(a => a.id !== tempId));
    }
  };
```

- [ ] **Step 2: send 함수에서 message 모드일 때 attachmentIds 포함**

기존 `mode === "message"` 분기에서:

```typescript
      if (mode === "message") {
        const attIds = attachments.filter(a => !a.uploading).map(a => a.id);
        await apiPost<unknown>(`/characters/${charId}/message`, {
          message: text,
          ...(attIds.length > 0 ? { attachmentIds: attIds } : {}),
        });
        setMsg("");
        setAttachments([]);
        setFeedback({ ok: true, text: "메시지 전송됨" });
```

- [ ] **Step 3: 메시지 입력창 아래에 📎 버튼 추가**

기존 전송 버튼 row 찾아서 📎 파일 첨부 버튼 추가 (전송 버튼 옆):

```tsx
              <button
                type="button"
                onClick={() => document.getElementById(`file-input-${charId}`)?.click()}
                title="파일 첨부"
                style={{
                  background: "none", border: "1px solid var(--color-border)",
                  borderRadius: 6, padding: "0.3rem 0.5rem",
                  color: "var(--color-muted)", cursor: "pointer", fontSize: "0.82rem",
                }}
              >📎</button>
              <input
                id={`file-input-${charId}`}
                type="file"
                multiple
                style={{ display: "none" }}
                onChange={e => Array.from(e.target.files ?? []).forEach(f => void uploadFile(f))}
              />
```

그리고 전송 버튼 위에 첨부파일 목록 표시:

```tsx
              {attachments.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem", marginBottom: "0.4rem" }}>
                  {attachments.map(a => (
                    <span key={a.id} style={{
                      fontSize: "0.7rem", padding: "0.15rem 0.4rem",
                      background: a.uploading ? "rgba(255,255,255,0.05)" : "rgba(100,180,255,0.12)",
                      border: "1px solid rgba(100,180,255,0.2)", borderRadius: 4,
                      color: a.uploading ? "var(--color-muted)" : "#7aaee8",
                    }}>
                      {a.uploading ? "⏳" : "✓"} {a.filename}
                      {!a.uploading && (
                        <button type="button"
                          onClick={() => setAttachments(p => p.filter(x => x.id !== a.id))}
                          style={{ background: "none", border: "none", color: "var(--color-muted)", cursor: "pointer", marginLeft: 2, padding: 0 }}
                        >×</button>
                      )}
                    </span>
                  ))}
                </div>
              )}
```

- [ ] **Step 4: 타입 체크**

```bash
cd apps/web && npx tsc --noEmit
```

- [ ] **Step 5: 커밋**

```bash
git add apps/web/src/components/world/IsometricWorldCanvas.tsx
git commit -m "feat: FounderMessageInput — 파일 첨부 📎 버튼 추가"
```

---

## Task 10: 최종 확인 및 푸시

- [ ] **Step 1: 전체 타입 체크**

```bash
pnpm lint
```
Expected: 오류 없음

- [ ] **Step 2: API smoke test**

```bash
node tools/api-smoke.mjs
```
Expected: `API smoke passed`

- [ ] **Step 3: 브라우저 확인 — 프로젝트 생성**

1. `localhost:3000/projects/new` 열기
2. 드롭존에 PDF 또는 이미지 드래그
3. `✓ filename.pdf` 표시 확인
4. 의뢰 내용 작성 후 제출
5. 프로젝트 생성 확인

- [ ] **Step 4: 브라우저 확인 — 캐릭터 대화**

1. `localhost:3000/world` 열기
2. 캐릭터 클릭 → 우측 패널 열림
3. 📎 버튼으로 파일 첨부
4. 메시지 작성 후 전송
5. 월드에서 캐릭터 말풍선 확인

- [ ] **Step 5: 최종 푸시**

```bash
git push origin main
```
