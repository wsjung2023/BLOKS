# Sets up Claude Code skills and plugins for BLOKS development.
# Run once after cloning: pnpm setup:claude

Write-Host "BLOKS — Claude Code skill setup" -ForegroundColor White

function Install-Plugin {
  param([string]$Name, [string]$Id)
  Write-Host -NoNewline "  $Name ... "
  $result = claude plugin install $Id 2>&1
  if ($LASTEXITCODE -eq 0) {
    Write-Host "installed" -ForegroundColor Green
  } else {
    Write-Host "run manually: claude plugin install $Id" -ForegroundColor Yellow
  }
}

Write-Host ""
Write-Host "1. Installing 3rd-party plugins:"
Install-Plugin "superpowers (Karpathy + TDD + debugging workflows)" "obra/superpowers"
Install-Plugin "ralph-loop (continuous AI iteration loops)"         "ralph-loop"
Install-Plugin "agent-toolkit (50+ modular dev skills)"            "softaworks/agent-toolkit"

Write-Host ""
Write-Host "2. Installing BLOKS plugin (project-specific skills):"
Write-Host -NoNewline "  bloks (karpathy-guidelines + bloks-collab-impl) ... "
$result = claude plugin install ./ 2>&1
if ($LASTEXITCODE -eq 0) {
  Write-Host "installed" -ForegroundColor Green
} else {
  Write-Host "run manually: claude plugin install ./" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Done." -ForegroundColor Green
Write-Host "Restart Claude Code for all skills to take effect."
Write-Host ""
Write-Host "Available skills after setup:"
Write-Host "  /karpathy-guidelines  — surgical coding, simplicity-first"
Write-Host "  /bloks-collab-impl    — BLOKS collaboration system guide"
Write-Host "  /ralph-loop           — continuous iteration loops"
Write-Host "  /superpowers          — full dev workflow (TDD, debugging, review)"
Write-Host "  /agent-toolkit        — docs, testing, planning skills"
