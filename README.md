# BLOKS — 나만의 AI 직원팀

> RPG 게임처럼 생긴 AI 오피스에서 진짜 업무를 처리하는 프로그램입니다.  
> "마케팅 기획서 써줘", "카페 포스터 이미지 만들어줘" 라고 입력하면  
> AI 캐릭터들이 역할을 나눠 실제로 만들어 줍니다.

---

## 뭘 만들어 줄 수 있나요?

### 마케팅 & 광고 대행

| 요청 예시 | 결과물 |
|---|---|
| `"카페 여름 프로모션 광고배너 만들어줘"` | 광고 이미지 + 광고 카피 5종 + 배포 전략 |
| `"신제품 런칭 광고 이미지랑 광고 문구"` | 광고 배너 이미지 + 카피라이팅 |
| `"할인 쿠폰 디자인해줘"` | 쿠폰 이미지 + 이벤트 광고 문구 |
| `"랜딩 페이지 프로모션 페이지 만들어줘"` | HTML 프로모션 페이지 |
| `"인스타그램 광고 릴스 영상"` | 세로형 광고 영상 (9:16) |
| `"광고 배포 전략 수립해줘"` | 채널별 전략, 예산 배분, KPI 설정 |

### 기획 & 분석

| 요청 예시 | 결과물 |
|---|---|
| `"카페 인스타그램 마케팅 기획서 3개월치"` | 전략 문서, WBS, 해시태그 전략 |
| `"경쟁사 분석 리포트"` | 리서치 요약 문서 (멀티 AI 병렬 분석) |
| `"IR 덱 제안서 초안"` | 사업 제안서 문서 |

### 미디어 제작

| 요청 예시 | 결과물 |
|---|---|
| `"여름 한정 음료 포스터 이미지 디자인"` | 실제 이미지 파일 (AI 그림) |
| `"카페 홍보 영상 만들어줘"` | 실제 동영상 클립 (AI 영상, 5~10초) |
| `"유튜브 채널 소개 영상"` | 가로형 영상 클립 (16:9) |

### 개발

| 요청 예시 | 결과물 |
|---|---|
| `"간단한 To-do 리스트 웹앱 만들어줘"` | 코드 결과물 |

> **광고/프로모션/쿠폰/랜딩 페이지** 키워드 → 광고 배너 + 카피 + 배포 전략 자동 세트 생성  
> **영상/비디오/릴스/쇼츠/유튜브** 키워드 → 마케팅팀 AI가 실제 영상 클립을 생성합니다.  
> **이미지/디자인/포스터/배너** 키워드 → 마케팅팀 AI가 실제 이미지를 생성합니다.  
> **리서치/분석/시장/경쟁** 키워드 → GPT + Claude 두 AI가 병렬로 다각도 분석 후 종합합니다.

---

## 이런 분에게 맞습니다

- 소상공인 — 광고 배너, 쿠폰, 프로모션 페이지, 배포 전략을 한 번에 받고 싶은 분
- 마케터 — 기획서, 제안서, SNS 콘텐츠, 광고 카피를 AI에게 맡기고 싶은 분
- 스타트업 — 경쟁사 분석, IR 제안서, 제품 홍보물을 빠르게 만들고 싶은 분
- 개발자 — 웹앱, 코드, 기술 문서를 AI 팀에게 위임하고 싶은 분
- ChatGPT처럼 대화만 하는 게 아니라 "팀이 알아서 일하는" 느낌을 원하는 분

---

## 필요한 것

| 항목 | 설명 |
|---|---|
| 인터넷 연결 | 항상 필요 |
| Node.js 20 이상 | https://nodejs.org 에서 LTS 설치 |
| Git | https://git-scm.com 에서 설치 |
| AI API 키 | 설치 마법사에서 바로 입력 가능 |

> AI 키 없이도 앱은 켜집니다. 캐릭터가 실제로 일하게 하려면 하나 이상 필요합니다.

---

## 설치 — 한 줄로 끝

### Windows (PowerShell)

```powershell
irm https://raw.githubusercontent.com/wsjung2023/BLOKS/main/install.ps1 | iex
```

### macOS / Linux

```bash
curl -fsSL https://raw.githubusercontent.com/wsjung2023/BLOKS/main/install.sh | bash
```

설치 스크립트가 자동으로:
1. Node.js 버전 확인
2. pnpm 설치 (없으면)
3. BLOKS 다운로드
4. 패키지 설치
5. API 키 설정 마법사 실행
6. 앱 시작

---

### AI 서비스 연결 (선택사항)

> **BLOKS는 무료입니다.** AI 서비스는 별도 회사(OpenAI, Google 등)의 서비스이며 사용량에 따라 소액 과금됩니다.  
> 키 없이도 앱은 완전히 실행됩니다. 캐릭터가 실제로 일하게 하려면 하나 이상 필요합니다.

