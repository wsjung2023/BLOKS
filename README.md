# BLOKS OS

> AI 직원들이 실제로 일하는 가상 회사 — 당신이 사장입니다.

---

## BLOKS OS가 뭔가요?

BLOKS OS는 **AI 에이전트를 직원처럼 운영하는 오픈소스 플랫폼**입니다.

화면 속 가상 오피스에 68명의 AI 직원이 있습니다. 각자 성격, 직급, 역할이 다르고 (CEO, CTO, 마케터, 개발자, 기획자 등) 서로 대화하며 일합니다. 당신은 사장으로서 일을 지시하고, 위험한 행동은 직접 승인하거나 거절합니다.

ChatGPT나 Claude에게 단순히 질문하는 것과 달리, BLOKS OS는 **여러 AI가 팀으로 협력**해서 일하는 과정 전체를 보여줍니다.

---

## 이걸로 뭘 할 수 있나요?

### 🏢 가상 오피스 월드 뷰
2D RPG 게임처럼 생긴 사무실에서 AI 직원들이 돌아다니고, 책상에 앉아 일하거나, 회의실에 모이는 모습을 실시간으로 볼 수 있습니다.

### 📋 프로젝트 & 태스크 관리
프로젝트를 만들고 태스크를 AI 직원에게 배정합니다. AI가 실제로 그 일을 처리하고 결과물을 돌려줍니다.

### ✅ 결재 센터 (L0~L3 위험 등급)
AI가 중요한 행동을 하기 전에 승인을 요청합니다. 위험도에 따라 4단계로 나뉩니다.
- **L0** — 낮은 위험 (자동 처리)
- **L1** — 주의 필요 (1인 승인)
- **L2** — 중요한 행동 (상위 결재 필요)
- **L3** — 매우 위험 (최고 관리자 승인)

### 📜 감사 로그
AI가 한 모든 행동이 기록됩니다. SHA-256 해시 체인으로 위·변조가 불가능하고, CSV/JSONL로 내보낼 수 있습니다.

### 🚨 킬 스위치
긴급 상황 시 모든 AI 실행을 즉시 중단합니다.

### 🗺️ 맵 에디터
가상 오피스 레이아웃(책상 배치, 회의실 위치 등)을 직접 편집합니다.

### 🎭 데모 시나리오
미리 준비된 시나리오를 실행해서 BLOKS OS가 어떻게 동작하는지 빠르게 체험합니다.

### 👥 68명 AI 직원
각 직원의 프로필, 성격, 상태, 업무량, 피로도를 확인합니다. 직원마다 AI 모델이 다릅니다 (GPT-4o, Claude, Gemini 등).

---

## 설치하기

### 1단계: 터미널 열기

**Windows**
1. 시작 버튼 위에서 **마우스 오른쪽 클릭**
2. **"터미널"** 또는 **"Windows PowerShell"** 클릭

> ⚠️ **"관리자 권한으로 실행"은 하지 마세요.** 관리자 터미널은 Node.js 경로를 인식하지 못합니다.

**Mac**
- `Command + Space` → `터미널` 검색 → 엔터

---

### 2단계: 필요한 프로그램 설치

