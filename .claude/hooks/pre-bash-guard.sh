#!/bin/bash
# Reads tool input JSON from stdin, blocks dangerous commands

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('command',''))" 2>/dev/null || echo "")

# Block force push
if echo "$COMMAND" | grep -qE "git push.*(--force|-f)"; then
  echo '{"decision":"block","reason":"git push --force는 위험합니다. 정말 필요하면 직접 터미널에서 실행하세요."}'
  exit 0
fi

# Block db:push (can wipe schema without migration)
if echo "$COMMAND" | grep -q "db:push"; then
  echo '{"decision":"block","reason":"pnpm db:push는 마이그레이션 없이 스키마를 덮어씁니다. db:migrate를 사용하세요."}'
  exit 0
fi

# Block sprite generation scripts (already done by Codex)
if echo "$COMMAND" | grep -qE "generate-missing-sprites|remove-floor-characters"; then
  echo '{"decision":"block","reason":"스프라이트 생성 스크립트는 Codex가 이미 완료했습니다. 실행을 막았습니다."}'
  exit 0
fi

# Allow everything else
echo '{"decision":"approve"}'
exit 0
