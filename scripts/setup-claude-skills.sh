#!/usr/bin/env bash
# Sets up Claude Code skills and plugins for BLOKS development.
# Run once after cloning: pnpm setup:claude

set -e

BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BOLD}BLOKS — Claude Code skill setup${NC}"
echo ""

install_plugin() {
  local name="$1"
  local id="$2"
  echo -n "  $name ... "
  if claude plugin install "$id" 2>/dev/null; then
    echo -e "${GREEN}installed${NC}"
  else
    echo -e "${YELLOW}run manually: claude plugin install $id${NC}"
  fi
}

echo "1. Installing 3rd-party plugins:"
install_plugin "superpowers (Karpathy + TDD + debugging workflows)" "obra/superpowers"
install_plugin "ralph-loop (continuous AI iteration loops)"         "ralph-loop"
install_plugin "agent-toolkit (50+ modular dev skills)"            "softaworks/agent-toolkit"

echo ""
echo "2. Installing BLOKS plugin (project-specific skills):"
echo -n "  bloks (karpathy-guidelines + bloks-collab-impl) ... "
if claude plugin install ./ 2>/dev/null; then
  echo -e "${GREEN}installed${NC}"
else
  echo -e "${YELLOW}run manually: claude plugin install ./${NC}"
fi

echo ""
echo -e "${GREEN}Done.${NC} Restart Claude Code for all skills to take effect."
echo ""
echo "Available skills after setup:"
echo "  /karpathy-guidelines  — surgical coding, simplicity-first"
echo "  /bloks-collab-impl    — BLOKS collaboration system guide"
echo "  /ralph-loop           — continuous iteration loops"
echo "  /superpowers          — full dev workflow (TDD, debugging, review)"
echo "  /agent-toolkit        — docs, testing, planning skills"