**Node.js 20 이상** (JavaScript 실행 환경)
- [nodejs.org](https://nodejs.org) → "LTS" 버전 다운로드 → 설치
- 설치 완료 후 **터미널을 닫고 다시 열어주세요**

**Git** (코드 다운로드 도구)
- [git-scm.com](https://git-scm.com) → 다운로드 → 설치
- 설치 완료 후 **터미널을 닫고 다시 열어주세요**

**pnpm** (패키지 관리자)

Node.js와 Git 설치 후, 터미널에 입력:

*Windows PowerShell만 해당 (Mac은 건너뛰세요):*
```
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
```
> `Y` 누르고 엔터. 한 번만 하면 됩니다.

*Windows / Mac 공통:*
```
npm install -g pnpm
```
> `1 package is looking for funding` 메시지는 정상입니다.

---

### 3단계: BLOKS OS 다운로드

터미널에 아래를 **한 줄씩** 입력하고 엔터를 누르세요.

```
cd ~
```
> 내 홈 폴더로 이동합니다.

```
git clone https://github.com/wsjung2023/BLOKS.git
```
> GitHub에서 소스코드를 내 컴퓨터로 다운로드합니다. (약 50MB, 1~3분)

```
cd BLOKS
```

```
pnpm install
```
> 필요한 패키지를 설치합니다. 인터넷 속도에 따라 **3~10분** 걸립니다.

---

### 4단계: 실행

```
pnpm dev
```

> ⏳ 처음 실행 시 **1~2분** 기다려야 합니다.

브라우저에서 **`http://localhost:3000`** 을 열면 BLOKS OS가 시작됩니다.

> 종료하려면 터미널에서 `Ctrl + C`

설치 즉시 68명의 AI 직원이 로드됩니다. **API 키 없이도** 가상 오피스, 태스크 보드, 결재 센터, 감사 로그, 맵 에디터 등 대부분의 기능을 바로 사용할 수 있습니다.

---

### 5단계: AI 기능 켜기 (선택사항)

AI 직원이 **실제로 생각하고 대화하고 일**하게 하려면 AI API 키가 필요합니다.

`.env` 파일을 열어 키를 입력하세요:

**Windows:**
```
notepad .env
```

**Mac:**
```
open -e .env
```

| AI 서비스 | 키 형식 | 발급 주소 |
|-----------|---------|-----------|
| OpenAI (GPT-4o) | `sk-proj-...` | platform.openai.com |
| Anthropic (Claude) | `sk-ant-...` | console.anthropic.com |
| Google AI (Gemini) | `AIza...` | aistudio.google.com |

세 가지 중 하나만 있어도 됩니다. 입력한 키는 **이 컴퓨터에만** 저장됩니다.

`.env` 파일 저장 후 `pnpm dev`를 재시작하면 AI가 활성화됩니다.

---

## 자주 묻는 질문

**Q. Docker, Supabase, Redis가 필요한가요?**  
필요 없습니다. 기본 모드에서는 아무것도 설치하지 않아도 됩니다.

**Q. 비용이 드나요?**  
BLOKS OS 자체는 완전 무료입니다. AI API 키를 사용하면 사용량만큼 소액의 비용이 발생합니다. AI 없이 쓰면 비용은 0원입니다.

**Q. 데이터는 어디에 저장되나요?**  
내 컴퓨터 안 `.bloks-data/local-db.json` 파일에 저장됩니다. 인터넷에 올라가지 않습니다.

**Q. 다시 시작하려면?**

Windows:
```
cd ~\BLOKS
pnpm dev
```

Mac:
```
cd ~/BLOKS
pnpm dev
```

**Q. PC 켤 때마다 자동으로 시작되게 하고 싶어요.**

BLOKS 폴더에서 한 번만 실행하세요:
```
pnpm bloks-os autostart enable
```

이후 PC를 재시작하면 백그라운드에서 자동으로 실행됩니다. 브라우저에서 `http://localhost:3000` 으로 접속하면 됩니다.

해제하려면:
```
pnpm bloks-os autostart disable
```

현재 상태 확인:
```
pnpm bloks-os autostart status
```

**Q. 최신 버전으로 업데이트하려면?**

BLOKS 폴더에서 아래 순서대로 실행하세요:

```
git pull
pnpm install
pnpm dev
```

> `pnpm-lock.yaml` 충돌 오류가 나면 아래를 먼저 실행한 뒤 다시 시도하세요:
> ```
> git checkout pnpm-lock.yaml
> git pull
> pnpm install
> ```

업데이트 후 변경 사항을 확인하려면:
```
git log --oneline -10
```

**Q. 캐릭터 스프라이트(이미지)가 깨지거나 검은 박스로 보여요.**

업데이트 도중 이미지 파일이 손실되는 경우가 있습니다. 아래 명령어 하나로 복원할 수 있습니다:

Windows:
```
cd ~\BLOKS
git checkout -- apps/web/public/sprites-v2/
```

Mac:
```
cd ~/BLOKS
git checkout -- apps/web/public/sprites-v2/
```

> 이 명령어는 sprites-v2 폴더 안의 파일만 복원하며, 다른 데이터(.bloks-data 등)에는 영향을 주지 않습니다.

**Q. AI 직원이 말을 안 해요.**  
AI API 키를 아직 설정하지 않아서입니다. 위 5단계를 참고해 `.env`에 키를 입력해주세요.

**Q. 인터넷이 없어도 되나요?**  
가상 오피스, 태스크 보드, 결재, 감사, 맵 에디터 등 대부분의 기능은 인터넷 없이도 됩니다. AI 직원이 실제로 응답하는 기능만 인터넷이 필요합니다.

---

## 문제가 생겼을 때

```
pnpm bloks-os doctor
```

이 명령어가 문제를 자동으로 찾아서 해결 방법을 알려줍니다.

### 자주 겪는 문제 빠른 해결표

| 증상 | 해결 방법 |
|------|---------|
| `git pull` 실패 (pnpm-lock.yaml 충돌) | `git checkout pnpm-lock.yaml` 후 다시 `git pull` |
| 캐릭터가 한 명도 안 나와요 | `pnpm dev` 재시작, 안 되면 `.bloks-data/` 폴더 삭제 후 재시작 |
| 스프라이트가 검은 박스로 보여요 | `git checkout -- apps/web/public/sprites-v2/` |
| 로그인 화면이 뜨고 넘어가지 않아요 | 브라우저 주소창에 `http://localhost:3000` 직접 입력 |
| 포트 4000 이미 사용 중 오류 | 이미 실행 중인 BLOKS를 먼저 종료 (`Ctrl+C`) 후 재시작 |
| `pnpm: command not found` | `npm install -g pnpm` 실행 후 터미널 재시작 |

---

## 개발자를 위한 정보

```bash
pnpm dev      # 개발 서버 실행 (코드 수정 시 자동 재시작)
pnpm test     # 테스트 실행
pnpm lint     # 타입 검사
```

**기술 스택**

| 레이어 | 기술 |
|--------|------|
| 프론트엔드 | Next.js 15, Phaser 3 (월드), React |
| 백엔드 | Express, BullMQ |
| 데이터 | 로컬 JSON (기본) / Supabase (선택, `BLOKS_PROFILE=connected`) |
| AI | OpenAI, Anthropic Claude, Google Gemini |

**클라우드 연결 모드** (팀 협업이 필요할 때)

여러 명이 같은 데이터를 공유하려면 `.env` 파일에 아래를 추가합니다.

```bash
BLOKS_PROFILE=connected
SUPABASE_URL=https://[ref].supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
REDIS_URL=redis://...
```

---

## 라이선스

MIT — 자유롭게 사용, 수정, 배포할 수 있습니다.
