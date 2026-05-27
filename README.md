# BLOKS — 나만의 AI 직원팀

> RPG 게임처럼 생긴 AI 오피스에서 진짜 업무를 처리하는 프로그램입니다.  
> "마케팅 기획서 써줘", "카페 포스터 이미지 만들어줘" 라고 입력하면  
> AI 캐릭터들이 역할을 나눠 실제로 만들어 줍니다.

---

## 뭘 만들어 줄 수 있나요?

| 요청 예시 | 결과물 |
|---|---|
| `"카페 인스타그램 마케팅 기획서 3개월치"` | 전략 문서, WBS, 해시태그 전략 |
| `"여름 한정 음료 포스터 이미지 디자인"` | 실제 이미지 파일 (AI 그림) |
| `"신규 앱 런칭 배너 만들어줘"` | 실제 이미지 파일 (AI 그림) |
| `"카페 홍보 영상 만들어줘"` | 실제 동영상 클립 (AI 영상, 5~10초) |
| `"제품 광고영상 릴스 세로로"` | 세로형 릴스 영상 (9:16) |
| `"유튜브 채널 소개 영상"` | 가로형 영상 클립 (16:9) |
| `"경쟁사 분석 리포트"` | 리서치 요약 문서 |
| `"간단한 To-do 리스트 웹앱 만들어줘"` | 코드 결과물 |
| `"IR 덱 제안서 초안"` | 사업 제안서 문서 |

> **영상/비디오/릴스/쇼츠/유튜브** 키워드 → 마케팅팀 AI가 실제 영상 클립을 생성합니다.  
> **이미지/디자인/포스터/배너** 키워드 → 마케팅팀 AI가 실제 이미지를 생성합니다.  
> 그 외 기획서, 코드, 리포트는 텍스트 결과물로 생성됩니다.

---

## 이런 분에게 맞습니다

- 마케팅 기획서, 제안서, 보고서를 AI에게 맡기고 싶은 분
- SNS 포스터, 배너, 이미지 디자인을 AI에게 시키고 싶은 분
- 간단한 웹사이트나 앱 코드를 AI에게 짜게 하고 싶은 분
- ChatGPT처럼 대화만 하는 게 아니라 "팀이 알아서 일하는" 느낌을 원하는 분

---

## 필요한 것

| 항목 | 설명 |
|---|---|
| 인터넷 연결 | 항상 필요 |
| Node.js 20 이상 | 아래 설치 방법 참고 |
| Git | 아래 설치 방법 참고 |
| AI API 키 | 설치 마법사에서 바로 입력 가능 |

> AI 키 없이도 앱은 켜집니다. 캐릭터가 실제로 일하게 하려면 하나 이상 필요합니다.

---

## Step 1 — Node.js 설치

### Windows
1. https://nodejs.org 접속
2. **LTS** 버튼 클릭 → 설치 파일 다운로드
3. 다운로드된 `.msi` 파일 더블클릭 → "Next" → "Next" → "Install" → "Finish"
4. 터미널을 완전히 닫았다가 다시 열기

### macOS
1. https://nodejs.org 접속
2. **LTS** 버튼 클릭 → `.pkg` 파일 다운로드
3. 더블클릭 → 안내에 따라 설치
4. 터미널을 완전히 닫았다가 다시 열기

### Linux (Ubuntu/Debian)
```bash
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs
```

설치 확인:
```bash
node -v
```
숫자(예: `v22.0.0`)가 나오면 성공.

---

## Step 2 — Git 설치

### Windows
1. https://git-scm.com 접속 → **Download for Windows**
2. 다운로드된 파일 더블클릭 → "Next"만 계속 → "Install"

### macOS
```bash
xcode-select --install
```
팝업이 뜨면 "설치" 클릭.

### Linux
```bash
sudo apt-get install -y git
```

---

## Step 3 — BLOKS 다운로드 및 설치

### 터미널 여는 방법
- **Windows**: 시작 버튼 우클릭 → `터미널` (또는 `PowerShell`)
- **macOS**: `Command + Space` → `Terminal` → Enter
- **Linux**: 앱 목록에서 `Terminal`

### 명령어 (한 줄씩 실행)

```bash
npm install -g pnpm
```

```bash
git clone https://github.com/wsjung2023/BLOKS.git
```

```bash
cd BLOKS
```

> ⚠️ **여기서부터 터미널을 닫지 마세요.** 이후 모든 명령어는 이 BLOKS 폴더 안에서 실행합니다.

```bash
pnpm install
```

---

## Step 4 — 최초 설정 마법사 실행

```bash
pnpm bloks-os init
```

이 명령을 실행하면 질문이 하나씩 나옵니다.

```
BLOKS OS 설치 마법사

AI API 키 설정 (선택사항)
  OpenAI API 키 (없으면 Enter 스킵): sk-proj-...
  Anthropic API 키 (없으면 Enter 스킵):
  Google AI API 키 (없으면 Enter 스킵):

설정 완료!
```

