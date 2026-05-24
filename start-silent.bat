@echo off
:: BLOKS 자동시작 (백그라운드 - 창 없이 실행)

:: PM2로 앱 시작 (Docker 불필요)
cd /d "D:\Projects\BLOKS"
pm2 start ecosystem.config.js --silent
pm2 save --silent
