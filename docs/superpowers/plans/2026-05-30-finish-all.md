# BLOKS 전체 마무리 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 스펙 100% 완료 + 협업 시스템 UI + 월드 UX 개선 + Vercel/Railway 배포 설정까지 오늘 전부 완료

**Architecture:** 각 태스크는 독립적으로 완료 가능. 배포(Task 6)는 나머지가 모두 완료된 뒤 진행. 로컬 in-memory DB는 Railway 배포 시 파일 마운트 방식으로 유지.

**Tech Stack:** Next.js 15, Express, BullMQ, Phaser, pnpm monorepo, Vercel (web), Railway (api+worker)

---

## Task 1: Smoke Test 수정 (스펙 마지막 체크박스)

**문제:** `api-smoke.mjs`가 `spawn("pnpm", ...)` 로 서버를 띄우는데 PATH에 pnpm이 없어서 실패함.

**Files:**
- Modify: `tools/api-smoke.mjs`

- [ ] **Step 1: spawn 명령어 수정**

`tools/api-smoke.mjs` 의 `spawn` 호출을 다음으로 교체:

```js
// 기존
const server = spawn("pnpm", ["--filter", "api", "exec", "tsx", "src/index.ts"], {
```
→
```js
const npmCmd = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const server = spawn(npmCmd, ["--filter", "api", "exec", "tsx", "src/index.ts"], {
```

- [ ] **Step 2: smoke test 직접 실행 확인**

```bash
node tools/api-smoke.mjs
```
Expected: `✓ /health -> 200`, `✓ /api/v1/tasks...`, `API smoke passed`

- [ ] **Step 3: spec 체커 통과 확인**

```bash
pnpm progress:spec
```
Expected: `overall: 40/40 (100.00%)`

- [ ] **Step 4: 커밋**

```bash
git add tools/api-smoke.mjs
git commit -m "fix: api-smoke pnpm path 수정 — Windows에서 .cmd 확장자 처리"
```

---

## Task 2: 캐릭터 목록 → 스프라이트 에디터 바로가기

**문제:** 캐릭터 카드 클릭 시 정보 패널만 뜨고 스프라이트 에디터로 이동하는 버튼이 없음.

**Files:**
- Modify: `apps/web/src/app/characters/page.tsx`

- [ ] **Step 1: useRouter import 추가 및 편집 버튼 추가**

`page.tsx` 상단 import에 추가:
```tsx
import { useRouter } from "next/navigation";
```

`CharacterDirectoryPage` 함수 안 상단에 추가:
```tsx
const router = useRouter();
```

`openCharacterPanel` 함수 안 패널 내용 맨 아래에 추가:
```tsx
<button
  onClick={() => router.push(`/characters/editor?id=${character.id}`)}
  style={{
    marginTop: "0.5rem", width: "100%", padding: "0.5rem",
    background: "rgba(100,180,255,0.15)", border: "1px solid rgba(100,180,255,0.3)",
    borderRadius: 8, color: "#7aaee8", cursor: "pointer", fontSize: "0.82rem",
  }}
>
  🎨 스프라이트 에디터에서 편집
</button>
```

- [ ] **Step 2: 에디터 페이지가 ?id= 파라미터를 받는지 확인**

`apps/web/src/app/characters/editor/page.tsx`에서 `useSearchParams`로 id를 읽는 코드가 있는지 확인:
```bash
grep -n "searchParams\|useSearchParams\|selectedId" apps/web/src/app/characters/editor/page.tsx | head -10
```

- [ ] **Step 3: 에디터가 id 파라미터로 초기 캐릭터 선택하도록 수정 (없으면)**

`editor/page.tsx`에서 `setSelectedId` 초기화 부분을 찾아:
```tsx
// 기존 (apiGet 완료 후 첫 캐릭터 선택)
if (items[0]) setSelectedId(items[0].id);
```
→
```tsx
import { useSearchParams } from "next/navigation";
// ...
const searchParams = useSearchParams();
const targetId = searchParams.get("id");
// ...
if (targetId && items.find(c => c.id === targetId)) {
  setSelectedId(targetId);
} else if (items[0]) {
  setSelectedId(items[0].id);
}
```

