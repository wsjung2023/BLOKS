# BLOKS OS

**AI 에이전트를 직원처럼 운영하는 오픈소스 시뮬레이션 OS**
AI가 실제로 일하는 모습을 실시간으로 보고, 위험한 행동은 직접 승인하고, 모든 기록을 감사할 수 있습니다.

---

## 이게 뭔가요?

BLOKS OS는 AI 에이전트를 **직원처럼 운영**할 수 있는 오픈소스 플랫폼입니다.

- 여러 AI 캐릭터가 가상 오피스에서 동시에 일함
- 파일 읽기/쓰기, 코드 실행 같은 실제 도구를 사용
- 위험한 행동은 사람이 직접 승인/차단
- 모든 행동이 감사 로그에 기록되고 검증 가능

## 주요 기능

- **월드 뷰** — 2D RPG 스타일로 AI 캐릭터들이 실시간으로 일하는 모습 시각화
- **태스크 보드** — AI 캐릭터에게 프로젝트/태스크 할당
- **결재 센터** — L0~L3 위험 등급별 도구 실행 승인/차단
- **감사 로그** — SHA-256 해시 체인으로 모든 행동 기록, CSV/JSONL 내보내기
- **킬 스위치** — 긴급 시 모든 실행 즉시 일시정지
- **로컬 우선** — Supabase/Redis 없이도 즉시 실행 가능

---

## 설치 방법

### 사전 준비

| 항목 | 설명 |
|------|------|
| Node.js 20+ | [nodejs.org](https://nodejs.org) |
| pnpm | `npm install -g pnpm` |
| Git | [git-scm.com](https://git-scm.com) |
| OpenAI API 키 | [platform.openai.com](https://platform.openai.com) — AI 기능 사용 시 필요 |
| Supabase 프로젝트 | [supabase.com](https://supabase.com) — 데이터 저장 시 필요 (무료 플랜 가능) |

> **로컬 모드**: OpenAI 키와 Supabase 없이도 툴 실행, 결재, 감사 기능을 바로 써볼 수 있습니다.

### 설치

```bash
# 1. 저장소 클론
git clone https://github.com/wsjung2023/BLOKS.git
cd BLOKS

# 2. 패키지 설치
pnpm install

# 3. 설정 마법사 실행 (Supabase/OpenAI 키 입력)
pnpm bloks-os init

# 4. 실행
pnpm bloks-os start
```

브라우저가 자동으로 열립니다. 🎉

### Supabase 설정 방법

1. [supabase.com](https://supabase.com) 에서 무료 계정 생성
2. 새 프로젝트 생성
3. **Settings → API** 에서 `Project URL`과 `service_role` 키 복사
4. `pnpm bloks-os init` 실행 시 입력, 또는 `.env` 파일에 직접 입력:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

5. 데이터베이스 스키마 적용:

```bash
pnpm db:migrate
pnpm db:seed
```

---

## 환경 진단

```bash
pnpm bloks-os doctor
```

설정 문제를 자동으로 감지하고 해결 방법을 안내합니다.

---

## 기술 스택

| 레이어 | 기술 |
|--------|------|
| 프론트엔드 | Next.js 15, Phaser 3 (월드), React |
| 백엔드 | Express, BullMQ |
| 데이터베이스 | Supabase (PostgreSQL), Prisma |
| AI | OpenAI (기본), ai-router로 멀티 프로바이더 확장 가능 |
| 인프라 | Docker Compose, Helm (Kubernetes) |

---

## 개발 환경 실행

```bash
# 의존 서비스 (PostgreSQL + Redis)
docker compose up -d

# 전체 개발 서버
pnpm dev

# 테스트
pnpm test

# E2E 테스트
pnpm --filter web exec playwright test
```

---

## 라이선스

MIT
