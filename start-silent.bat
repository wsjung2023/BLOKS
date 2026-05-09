@echo off
:: BLOKS 자동시작 (백그라운드 - 창 없이 실행)

:: Docker (Redis + Postgres)
"C:\Program Files\Docker\Docker\resources\bin\docker.exe" compose -f "D:\Projects\BLOKS\docker-compose.yml" up -d

:: 컨테이너 준비 대기
timeout /t 5 /nobreak >nul

:: PM2로 앱 시작
cd /d "D:\Projects\BLOKS"
pm2 start ecosystem.config.js --silent
pm2 save --silent
