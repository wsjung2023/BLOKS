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

# Block Korean text in curl/echo commands — causes encoding corruption (U+FFFD)
if python3 -c "
import sys
cmd = sys.stdin.read()
# Hangul syllables AC00-D7A3, Jamo 1100-11FF, Compatibility Jamo 3130-318F
has_korean = any(('가' <= c <= '힣') or ('ᄀ' <= c <= 'ᇿ') or ('㄰' <= c <= '㆏') for c in cmd)
if not has_korean:
    sys.exit(1)
has_curl = any(k in cmd for k in ['curl ', 'wget '])
has_echo_write = ('echo ' in cmd or 'printf ' in cmd) and ('>' in cmd or '|' in cmd)
if has_curl or has_echo_write:
    sys.exit(0)
sys.exit(1)
" <<< "\$COMMAND" 2>/dev/null; then
  echo '{"decision":"block","reason":"한국어를 curl/echo 쉘 명령으로 처리하면 인코딩이 손상됩니다(U+FFFD 발생).\n\n대신 사용하세요:\n1. API 호출 → node -e 스크립트로 http.request() 사용\n2. 파일 쓰기 → Write/Edit 도구 직접 사용\n3. JSON body → Node.js Buffer.from(body, utf8) 방식"}'
  exit 0
fi

# Allow everything else
echo '{"decision":"approve"}'
exit 0
