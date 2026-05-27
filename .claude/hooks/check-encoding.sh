#!/bin/bash
# PostToolUse: Edit|Write — 파일에 U+FFFD(깨진 한국어)가 있으면 즉시 경고

INPUT=$(cat)
FILE=$(echo "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('file_path',''))" 2>/dev/null || echo "")

if [ -z "$FILE" ] || [ ! -f "$FILE" ]; then
  exit 0
fi

# 소스 파일만 검사
if ! echo "$FILE" | grep -qE "\.(ts|tsx|js|mjs|json|sql|md)$"; then
  exit 0
fi

python3 << PYEOF
import sys, os, pathlib

path = r"$FILE"
try:
    with open(path, 'rb') as f:
        data = f.read()
    if b'\xef\xbf\xbd' not in data:
        sys.exit(0)
    lines = data.decode('utf-8', errors='replace').splitlines()
    bad = [(i+1, line.replace('�', '[GARBLED]')) for i, line in enumerate(lines) if '�' in line]
    name = pathlib.Path(path).name
    print("")
    print("=" * 52)
    print("[ENCODING ERROR] " + name)
    print("=" * 52)
    for lno, line in bad[:5]:
        print("  Line {}: {}".format(lno, line[:100]))
    print("")
    print("Cause: Korean text corrupted via curl/bash shell")
    print("Fix: Use Write/Edit tool directly to restore Korean")
    print("=" * 52)
except Exception as e:
    pass
PYEOF

exit 0