키를 입력하면 자동으로 저장됩니다. **다음부터는 다시 입력 안 해도 됩니다.**

### AI API 키 발급 방법

**텍스트 생성 (기획서, 코드, 리포트)**

| 서비스 | 발급 주소 | 비용 |
|---|---|---|
| OpenAI (ChatGPT 회사) | https://platform.openai.com/api-keys | 사용한 만큼만. 가볍게 쓰면 월 1~3달러 수준 |
| Anthropic (Claude 회사) | https://console.anthropic.com | 동일 |
| Google AI | https://aistudio.google.com/app/apikey | 무료 티어 있음 |

> 텍스트는 셋 중 하나만 있어도 됩니다. OpenAI가 가장 무난합니다.

**이미지 생성 (포스터, 배너, 디자인)**

이미지는 OpenAI 키만 있어도 자동으로 생성됩니다 (DALL-E / gpt-image-1 사용).  
더 다양한 스타일을 원하면 아래 키를 추가로 입력할 수 있습니다.

| 서비스 | 특징 | 발급 주소 |
|---|---|---|
| OpenAI | 기본값. 한국어 텍스트 잘 그림 | https://platform.openai.com/api-keys |
| Google Imagen 3 | 사실적인 사진 스타일 | https://aistudio.google.com/app/apikey |
| Stability AI (SD3.5) | 아트/일러스트 스타일 | https://platform.stability.ai |
| fal.ai (FLUX Pro) | 빠르고 고품질 | https://fal.ai |
| Ideogram v3 | 텍스트 포함 디자인 특화 | https://ideogram.ai |

> 여러 개 입력하면 자동으로 우선순위에 따라 선택됩니다.  
> `.env` 파일에 직접 추가: `STABILITY_API_KEY=...`, `FAL_KEY=...`, `IDEOGRAM_API_KEY=...`

**영상 생성 (유튜브, 광고영상, 릴스, 쇼츠)**

영상은 **KIE.AI** API를 사용합니다. Kling, Seedance, Veo 등 최신 영상 생성 모델을 하나의 키로 사용할 수 있습니다.

| 서비스 | 특징 | 발급 주소 |
|---|---|---|
| KIE.AI | Kling 2.6 / Seedance 2.0 / Veo 3 통합. 기본값 Kling 2.6 | https://kie.ai |

발급 방법:
1. https://kie.ai 접속 → 회원가입
2. 대시보드 → **API Keys** → 새 키 생성
3. `.env` 파일에 추가:

```
KIE_AI_API_KEY=your-kie-ai-key-here
```

> **비용**: 5초 영상 1개당 약 $0.25~0.50 (모델에 따라 다름)  
> **소요 시간**: 요청 후 30초~3분 (서버 부하에 따라 다름)  
> 영상은 마케팅팀 AI 캐릭터가 자동 담당합니다. "유튜브", "광고영상", "릴스", "쇼츠" 등 키워드가 포함되면 자동 감지합니다.

---

## Step 5 — 실행

```bash
pnpm bloks-os start
```

브라우저가 자동으로 열립니다. 안 열리면 직접 주소 입력:

```
http://localhost:3000
```

RPG 오피스 화면이 보이면 성공입니다.

종료: 터미널에서 `Ctrl + C`

---

## Step 6 — 처음 해볼 것

1. 좌측 메뉴에서 **프로젝트** 클릭
2. 오른쪽 상단 **+ 새 프로젝트** 버튼 클릭
3. 원하는 내용 입력. 예:
   - `"카페 인스타그램 마케팅 기획서 3개월치"` → 전략 문서 생성
   - `"여름 한정 음료 포스터 이미지 디자인해줘"` → 실제 이미지 생성
   - `"간단한 To-do 리스트 웹앱 만들어줘"` → 코드 생성
4. 제출하면 AI 캐릭터가 자동으로 작업 시작 (보통 30초~1분 이내)
5. **아티팩트** 메뉴에서 결과물 확인
6. **태스크 보드**에서 진행 상황 확인

> 이미지/디자인/포스터/배너 키워드가 있으면 마케팅팀 캐릭터(픽셀스 등)가 담당합니다.

---

## 매일 켜는 방법

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
| AI가 아무것도 안 만들어 줌 | `pnpm bloks-os init` 다시 실행해서 키 확인 |
| 이미지가 안 생성됨 | OpenAI 키 확인. `.env`에 `OPENAI_API_KEY=sk-...` 있는지 확인 |
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
| BLOKS 프로그램 | 무료 |
| 텍스트 AI 사용료 | 사용한 만큼만 (보통 월 1~3달러 수준) |
| 이미지 AI 사용료 | 이미지 1장당 약 $0.04~0.08 (OpenAI 기준) |
| 서버, 클라우드 | 없음 — 내 PC에서만 돌아감 |
