# BLOKS — 나만의 AI 직원팀

> RPG 게임처럼 생긴 AI 오피스에서 진짜 업무를 처리하는 프로그램입니다.  
> "마케팅 기획서 써줘", "웹사이트 만들어줘" 라고 입력하면 AI 캐릭터들이 역할을 나눠 실제로 만들어 줍니다.

---

## 이런 분에게 맞습니다

- 마케팅 기획서, 제안서, 보고서를 AI에게 맡기고 싶은 분
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

| 서비스 | 발급 주소 | 비용 |
|---|---|---|
| OpenAI (ChatGPT 회사) | https://platform.openai.com/api-keys | 사용한 만큼만. 가볍게 쓰면 월 1~3달러 수준 |
| Anthropic (Claude 회사) | https://console.anthropic.com | 동일 |
| Google AI | https://aistudio.google.com/app/apikey | 무료 티어 있음 |

> 셋 중 하나만 있어도 됩니다. OpenAI가 가장 무난합니다.

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

1. 상단 메뉴에서 **Projects** 클릭
2. **새 프로젝트** 버튼 클릭
3. 원하는 내용 입력. 예:
   - `"카페 인스타그램 마케팅 기획서 3개월치"`
   - `"간단한 To-do 리스트 웹앱 만들어줘"`
4. 생성하면 AI 캐릭터들이 태스크를 나눠 자동으로 작업 시작
5. **Board** 메뉴에서 진행 상황 확인
6. 완료된 태스크에서 결과물 열기

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
| AI API 사용료 | 사용한 만큼만 (보통 월 1~5달러 수준) |
| 서버, 클라우드 | 없음 — 내 PC에서만 돌아감 |
