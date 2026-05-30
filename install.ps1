# BLOKS 원클릭 설치 스크립트 (Windows PowerShell)
# 사용법: irm https://raw.githubusercontent.com/wsjung2023/BLOKS/main/install.ps1 | iex

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$REPO       = "https://github.com/wsjung2023/BLOKS.git"
$INSTALL_DIR = "$HOME\BLOKS"

Write-Host ""
Write-Host "╔══════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║     BLOKS — 나만의 AI 직원팀 설치    ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# ── 1. Node.js 확인 ──────────────────────────────────────────────────────────
try { $nodeVer = node -v 2>&1 } catch { $nodeVer = $null }
if (-not $nodeVer) {
  Write-Host "✗ Node.js가 설치되지 않았습니다." -ForegroundColor Red
  Write-Host "  https://nodejs.org 에서 LTS 버전을 설치한 뒤 다시 실행해 주세요."
  exit 1
}
$nodeMajor = [int]($nodeVer -replace 'v(\d+)\..*', '$1')
if ($nodeMajor -lt 20) {
  Write-Host "✗ Node.js 20 이상이 필요합니다. (현재: $nodeVer)" -ForegroundColor Red
  Write-Host "  https://nodejs.org 에서 최신 LTS를 설치해 주세요."
  exit 1
}
Write-Host "✓ Node.js $nodeVer" -ForegroundColor Green

# ── 2. pnpm 설치 ──────────────────────────────────────────────────────────────
$pnpmVer = try { pnpm -v 2>&1 } catch { $null }
if (-not $pnpmVer) {
  Write-Host "→ pnpm 설치 중..." -ForegroundColor Yellow
  npm install -g pnpm --silent
  $pnpmVer = pnpm -v
}
Write-Host "✓ pnpm $pnpmVer" -ForegroundColor Green

# ── 3. Git 확인 ───────────────────────────────────────────────────────────────
$gitVer = try { git --version 2>&1 } catch { $null }
if (-not $gitVer) {
  Write-Host "✗ Git이 설치되지 않았습니다." -ForegroundColor Red
  Write-Host "  https://git-scm.com 에서 Git을 설치한 뒤 다시 실행해 주세요."
  exit 1
}
Write-Host "✓ git" -ForegroundColor Green

# ── 4. 다운로드 ────────────────────────────────────────────────────────────────
if (Test-Path "$INSTALL_DIR\.git") {
  Write-Host "→ 이미 설치됨. 최신 버전으로 업데이트 중..." -ForegroundColor Yellow
  git -C $INSTALL_DIR pull --ff-only
} else {
  Write-Host "→ BLOKS 다운로드 중..." -ForegroundColor Yellow
  git clone $REPO $INSTALL_DIR
}

# ── 5. 패키지 설치 ────────────────────────────────────────────────────────────
Write-Host "→ 패키지 설치 중... (처음엔 1~2분 소요)" -ForegroundColor Yellow
Set-Location $INSTALL_DIR
pnpm install --silent

# ── 6. 초기 설정 ─────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "━━━ API 키 설정 (Enter만 누르면 나중에 설정 가능) ━━━" -ForegroundColor White
pnpm bloks-os init

# ── 7. 실행 ───────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "✓ 설치 완료!" -ForegroundColor Green
Write-Host ""
Write-Host "앞으로는 이렇게 실행하세요:"
Write-Host "  cd ~\BLOKS && pnpm bloks-os start" -ForegroundColor White
Write-Host ""
$answer = Read-Host "지금 바로 시작할까요? [Y/n]"
if ($answer -match '^[Nn]') {
  Write-Host "나중에 실행하려면: cd ~\BLOKS && pnpm bloks-os start"
} else {
  pnpm bloks-os start
}
