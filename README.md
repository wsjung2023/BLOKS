# BLOKS OS

> AI 직원들이 실제로 일하는 가상 회사 — 당신이 사장입니다.

---

## BLOKS OS가 뭔가요?

BLOKS OS는 **AI 캐릭터들이 직원처럼 일하는 가상 회사 시뮬레이션**입니다.

화면 속 가상 오피스에 68명의 AI 직원이 있습니다. 이 직원들에게 일을 시키면, AI가 실제로 생각하고 응답하고 결과물을 만들어냅니다. 당신은 사장으로서 어떤 일을 할지 지시하고, 위험한 행동은 직접 승인하거나 거절합니다.

---

## 이걸로 뭘 할 수 있나요?

### 🏢 가상 오피스 구경하기
2D RPG 게임처럼 생긴 사무실에서 AI 직원들이 돌아다니고 대화하는 걸 실시간으로 볼 수 있습니다.

### 📋 AI에게 일 시키기
프로젝트를 만들고, 태스크를 만들어서 AI 직원에게 배정하면 AI가 실제로 작업합니다.
- "마케팅 전략 문서 작성해줘"
- "이 코드 리뷰해줘"
- "경쟁사 분석 보고서 만들어줘"

### ✅ 위험한 행동은 내가 직접 승인
AI가 중요한 행동(파일 삭제, 외부 API 호출 등)을 하기 전에 반드시 당신의 승인을 받습니다. 승인하거나 거절할 수 있습니다.

### 📜 모든 기록 확인하기
AI가 한 모든 행동이 감사 로그에 남습니다. 언제, 누가, 무엇을 했는지 전부 추적할 수 있습니다.

### 🚨 긴급 정지
AI가 이상한 행동을 하면 킬 스위치로 즉시 전체 일시정지할 수 있습니다.

---

## 설치하기

### 1단계: 필요한 프로그램 설치

아래 세 가지가 없으면 먼저 설치해주세요.

**Node.js** (JavaScript 실행 환경)
- [nodejs.org](https://nodejs.org) 에 접속
- "LTS" 버전 다운로드 버튼 클릭 → 설치

**pnpm** (패키지 관리자)
- Node.js 설치 후 터미널(명령 프롬프트)을 열고 아래 입력:
```
npm install -g pnpm
```

**Git** (코드 다운로드 도구)
- [git-scm.com](https://git-scm.com) 에서 다운로드 → 설치

> **터미널 여는 방법**
> - Windows: 키보드에서 `Windows키 + R` → `cmd` 입력 → 엔터
> - Mac: `Command + Space` → `터미널` 검색 → 엔터

---

### 2단계: BLOKS OS 다운로드

터미널에 아래를 한 줄씩 입력하세요.

```bash
git clone https://github.com/wsjung2023/BLOKS.git
cd BLOKS
pnpm install
```

`pnpm install`은 시간이 좀 걸립니다 (1~3분). 기다려주세요.

---

### 3단계: 실행

```bash
pnpm bloks-os start
```

잠시 후 브라우저가 자동으로 열리면서 BLOKS OS가 실행됩니다. 🎉

> 브라우저가 자동으로 안 열리면 직접 `http://localhost:3000` 을 주소창에 입력하세요.

---

### 4단계: AI 기능 켜기 (선택사항)

**이 단계를 안 해도** 가상 오피스 구경, 태스크 보드, 결재 기능은 전부 쓸 수 있습니다.  
AI 직원이 **실제로 대화하고 응답**하게 하려면 AI API 키가 필요합니다.

```bash
pnpm bloks-os init
```

실행하면 아래를 차례대로 물어봅니다. 갖고 있는 것만 입력하고, 없는 건 그냥 Enter를 누르세요.

```
OpenAI API 키   → platform.openai.com 에서 발급
Anthropic 키    → console.anthropic.com 에서 발급  
Google AI 키    → aistudio.google.com 에서 발급
```

**API 키란?**  
AI 서비스를 사용하는 일종의 비밀번호입니다. 본인 계정에서 발급받아야 하며, 입력한 키는 이 컴퓨터에만 저장됩니다. 다른 사람과 공유되지 않습니다.

---

## 자주 묻는 질문

**Q. 인터넷이 없어도 되나요?**  
가상 오피스 구경, 태스크 보드, 결재 기능은 인터넷 없이도 됩니다. AI 직원이 실제로 대화하는 기능만 인터넷이 필요합니다.

**Q. 비용이 드나요?**  
BLOKS OS 자체는 무료입니다. AI API 키를 사용하면 OpenAI·Anthropic·Google에 소액의 사용료가 발생할 수 있습니다. AI 없이 쓰면 비용은 0원입니다.

**Q. 데이터는 어디에 저장되나요?**  
내 컴퓨터 안 `.bloks-data/local-db.json` 파일에 저장됩니다. 인터넷에 올라가지 않습니다.

**Q. 종료하려면 어떻게 하나요?**  
터미널에서 `Ctrl + C` 를 누르면 됩니다.

**Q. 다시 시작하려면?**  
터미널에서 BLOKS 폴더로 이동 후 `pnpm bloks-os start` 를 다시 입력하면 됩니다.

---

## 문제가 생겼을 때

```bash
pnpm bloks-os doctor
```

이 명령어가 문제를 자동으로 찾아서 해결 방법을 알려줍니다.

---

## 개발자를 위한 정보

```bash
pnpm dev          # 개발 서버 실행 (코드 수정 시 자동 재시작)
pnpm test         # 테스트 실행
pnpm lint         # 타입 검사
```

**기술 스택**

| 레이어 | 기술 |
|--------|------|
| 프론트엔드 | Next.js 15, Phaser 3 (월드), React |
| 백엔드 | Express |
| 데이터 | 로컬 JSON (기본) / Supabase (선택, `BLOKS_PROFILE=connected`) |
| AI | OpenAI, Anthropic, Google AI (ai-router로 자동 선택) |

**클라우드 연결 모드** (팀 협업이 필요할 때)

Supabase + Redis를 연결하면 여러 명이 같은 데이터를 공유할 수 있습니다.

```bash
# .env 파일에 추가
BLOKS_PROFILE=connected
SUPABASE_URL=https://[ref].supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
REDIS_URL=redis://...
```

---

## 라이선스

MIT — 자유롭게 사용, 수정, 배포할 수 있습니다.
