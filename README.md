# BLOKS — 나만의 AI 직원팀

> RPG 게임처럼 생긴 AI 오피스에서 진짜 업무를 처리하는 프로그램입니다.
> "마케팅 기획서 써줘", "웹사이트 만들어줘" 라고 입력하면 AI 캐릭터들이 역할을 나눠 실제로 만들어 줍니다.

---

## 이런 분에게 맞습니다

- 마케팅 기획서, 제안서, 보고서를 AI에게 맡기고 싶은 분
- 간단한 웹사이트나 앱 코드를 AI에게 짜게 하고 싶은 분
- ChatGPT처럼 대화만 하는 게 아니라 "팀이 알아서 일하는" 느낌을 원하는 분

---

## 준비물

| 필요한 것 | 설명 | 없으면 |
|---|---|---|
| 인터넷 연결 | 항상 필요 | — |
| Node.js 20 이상 | 아래 설치 방법 참고 | 앱이 안 켜짐 |
| Git | 아래 설치 방법 참고 | 다운로드 못 함 |
| AI API 키 | 설치 후 넣을 수 있음 | AI 기능 비활성화 |

> AI 키 없이도 앱은 켜지고 둘러볼 수 있습니다. AI가 실제로 일하게 하려면 키가 필요합니다.

---

## Step 1 — Node.js 설치

### Windows
1. https://nodejs.org 접속
2. **LTS** 버튼 클릭 → 설치 파일 다운로드
3. 다운로드된 `.msi` 파일 더블클릭
4. "Next" → "Next" → "Install" → "Finish"
5. 터미널을 **완전히 닫았다가 다시 열기**

### macOS
1. https://nodejs.org 접속
2. **LTS** 버튼 클릭 → `.pkg` 파일 다운로드
3. 다운로드된 파일 더블클릭 → 안내에 따라 설치
4. 터미널을 **완전히 닫았다가 다시 열기**

### Linux (Ubuntu/Debian)
```bash
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs
```

설치 확인 (아래 명령 실행 후 숫자가 나오면 성공):
```bash
node -v
```

---

## Step 2 — Git 설치

### Windows
1. https://git-scm.com 접속
2. **Download for Windows** 클릭
3. 다운로드된 파일 더블클릭 → "Next"만 계속 누르다가 "Install"

### macOS
터미널에서:
```bash
xcode-select --install
```
팝업이 뜨면 "설치" 클릭.

### Linux
```bash
sudo apt-get install -y git
```

---

## Step 3 — BLOKS 설치

터미널을 열고 아래 명령을 **한 줄씩** 실행하세요.

### 터미널 여는 방법
- **Windows**: 시작 버튼 우클릭 → `터미널` (또는 `PowerShell`)
- **macOS**: `Command + Space` → `Terminal` 입력 → Enter
- **Linux**: 앱 목록에서 `Terminal`

### 설치 명령 (한 줄씩 복사해서 Enter)

```bash
npm install -g pnpm
```

```bash
git clone https://github.com/wsjung2023/BLOKS.git
```

```bash
cd BLOKS
```

```bash
pnpm install
```

설치가 끝나면:

```bash
pnpm dev
```

잠깐 기다리면 터미널에 메시지가 올라옵니다. 그 다음 브라우저에서 아래 주소를 여세요:

```
http://localhost:3000
```

RPG 오피스 화면이 보이면 성공입니다.

종료: 터미널에서 `Ctrl + C`

---

## Step 4 — AI 키 넣기 (실제로 일 시키려면 필수)

AI 키 없이는 캐릭터들이 빈 보고서를 제출합니다. 아래 중 하나를 발급받아 넣으세요.

### 어디서 발급받나?

| 서비스 | 발급 주소 | 비용 |
|---|---|---|
| OpenAI (ChatGPT 회사) | https://platform.openai.com/api-keys | 사용한 만큼만 결제. 가볍게 쓰면 월 1~3달러 수준 |
| Anthropic (Claude 회사) | https://console.anthropic.com | 동일 |
| Google AI | https://aistudio.google.com/app/apikey | 무료 티어 있음 |

### 키 넣는 방법

BLOKS 폴더 안에 `.env` 파일을 만들고 아래 내용을 넣으세요.

**Windows:**
```powershell
notepad .env
```

**macOS / Linux:**
```bash
nano .env
```

파일 내용 (셋 중 하나만 있어도 됩니다):
```
OPENAI_API_KEY=여기에_발급받은_키_붙여넣기
```
또는
```
ANTHROPIC_API_KEY=여기에_발급받은_키_붙여넣기
```
또는
```
GOOGLE_AI_API_KEY=여기에_발급받은_키_붙여넣기
```

저장 후 `pnpm dev`를 다시 실행하세요.

---

## Step 5 — 처음 해볼 것

1. 브라우저에서 `http://localhost:3000` 열기
2. 상단 메뉴에서 **Projects** 클릭
3. **새 프로젝트** 버튼 클릭
4. 프로젝트 이름과 원하는 것을 입력 예시:
   - `"우리 카페 인스타그램 마케팅 기획 3개월치"`
   - `"간단한 To-do 리스트 웹앱 만들어줘"`
5. 생성하면 AI 캐릭터들이 태스크를 나눠 작업 시작
6. **Board** 메뉴에서 진행 상황 확인
7. 완료된 태스크의 **아티팩트 저장** 버튼으로 결과물 열기

---

## 매일 켜는 방법

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

---

## 컴퓨터 켤 때 자동으로 시작하게 하기 (선택)

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
pnpm dev
```

---

## 뭔가 안 되면

먼저 이 명령을 실행하면 문제를 찾아줍니다:

```bash
pnpm bloks-os doctor
```

| 증상 | 해결 |
|---|---|
| `pnpm` 명령 없다고 나옴 | `npm install -g pnpm` 실행 |
| `localhost:3000` 접속 안 됨 | `pnpm dev`가 실행 중인지 확인 |
| AI가 빈 내용만 출력함 | `.env` 파일에 API 키 들어갔는지 확인 |
| 오류 메시지가 뜸 | `Ctrl + C` 후 `pnpm dev` 다시 실행 |

---

## 데이터 저장 위치

모든 데이터는 내 PC에만 저장됩니다. 외부 서버로 전송되지 않습니다.

- `BLOKS/.bloks-data/local-db.json`

---

## 비용 요약

| 항목 | 비용 |
|---|---|
| BLOKS 프로그램 | 무료 |
| AI API 사용료 | 사용한 만큼만 (보통 월 1~5달러 수준) |
| 서버, 클라우드 | 없음 — 내 PC에서만 돌아감 |
