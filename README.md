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

## Step 4 — 초기 설정

```bash
pnpm bloks-os init
```

실행하면 질문이 하나씩 나옵니다. **Enter만 누르면 스킵**됩니다.  
나중에 브라우저 화면에서도 언제든 바꿀 수 있습니다.

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
