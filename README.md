# BLOKS OS

> 컴퓨터를 잘 몰라도, 그대로 따라하면 실행되는 가이드

## 0) 이 문서의 목표
- 이 문서는 `Windows / macOS / Linux` 모두 기준으로 작성했습니다.
- 어려운 설명은 빼고, "복사 → 붙여넣기 → 엔터"만으로 진행합니다.
- AI 키가 없어도 기본 기능은 바로 실행됩니다.

## 1) 먼저 확인 (1분)
필요한 것은 3개뿐입니다.
- 인터넷 연결
- `Node.js 20+`
- `Git`

아직 설치 안 되어 있으면 아래에서 먼저 설치하세요.
- Node.js: https://nodejs.org (LTS)
- Git: https://git-scm.com

설치 후 터미널(명령창)을 완전히 닫았다가 다시 여세요.

## 2) 터미널 여는 방법
- Windows: 시작 버튼 우클릭 -> `터미널` (또는 `PowerShell`)
- macOS: `Command + Space` -> `Terminal`
- Linux: 앱 목록에서 `Terminal`

## 3) 진짜 설치 (그대로 복붙)
아래 4줄을 한 줄씩 실행하세요.

```bash
npm install -g pnpm

git clone https://github.com/wsjung2023/BLOKS.git

cd BLOKS

pnpm install
```

설치가 끝나면 실행:

```bash
pnpm dev
```

브라우저에서 아래 주소 열기:

```text
http://localhost:3000
```

종료는 터미널에서 `Ctrl + C`.

## 4) 매일 켜는 방법
다음부터는 2줄만 실행하면 됩니다.

### Windows
```powershell
cd ~\BLOKS
pnpm dev
```

### macOS / Linux
```bash
cd ~/BLOKS
pnpm dev
```

## 5) AI 대화 기능 켜기 (선택)
중요: 이 단계는 선택입니다. 안 해도 앱은 동작합니다.

1. BLOKS 폴더에서 `.env` 파일 열기

Windows:
```powershell
notepad .env
```

macOS:
```bash
open -e .env
```

Linux:
```bash
nano .env
```

2. 아래 중 하나만 넣어도 됩니다.
- `OPENAI_API_KEY=...`
- `ANTHROPIC_API_KEY=...`
- `GOOGLE_AI_API_KEY=...`

3. 저장 후 `pnpm dev` 다시 실행

## 6) 자동 시작 설정 (원하면)
컴퓨터 켤 때 자동으로 BLOKS를 시작합니다.

```bash
pnpm bloks-os autostart enable
```

해제:

```bash
pnpm bloks-os autostart disable
```

상태 확인:

```bash
pnpm bloks-os autostart status
```

## 7) 업데이트
BLOKS 폴더에서 실행:

```bash
git pull
pnpm install
pnpm dev
```

## 8) 막히면 이 순서로 해결
1. 터미널 완전히 종료 후 다시 열기
2. BLOKS 폴더에서 다시 실행
3. 진단 명령 실행

```bash
pnpm bloks-os doctor
```

가장 흔한 문제 해결:
- `pnpm` 명령이 없다고 나오면 -> `npm install -g pnpm`
- 3000 포트 접속 안 되면 -> `pnpm dev`가 켜져 있는지 확인
- 실행 중 에러가 나면 -> `Ctrl + C` 후 `pnpm dev` 재실행

## 9) 이 프로젝트로 할 수 있는 것
- RPG형 월드에서 AI 팀 운영
- 프로젝트/태스크 관리
- 승인(결재) 흐름 관리
- 감사 로그 확인
- 데모 시나리오 실행

## 10) 비용
- BLOKS 자체: 무료
- AI API 키 사용 시: 해당 서비스 사용량 과금 (선택)

## 11) 데이터 저장 위치
기본 데이터는 내 PC에 저장됩니다.
- `.bloks-data/local-db.json`

## 12) 한 줄 요약
`설치 1회 + 실행 1줄`이면 누구나 자기 PC에서 BLOKS를 사용할 수 있습니다.
