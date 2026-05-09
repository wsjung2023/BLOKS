#!/bin/bash
# Runs after Edit/Write — lightweight type check on changed TypeScript files
# Only runs if the edited file is in apps/ or packages/

INPUT=$(cat)
FILE=$(echo "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('file_path',''))" 2>/dev/null || echo "")

# Only care about TypeScript files
if echo "$FILE" | grep -qE "\.(ts|tsx)$"; then
  # Determine which workspace the file belongs to
  if echo "$FILE" | grep -q "apps/web"; then
    FILTER="web"
  elif echo "$FILE" | grep -q "apps/api"; then
    FILTER="api"
  elif echo "$FILE" | grep -q "apps/worker"; then
    FILTER="worker"
  else
    exit 0
  fi

  # Run tsc --noEmit in background (non-blocking)
  cd "$(dirname "$0")/../.." && pnpm --filter "$FILTER" exec tsc --noEmit --pretty 2>&1 | tail -20 &
fi

exit 0
