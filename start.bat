@echo off
echo ==========================================
echo  BLOKS Dev Stack Starting...
echo ==========================================

:: 1) Docker (Redis + Postgres)
echo [1/3] Starting Docker containers...
docker compose -f "%~dp0docker-compose.yml" up -d
if errorlevel 1 (
  echo [WARNING] Docker failed - Redis may not be running
  pause
)

:: 2) Wait for containers to be healthy
timeout /t 3 /nobreak >nul

:: 3) Start all apps via PM2
echo [2/3] Starting apps with PM2...
cd /d "%~dp0"
pm2 start ecosystem.config.js

:: 4) Save PM2 process list
echo [3/3] Saving PM2 process list...
pm2 save

echo.
echo ==========================================
echo  BLOKS is running!
echo  Web  : http://localhost:3000
echo  API  : http://localhost:4000
echo  Logs : pm2 logs
echo  Stop : pm2 stop all
echo ==========================================
echo.
pause
