@echo off
cd /d "%~dp0"
title X-ReaderPlus Dev Server

echo === X-ReaderPlus Dev Server ===
echo.

echo [1] Cleaning up...
taskkill /f /im node.exe 2>nul >nul
taskkill /f /im X-ReaderPlus.exe 2>nul >nul
for /f "tokens=5" %%a in ('netstat -ano ^| findstr /c:":34123" 2^>nul') do taskkill /f /pid %%a 2>nul >nul
timeout /t 2 >nul

echo [2] Starting Go API server (port 34123)...
start "X-ReaderPlus-Backend" cmd /c "cd /d %~dp0backend && .\run-server.bat"
echo   Waiting for backend...
:retry
timeout /t 2 >nul
netstat -ano | findstr /c:":34123" >nul 2>&1
if errorlevel 1 goto retry
echo   Backend ready.

echo [3] Starting Vite frontend (port 5173)...
start "X-ReaderPlus-Frontend" cmd /c "cd /d %~dp0 && title X-ReaderPlus-Frontend && npm run dev"
echo   Frontend starting.

echo.
echo Backend:  http://127.0.0.1:34123
echo Frontend: http://localhost:5173
echo.
timeout /t 10 >nul