- [ ] **Step 4: 브라우저에서 확인**

캐릭터 목록 → 카드 클릭 → 패널에서 "스프라이트 에디터에서 편집" 클릭 → 해당 캐릭터가 선택된 상태로 에디터 열림

- [ ] **Step 5: 커밋**

```bash
git add apps/web/src/app/characters/page.tsx apps/web/src/app/characters/editor/page.tsx
git commit -m "feat: 캐릭터 목록 → 스프라이트 에디터 바로가기 버튼"
```

---

## Task 3: 월드 캔버스 스프라이트 에디터 연동 확인

**현재 상태:** `WorldScene.ts`의 `getOrLoadStaticTexture`가 `/assets/characters/${slug}.png` 경로 시도 후 없으면 `/sprites-v2/...`로 폴백함. 이미 올바른 로직이나 실제 동작 확인 필요.

**Files:**
- Read only: `apps/web/src/components/world/WorldScene.ts`

- [ ] **Step 1: 실제 로드 경로 확인**

```bash
grep -n "assets/characters\|sprites-v2\|getOrLoad" apps/web/src/components/world/WorldScene.ts | head -20
```

Expected: `/assets/characters/${slug}.png` 시도 로직이 있음.

- [ ] **Step 2: 스프라이트 에디터에서 한 캐릭터 저장 후 월드에서 반영 확인**

1. `localhost:3000/characters/editor` 열기
2. 캐릭터 선택 → 옷 색 변경 → "스프라이트 저장" 클릭
3. `localhost:3000/world` 열기 → 해당 캐릭터 스프라이트가 바뀌었는지 확인

- [ ] **Step 3: 안 되면 WorldScene.ts에서 에디터 경로 우선 로드 추가**

`getOrLoadStaticTexture` 함수를 찾아서 `/assets/characters/${slug}.png` 시도 로직이 없으면 추가:
```ts
// 에디터 저장 경로 우선 시도
const editorKey = `editor_${slug}`;
if (!this.textures.exists(editorKey)) {
  this.load.image(editorKey, `/assets/characters/${slug}.png`);
}
```

- [ ] **Step 4: 커밋 (변경사항 있으면)**

```bash
git add apps/web/src/components/world/WorldScene.ts
git commit -m "fix: 월드 캔버스 — 에디터 저장 스프라이트 우선 표시"
```

---

## Task 4: 태스크 보드 피드백 버튼

**현재 상태:** `board/page.tsx` 라인 454에 `{/* 피드백 */}` 주석만 있고 실제 피드백 폼이 없음. API(`POST /tasks/:id/feedback`)는 완전히 구현되어 있음.

**Files:**
- Modify: `apps/web/src/app/board/page.tsx`

- [ ] **Step 1: 보드 페이지에서 태스크 상태가 InReview인 경우 파악**

```bash
grep -n "InReview\|Done\|state\|selectedTask" apps/web/src/app/board/page.tsx | head -20
```

- [ ] **Step 2: 피드백 state 및 핸들러 추가**

`TaskDetailPanel` 컴포넌트(또는 태스크 상세 렌더링 부분)에 state 추가:
```tsx
const [feedbackText, setFeedbackText] = useState("");
const [submittingFeedback, setSubmittingFeedback] = useState(false);

async function submitFeedback(taskId: string) {
  if (!feedbackText.trim()) return;
  setSubmittingFeedback(true);
  try {
    await apiPost(`/tasks/${taskId}/feedback`, {
      comment: feedbackText,
      requestRevision: true,
    });
    setFeedbackText("");
    // 태스크 목록 새로고침
    loadTasks();
  } catch {
    // ignore
  } finally {
    setSubmittingFeedback(false);
  }
}
```