#### 글쓰기 AI — 하나만 있으면 됩니다

| 서비스 | 비용 | 발급 |
|---|---|---|
| **OpenAI** (가장 무난, 추천) | 가볍게 쓰면 월 1~3달러 수준 | https://platform.openai.com/api-keys |
| Anthropic (Claude) | 비슷한 수준 | https://console.anthropic.com |
| Google (Gemini) | **무료 플랜 있음** | https://aistudio.google.com/app/apikey |

#### 실시간 웹 검색 — 없어도 되지만 있으면 훨씬 좋습니다

AI가 인터넷에서 최신 정보를 검색해 결과물에 반영합니다.

| 서비스 | 비용 | 발급 |
|---|---|---|
| Tavily | **무료 플랜: 월 1,000회** | https://app.tavily.com |

#### 이미지 생성 — OpenAI 키만 있으면 자동으로 됩니다

포스터, 배너 등 이미지를 만들 때 사용합니다. OpenAI 키가 있으면 별도 설정 없이 자동으로 이미지를 생성합니다.

#### 영상 생성 — 영상이 필요할 때만

유튜브, 릴스, 쇼츠 등 AI 영상을 만들 때 필요합니다.

| 서비스 | 비용 | 발급 |
|---|---|---|
| KIE.AI | 5초 영상 1개당 약 300~600원 | https://kie.ai |

---

> **앱 실행 후 브라우저에서도 설정할 수 있습니다.**  
> 화면 왼쪽 메뉴 → **설정 ⚙️** 클릭 → 키 입력  
> 입력한 키는 내 PC에만 저장되며 외부로 전송되지 않습니다.

---

## 다음 실행부터

설치 후 BLOKS를 다시 켤 때:

### Windows
```powershell
cd ~\BLOKS
pnpm bloks-os start
```

### macOS / Linux
```bash
cd ~/BLOKS
pnpm bloks-os start
```

브라우저가 자동으로 열립니다. 안 열리면 직접: `http://localhost:3000`

종료: 터미널에서 `Ctrl + C`

---

## 처음 해볼 것

1. 좌측 메뉴에서 **프로젝트** 클릭
2. 오른쪽 상단 **+ 새 프로젝트** 버튼 클릭
3. 원하는 내용 자유롭게 입력:

**광고 대행** (배너 + 카피 + 배포 전략 자동 세트)
- `"카페 여름 할인 이벤트 광고배너랑 광고 문구 만들어줘"`
- `"신제품 쿠폰 디자인이랑 프로모션 배포 전략 만들어줘"`
- `"인스타그램 광고용 랜딩 페이지 만들어줘"`

**리서치 & 분석** (GPT + Claude 두 AI가 동시에 분석)
- `"카페 시장 경쟁사 분석 리포트"`
- `"카페 인스타그램 마케팅 기획서 3개월치"`

**미디어 제작**
- `"여름 한정 음료 포스터 이미지 디자인해줘"` → 실제 이미지
- `"카페 홍보 영상 릴스로 만들어줘"` → 실제 영상

**개발**
- `"간단한 To-do 리스트 웹앱 만들어줘"` → 코드

4. 제출하면 AI 캐릭터가 자동으로 작업 시작 (보통 30초~2분 이내)
5. **아티팩트** 메뉴에서 결과물 확인
6. **태스크 보드**에서 진행 상황 확인

> 광고 대행 의뢰 시 배너 이미지, 광고 카피, 배포 전략이 한 번에 생성됩니다.  
> 리서치/분석 의뢰 시 GPT와 Claude가 동시에 다른 시각으로 분석한 결과물이 생성됩니다.

---

## 컴퓨터 켤 때 자동 시작 (선택)

```bash
pnpm bloks-os autostart enable
```

해제:
```bash
pnpm bloks-os autostart disable
```

---

## 업데이트

```bash
cd BLOKS
git pull
pnpm install
pnpm bloks-os start
```

> 새 버전에 캐릭터·모델 데이터가 추가된 경우 `pnpm db:seed` 를 한 번 실행하면 최신 상태로 반영됩니다.

---

## 다른 컴퓨터에 설치할 때 (새 PC)

```bash
git clone https://github.com/wsjung2023/BLOKS.git
cd BLOKS
pnpm install
pnpm bloks-os init    # AI 키 입력
pnpm bloks-os start   # 첫 실행 시 초기 데이터 자동 삽입
```

> `pnpm bloks-os start` 를 처음 실행하면 캐릭터·조직 데이터를 자동으로 채워 넣습니다.  
> 별도로 `pnpm db:seed` 를 실행하지 않아도 됩니다.

---

## 뭔가 안 되면

```bash
pnpm bloks-os doctor
```

문제를 자동으로 찾아줍니다.

