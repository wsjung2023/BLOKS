#!/usr/bin/env bash
# BLOKS 원클릭 설치 스크립트 (macOS / Linux)
# 사용법: curl -fsSL https://raw.githubusercontent.com/wsjung2023/BLOKS/main/install.sh | bash

set -e

REPO="https://github.com/wsjung2023/BLOKS.git"
INSTALL_DIR="$HOME/BLOKS"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BOLD='\033[1m'; NC='\033[0m'

echo ""
echo -e "${BOLD}╔══════════════════════════════════════╗${NC}"
echo -e "${BOLD}║     BLOKS — 나만의 AI 직원팀 설치    ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════╝${NC}"
echo ""

# ── 1. Node.js 확인 ──────────────────────────────────────────────────────────
if ! command -v node &>/dev/null; then
  echo -e "${RED}✗ Node.js가 설치되지 않았습니다.${NC}"
  echo "  https://nodejs.org 에서 LTS 버전을 설치한 뒤 다시 실행해 주세요."
  exit 1
fi

NODE_MAJOR=$(node -e "console.log(process.versions.node.split('.')[0])")
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo -e "${RED}✗ Node.js 20 이상이 필요합니다. (현재: $(node -v))${NC}"
  echo "  https://nodejs.org 에서 최신 LTS를 설치해 주세요."
  exit 1
fi
echo -e "${GREEN}✓ Node.js $(node -v)${NC}"

# ── 2. pnpm 설치 ──────────────────────────────────────────────────────────────
if ! command -v pnpm &>/dev/null; then
  echo -e "${YELLOW}→ pnpm 설치 중...${NC}"
  npm install -g pnpm --silent
fi
echo -e "${GREEN}✓ pnpm $(pnpm -v)${NC}"

# ── 3. Git 확인 ───────────────────────────────────────────────────────────────
if ! command -v git &>/dev/null; then
  echo -e "${RED}✗ Git이 설치되지 않았습니다.${NC}"
  echo "  macOS: xcode-select --install"
  echo "  Linux: sudo apt-get install -y git"
  exit 1
fi
echo -e "${GREEN}✓ git$(NC)"

# ── 4. 다운로드 ────────────────────────────────────────────────────────────────
if [ -d "$INSTALL_DIR/.git" ]; then
  echo -e "${YELLOW}→ 이미 설치됨. 최신 버전으로 업데이트 중...${NC}"
  git -C "$INSTALL_DIR" pull --ff-only
else
  echo -e "${YELLOW}→ BLOKS 다운로드 중...${NC}"
  git clone "$REPO" "$INSTALL_DIR"
fi

# ── 5. 패키지 설치 ────────────────────────────────────────────────────────────
echo -e "${YELLOW}→ 패키지 설치 중... (처음엔 1~2분 소요)${NC}"
pnpm install --dir "$INSTALL_DIR" --silent

# ── 6. 초기 설정 ─────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}━━━ API 키 설정 (Enter만 누르면 나중에 설정 가능) ━━━${NC}"
(cd "$INSTALL_DIR" && pnpm bloks-os init)

# ── 7. 실행 ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}✓ 설치 완료!${NC}"
echo ""
echo -e "앞으로는 이렇게 실행하세요:"
echo -e "  ${BOLD}cd ~/BLOKS && pnpm bloks-os start${NC}"
echo ""
echo -e "${YELLOW}→ 지금 바로 시작할까요? [Y/n]${NC} \c"
read -r answer
if [[ "$answer" =~ ^[Nn] ]]; then
  echo "나중에 실행하려면: cd ~/BLOKS && pnpm bloks-os start"
else
  cd "$INSTALL_DIR" && pnpm bloks-os start
fi
