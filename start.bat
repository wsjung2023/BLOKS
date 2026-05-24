@echo off
echo ==========================================
echo  BLOKS Dev Stack Starting...
echo ==========================================

:: Start all apps via PM2
echo [1/2] Starting apps with PM2...
cd /d "%~dp0"
pm2 start ecosystem.config.js

:: Save PM2 process list
echo [2/2] Saving PM2 process list...
pm2 save

echo.
echo ==========================================
echo  BLOKS is running! (Docker-free)
echo  Web  : http://localhost:3000
echo  API  : http://localhost:4000
echo  Logs : pm2 logs
echo  Stop : pm2 stop all
echo ==========================================
echo.
pause