- [ ] **Step 3: 피드백 UI 렌더링 — InReview 또는 Done 상태 태스크에만 표시**

라인 454 `{/* 피드백 */}` 아래에 추가:
```tsx
{(task.state === "InReview" || task.state === "Done") && (
  <div style={{ marginTop: "1rem", borderTop: "1px solid var(--color-border)", paddingTop: "0.75rem" }}>
    <div style={{ fontSize: "0.78rem", fontWeight: 600, marginBottom: "0.4rem", color: "var(--color-muted)" }}>
      피드백 / 재작업 요청
    </div>
    <textarea
      value={feedbackText}
      onChange={(e) => setFeedbackText(e.target.value)}
      placeholder="피드백 내용을 입력하세요..."
      rows={3}
      style={{
        width: "100%", padding: "0.5rem", borderRadius: 6,
        border: "1px solid var(--color-border)", background: "var(--color-panel)",
        color: "var(--color-text)", fontSize: "0.78rem", resize: "vertical",
        boxSizing: "border-box",
      }}
    />
    <button
      onClick={() => submitFeedback(task.id)}
      disabled={submittingFeedback || !feedbackText.trim()}
      style={{
        marginTop: "0.4rem", padding: "0.4rem 1rem", borderRadius: 6,
        background: "rgba(90,140,220,0.2)", border: "1px solid rgba(90,140,220,0.4)",
        color: "#7aaee8", cursor: "pointer", fontSize: "0.78rem",
        opacity: submittingFeedback || !feedbackText.trim() ? 0.5 : 1,
      }}
    >
      {submittingFeedback ? "전송 중..." : "↩ 재작업 요청"}
    </button>
  </div>
)}
```

- [ ] **Step 4: 타입 체크**

```bash
cd apps/web && npx tsc --noEmit
```

- [ ] **Step 5: 브라우저 확인**

태스크 보드 → InReview 상태 태스크 클릭 → 피드백 텍스트에어리어 + 재작업 요청 버튼 표시 확인

- [ ] **Step 6: 커밋**

```bash
git add apps/web/src/app/board/page.tsx
git commit -m "feat: 태스크 보드 피드백/재작업 요청 UI"
```

---

## Task 5: 월드 캐릭터 역할 레이블

**현재 상태:** `WorldScene.ts` 라인 532에서 `char.name`만 표시. 역할(role) 정보를 추가해야 함.

**Files:**
- Modify: `apps/web/src/components/world/WorldScene.ts`

- [ ] **Step 1: WorldCharacter 인터페이스에 role 필드 확인**

```bash
grep -n "interface WorldCharacter\|role\|division" apps/web/src/components/world/WorldScene.ts | head -15
```

- [ ] **Step 2: role 필드 추가 (없으면)**

`WorldCharacter` 인터페이스에:
```ts
role?: string;
division?: string;
```

- [ ] **Step 3: 역할 서브레이블 추가**

라인 541 (`.setOrigin(0.5, 1)`) 바로 아래:
```ts
let roleLabel: PhText | null = null;
if (char.role) {
  roleLabel = this.add.text(
    0, LABEL_OFFSET - sprite.displayHeight + 18,
    char.role,
    { fontSize: "16px", color: "#aaaacc", stroke: "#000000", strokeThickness: 3, resolution: 2 },
  ).setOrigin(0.5, 1);
}
```

`items` 배열에 roleLabel 추가:
```ts
const items: PhGameObj[] = [sprite, label, dot];
if (crown) items.push(crown);
if (badge) items.push(badge);
if (roleLabel) items.push(roleLabel);
```

- [ ] **Step 4: 캐릭터 데이터에 role 포함하여 전달**

API 응답에서 월드로 캐릭터를 전달하는 부분을 찾아 role 필드 추가:
```bash
grep -n "role\|division" apps/web/src/components/world/IsometricWorldCanvas.tsx | head -20
```

- [ ] **Step 5: 타입 체크**

