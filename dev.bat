@echo off
chcp 65001 >nul
cd /d "%~dp0"
title X-ReaderPlus Dev Server

echo === X-ReaderPlus Dev Server ===
echo.

echo [1] Cleaning up previous processes...
taskkill /f /fi "WINDOWTITLE eq X-ReaderPlus-Backend*" 2>nul >nul
taskkill /f /fi "WINDOWTITLE eq X-ReaderPlus-Frontend*" 2>nul >nul
for /f "tokens=5" %%a in ('netstat -ano ^| findstr /c:":34123" 2^>nul') do (
  tasklist /fi "PID eq %%a" 2>nul | findstr /i "go.exe" >nul && taskkill /f /pid %%a 2>nul
)
timeout /t 2 >nul

echo [2] Starting Go API server (port 34123)...
start "X-ReaderPlus-Backend" cmd /c "cd /d %~dp0backend && .\run-server.bat"
echo   Waiting for backend...
set RETRIES=0
:retry
timeout /t 2 >nul
set /a RETRIES+=1
netstat -ano | findstr /c:":34123" >nul 2>&1
if errorlevel 1 (
  if %RETRIES% lss 15 goto retry
  echo   ERROR: Backend failed to start within 30s
  pause
  exit /b 1
)
echo   Backend ready.

echo [3] Starting Vite frontend (port 5173)...
start "X-ReaderPlus-Frontend" cmd /c "cd /d %~dp0 && title X-ReaderPlus-Frontend && npm run dev"
echo   Frontend starting.

echo.
echo Backend:  http://127.0.0.1:34123
echo Frontend: http://localhost:5173
echo.
echo.
echo ========================================
echo   Press ENTER to shut down all servers
echo ========================================
pause >nul

echo Shutting down...
:: Kill backend (by port and go process)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr /c:":34123" 2^>nul') do (
  taskkill /f /pid %%a 2>nul >nul
)
:: Kill frontend (by port and node process)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr /c:":5173" 2^>nul') do (
  taskkill /f /pid %%a 2>nul >nul
)
:: Close the CMD windows by known titles
taskkill /f /fi "WINDOWTITLE eq X-ReaderPlus Backend" 2>nul >nul
taskkill /f /fi "WINDOWTITLE eq X-ReaderPlus-Frontend" 2>nul >nul
echo All servers stopped. Closing this window...
exit
