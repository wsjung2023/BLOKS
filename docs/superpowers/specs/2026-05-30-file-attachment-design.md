# BLOKS 파일 첨부 기능 Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 프로젝트 의뢰 및 캐릭터 대화 시 다양한 파일(PDF, DOCX, XLSX, PPTX, 이미지, 영상)을 첨부하면 AI가 내용을 분석해 작업에 활용한다.

**Architecture:**
- 업로드된 파일은 `.bloks-data/attachments/{id}/` 에 로컬 저장
- API 서버가 파일 유형별 파서로 텍스트/설명 추출
- 추출 결과를 프로젝트 `brief` 또는 캐릭터 메시지 컨텍스트에 자동 병합
- AI Router(`routeAI`)가 attachment_context를 시스템 프롬프트에 포함

**Tech Stack:** Next.js multipart upload, Express multer, pdf-parse, mammoth, xlsx, OpenAI Vision/Whisper

---

## 파일 유형별 처리 방식

| 확장자 | 파서 | 출력 |
|--------|------|------|
| `.pdf` | `pdf-parse` | 페이지별 텍스트 |
| `.docx`, `.doc` | `mammoth` | 마크다운 텍스트 |
| `.xlsx`, `.xls`, `.csv` | `xlsx` | 시트명 + 셀 데이터 텍스트 |
| `.pptx` | `officeparser` | 슬라이드별 텍스트 |
| `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp` | OpenAI Vision (gpt-4o) | 이미지 설명 텍스트 |
| `.mp4`, `.mov`, `.avi`, `.webm`, `.mp3`, `.m4a` | OpenAI Whisper | 음성→텍스트 |
| 그 외 | 파일명 + 크기만 기록 | "첨부파일: filename.ext (NKB)" |

---

## 컴포넌트 구조

### 1. API — 파일 업로드 엔드포인트

**`apps/api/src/routes/attachments.ts`** (신규)
- `POST /api/v1/attachments` — multipart/form-data, 최대 50MB
- multer로 `.bloks-data/attachments/{ulid}/` 에 저장
- 파일 유형 감지 → 파서 실행 → extracted_text 반환
- 응답: `{ id, filename, mime_type, extracted_text, size }`

### 2. 파서 모듈

**`apps/api/src/lib/file-parser.ts`** (신규)
- `parseFile(filePath, mimeType): Promise<string>` — 단일 진입점
- 내부에서 pdf-parse / mammoth / xlsx / officeparser / OpenAI Vision / Whisper 분기

### 3. 프로젝트 생성 폼 — 파일 첨부 UI

**`apps/web/src/components/project/ProjectIntakeForm.tsx`** (수정)
- 의뢰 내용 textarea 아래 파일 드롭존 추가
- 파일 선택 시 즉시 `/api/v1/attachments`로 업로드 → 추출 완료 표시
- 제출 시 `attachment_ids: string[]` 함께 전송

**`apps/api/src/routes/projects.ts`** (수정)
- `POST /projects` 요청에 `attachment_ids` 추가
- 각 첨부파일의 `extracted_text`를 `brief`에 병합하여 저장

### 4. 캐릭터 대화 — 파일 첨부 UI

**`apps/web/src/components/world/IsometricWorldCanvas.tsx`** (수정)
- `FounderMessageInput` 컴포넌트에 📎 버튼 추가
- 메시지 전송 시 `attachment_ids` 포함
- `POST /characters/:id/message` 에 `attachmentIds` 전달

**`apps/api/src/routes/characters.ts`** (수정)
- `POST /characters/:id/message` 바디에 `attachmentIds?: string[]` 추가
- 파운더 메시지 큐 payload에 `attachmentContext` 포함

### 5. AI 컨텍스트 주입

**`apps/worker/src/handlers.ts`** (수정)
- `runAiTask()` 및 파운더 메시지 핸들러에서 `attachmentContext` 수신
- 시스템 프롬프트에 첨부 내용 블록으로 삽입:

```
[첨부 파일 컨텍스트]
파일: report.pdf
내용: (추출된 텍스트...)

파일: photo.jpg
내용: (이미지 설명...)
```

### 6. 로컬 DB — 첨부파일 테이블

**`packages/db/src/local-stub.ts`** (수정)
- `attachments` 테이블 추가:
  ```ts
  { id, filename, mime_type, size, extracted_text, created_at }
  ```

---

## 데이터 흐름

```
[사용자] 파일 드래그 or 클릭 선택
    ↓
[Web] POST /api/v1/attachments (multipart)
    ↓
[API] multer 저장 → file-parser.ts → extracted_text
    ↓
[Web] 파일 카드 표시 (파일명 + ✓ 추출 완료)
    ↓
[사용자] 프롬프트 작성 후 제출
    ↓
[API] POST /projects or /characters/:id/message
      → attachment_ids → extracted_text 조회
      → brief / message에 병합
    ↓
[Worker] routeAI() 호출 시 시스템 프롬프트에 첨부 컨텍스트 포함
    ↓
[AI] 파일 내용을 이해하고 태스크 수행
```

---

## 제약 및 예외 처리

- 파일 크기 최대 **50MB** (영상 포함)
- Vision/Whisper 사용 시 `OPENAI_API_KEY` 필요 → 없으면 "파일명만 기록" 폴백
- PPTX 파서 실패 시 파일명만 기록 (graceful degradation)
- 동일 파일 재업로드 시 새 ID로 중복 저장 (단순화)
- 첨부파일 저장 경로: `.bloks-data/attachments/{attachment_id}/original_filename`

---

## 신규 의존성

```json
// apps/api
"pdf-parse": "^1.1.1",
"mammoth": "^1.8.0",
"xlsx": "^0.18.5",
"officeparser": "^4.1.2",
"multer": "^1.4.5-lts.1",
"@types/multer": "^1.4.12",
"@types/pdf-parse": "^1.1.4"
```