```bash
cd apps/web && npx tsc --noEmit
```

- [ ] **Step 6: 커밋**

```bash
git add apps/web/src/components/world/WorldScene.ts apps/web/src/components/world/IsometricWorldCanvas.tsx
git commit -m "feat: 월드 캐릭터 이름 아래 역할 서브레이블 표시"
```

---

## Task 6: 배포 설정 (Vercel + Railway)

**현재 상태:** vercel.json, railway.json 없음. 로컬 in-memory DB는 `.bloks-data/local-db.json`에 파일로 저장됨.

**Files:**
- Create: `vercel.json`
- Create: `apps/api/Dockerfile`
- Create: `apps/worker/Dockerfile`
- Create: `railway.toml`
- Modify: `README.md`

### 6-A: Vercel (Web)

- [ ] **Step 1: vercel.json 생성**

```json
{
  "buildCommand": "pnpm --filter web build",
  "outputDirectory": "apps/web/.next",
  "installCommand": "pnpm install",
  "framework": "nextjs",
  "env": {
    "NEXT_PUBLIC_API_URL": "@bloks_api_url",
    "NEXT_PUBLIC_ENABLE_DEV_BYPASS_AUTH": "false"
  }
}
```

- [ ] **Step 2: Next.js API URL 환경변수 확인**

```bash
grep -rn "NEXT_PUBLIC_API_URL\|apiClient\|API_BASE" apps/web/src/lib/apiClient.ts
```

API base URL이 환경변수로 주입되는지 확인. 없으면 `apiClient.ts`에 추가:
```ts
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
```

### 6-B: Railway (API + Worker)

- [ ] **Step 3: railway.toml 생성**

```toml
[build]
builder = "nixpacks"

[[services]]
name = "api"
source = "apps/api"
startCommand = "node dist/index.js"
buildCommand = "cd ../.. && pnpm install && pnpm --filter api build"
envVars = ["PORT", "OPENAI_API_KEY", "REDIS_URL", "ENABLE_DEV_BYPASS_AUTH", "NODE_ENV"]
healthCheckPath = "/health"

[[services]]
name = "worker"
source = "apps/worker"
startCommand = "node dist/index.js"
buildCommand = "cd ../.. && pnpm install && pnpm --filter worker build"
envVars = ["REDIS_URL", "OPENAI_API_KEY", "NODE_ENV"]
```

- [ ] **Step 4: API 빌드 확인**

```bash
pnpm --filter api build 2>&1 | tail -5
```

- [ ] **Step 5: 환경변수 체크리스트 문서화**

`README.md` 배포 섹션에 추가:
```markdown
## 배포 환경변수

### Vercel (Web)
- `NEXT_PUBLIC_API_URL` — Railway API URL (예: https://bloks-api.railway.app)

### Railway (API)
- `PORT` — 자동 주입
- `OPENAI_API_KEY` — OpenAI API 키
- `ANTHROPIC_API_KEY` — Anthropic API 키 (선택)
- `REDIS_URL` — Railway Redis 플러그인 자동 주입
- `NODE_ENV=production`
- `BLOKS_DATA_DIR=/data` — 영구 볼륨 마운트 경로

### Railway 볼륨 설정
API 서비스에 `/data` 볼륨 마운트 → local-db.json 영구 보존
```

- [ ] **Step 6: 커밋**

```bash
git add vercel.json railway.toml README.md apps/web/src/lib/apiClient.ts
git commit -m "feat: Vercel + Railway 배포 설정"
git push origin main
```

---

## 완료 기준

```bash
pnpm progress:spec
# → overall: 40/40 (100.00%)

# 브라우저 확인
# 1. localhost:3000/characters → 카드 클릭 → "스프라이트 에디터에서 편집" 버튼 작동
# 2. localhost:3000/board → InReview 태스크에 피드백 폼 표시
# 3. localhost:3000/world → 캐릭터 이름 아래 역할 텍스트 표시
```
