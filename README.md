# BLOKS OS

**AI 에이전트를 직원처럼 운영하는 오픈소스 시뮬레이션 OS**  
AI가 실제로 일하는 모습을 실시간으로 보고, 위험한 행동은 직접 승인하고, 모든 기록을 감사할 수 있습니다.

---

## 이게 뭔가요?

BLOKS OS는 AI 에이전트를 **직원처럼 운영**할 수 있는 오픈소스 플랫폼입니다.

- 68명의 AI 캐릭터가 가상 오피스에서 동시에 일함
- 파일 읽기/쓰기, 코드 실행 같은 실제 도구를 사용
- 위험한 행동은 사람이 직접 승인/차단
- 모든 행동이 감사 로그에 기록되고 검증 가능

## 주요 기능

- **월드 뷰** — 2D RPG 스타일로 AI 캐릭터들이 실시간으로 일하는 모습 시각화
- **태스크 보드** — AI 캐릭터에게 프로젝트/태스크 할당
- **결재 센터** — L0~L3 위험 등급별 도구 실행 승인/차단
- **감사 로그** — SHA-256 해시 체인으로 모든 행동 기록, CSV/JSONL 내보내기
- **킬 스위치** — 긴급 시 모든 실행 즉시 일시정지

---

## 설치 방법

### 사전 준비

| 항목 | 설명 |
|------|------|
| Node.js 20+ | [nodejs.org](https://nodejs.org) |
| pnpm | `npm install -g pnpm` |
| Git | [git-scm.com](https://git-scm.com) |

> Docker, Supabase, Redis **필요 없습니다.** 설치 후 바로 실행됩니다.

### 설치

```bash
git clone https://github.com/wsjung2023/BLOKS.git
cd BLOKS
pnpm install
pnpm bloks-os start
```

브라우저가 자동으로 열립니다. API 키 없이도 월드 뷰, 태스크 보드, 결재, 감사 기능을 바로 사용할 수 있습니다.

데이터는 `.bloks-data/local-db.json`에 저장되며 재시작 후에도 유지됩니다.

### AI 기능 활성화 (선택)

AI 캐릭터가 실제로 응답하게 하려면 **본인의** AI API 키가 필요합니다.

```bash
pnpm bloks-os init
```

실행하면 아래를 순서대로 물어봅니다 — 없는 건 Enter로 건너뛰면 됩니다.

```
OpenAI API 키   (sk-proj-...)   → platform.openai.com
Anthropic 키    (sk-ant-...)    → console.anthropic.com
Google AI 키    (AIza...)       → aistudio.google.com
```

세 개 모두 선택사항이고, 입력한 키는 이 PC의 `.env` 파일에만 저장됩니다.  
**다른 사람의 키와 공유되지 않습니다.**

---

## 개발 환경

```bash
# 전체 개발 서버 (API + Web + Worker)
pnpm dev

# 테스트
pnpm test

# 환경 진단
pnpm bloks-os doctor
```

---

## 기술 스택

| 레이어 | 기술 |
|--------|------|
| 프론트엔드 | Next.js 15, Phaser 3 (월드), React |
| 백엔드 | Express |
| 데이터 | 로컬 JSON (기본) / Supabase (선택, `BLOKS_PROFILE=connected`) |
| AI | OpenAI, Anthropic, Google AI (ai-router로 자동 선택) |

---

## 클라우드 연결 모드 (선택)

Supabase + Redis를 사용하는 팀 협업 모드가 필요하면 `.env`에서 설정합니다.

```bash
BLOKS_PROFILE=connected
SUPABASE_URL=https://[ref].supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
REDIS_URL=redis://...
```

---

## 라이선스

MIT