| 증상 | 해결 |
|---|---|
| `pnpm` 명령 없다고 나옴 | `npm install -g pnpm` 실행 |
| 화면이 안 열림 | `pnpm bloks-os start` 실행 중인지 확인 |
| AI가 아무것도 안 만들어 줌 | 앱 실행 후 왼쪽 메뉴 **설정 ⚙️** 에서 API 키 입력 확인 |
| 이미지가 안 생성됨 | **설정 ⚙️** → OpenAI 키가 설정됐는지 확인 |
| 영상이 안 생성됨 | **설정 ⚙️** → KIE.AI 키 입력 (https://kie.ai) |
| 웹 검색이 안 됨 | **설정 ⚙️** → Tavily 키 입력 (https://app.tavily.com, 무료) |
| 오류 메시지가 뜸 | `Ctrl + C` 후 `pnpm bloks-os start` 재실행 |

---

## 데이터 저장 위치

모든 데이터는 내 PC에만 저장됩니다.

```
BLOKS/.bloks-data/local-db.json
```

---

## 비용 요약

| 항목 | 비용 |
|---|---|
| BLOKS 프로그램 | **무료** |
| 글쓰기 AI (기획서, 광고 카피, 분석 등) | 사용한 만큼만 — 가볍게 쓰면 월 1~3달러 수준 |
| 이미지 AI (광고 배너, 포스터 등) | 이미지 1장당 약 $0.04~0.08 (OpenAI 기준) |
| 영상 AI (릴스, 광고영상 등) | 5초 영상 1개당 약 300~600원 (KIE.AI) |
| 실시간 웹 검색 | 월 1,000회 무료 (Tavily 무료 플랜) |
| 서버, 클라우드 | **없음** — 내 PC에서만 돌아감 |

---

## 클라우드 배포 (Vercel + Railway)

로컬 PC 없이 24시간 운영하려면 Vercel(웹)과 Railway(API+워커)를 사용합니다.

### Web — Vercel

1. [vercel.com](https://vercel.com) → 이 저장소 import
2. 환경변수 설정:

| 변수 | 값 |
|---|---|
| `NEXT_PUBLIC_API_URL` | Railway API 서비스 URL (예: `https://bloks-api.up.railway.app`) |
| `NEXT_PUBLIC_ENABLE_DEV_BYPASS_AUTH` | `false` |

### API + Worker — Railway

1. [railway.app](https://railway.app) → New Project → Deploy from GitHub
2. 서비스 2개 생성: **api** (`apps/api`), **worker** (`apps/worker`)
3. Redis 플러그인 추가 → `REDIS_URL` 자동 주입
4. 각 서비스 환경변수 설정:

| 변수 | 설명 |
|---|---|
| `OPENAI_API_KEY` | OpenAI API 키 |
| `NODE_ENV` | `production` |
| `BLOKS_DATA_DIR` | `/data` (영구 볼륨 마운트 경로) |
| `ENABLE_DEV_BYPASS_AUTH` | `false` |

5. API 서비스에 **/data 볼륨** 마운트 → local-db.json 영구 보존

---

## 개발자 가이드 (Claude Code로 기여할 때)

BLOKS는 **Claude Code 스킬 번들**이 내장되어 있습니다.  
개발 작업 시 Karpathy 코딩 원칙, 반복 루프, 전체 워크플로우 스킬이 자동으로 활성화됩니다.

### Claude Code 스킬 설치

저장소를 clone한 후 아래 명령어를 한 번만 실행하세요:

```bash
pnpm setup:claude
```

Windows/macOS/Linux 모두 동일한 명령어로 동작합니다.

### 설치되는 스킬 목록

| 스킬 | 출처 | 용도 |
|---|---|---|
| `/karpathy-guidelines` | BLOKS 번들 | 단순하게·외과적으로·목표 기반으로 코딩 |
| `/bloks-collab-impl` | BLOKS 번들 | BLOKS 협업 시스템 구현 체크리스트 |
| `/superpowers` | [obra/superpowers](https://github.com/obra/superpowers) | TDD·디버깅·코드리뷰 전체 워크플로우 |
| `/ralph-loop` | Anthropic 공식 | 같은 프롬프트를 완료될 때까지 반복 실행 |
| `/agent-toolkit` | [softaworks/agent-toolkit](https://github.com/softaworks/agent-toolkit) | 문서화·테스팅·플래닝 50+ 스킬 모음 |

> 이미 설치된 스킬은 건너뜁니다. Claude Code를 재시작하면 바로 사용 가능합니다.

### 개발 서버 실행

```bash
pnpm install
pnpm dev               # 전체 앱 (api:4000 + web:3000 + worker)
```

### 주요 개발 명령어

```bash
pnpm lint              # 타입 체크
pnpm test              # 전체 테스트
pnpm db:migrate        # DB 마이그레이션
pnpm verify:ci         # CI 전체 검증 (lint + test + smoke)
```
