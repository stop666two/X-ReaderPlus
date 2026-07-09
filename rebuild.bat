@echo off
cd /d "%~dp0"
title X-ReaderPlus Rebuild

if "%1"=="--clean" (
    echo Removing node_modules...
    if exist node_modules rmdir /s /q node_modules
)

echo Cleaning old builds...
if exist backend\frontend rmdir /s /q backend\frontend
if exist backend\build rmdir /s /q backend\build

echo Installing npm dependencies...
call npm install
if %errorlevel% neq 0 (
    echo npm install FAILED
    pause
    exit /b 1
)

echo Building frontend...
call npx vite build
if %errorlevel% neq 0 (
    echo Frontend build FAILED
    pause
    exit /b 1
)

echo Copying frontend to backend...
node scripts\copy-frontend.js
if %errorlevel% neq 0 (
    echo Copy-frontend FAILED
    pause
    exit /b 1
)

echo Building backend with Wails...
cd backend
call wails build
if %errorlevel% neq 0 (
    cd ..
    echo Backend build FAILED
    pause
    exit /b 1
)
cd ..

:: Copy the built exe to dist/ directory
echo Copying binary to dist/...
if exist backend\build\bin\X-ReaderPlus.exe (
    if not exist dist mkdir dist
    copy /y backend\build\bin\X-ReaderPlus.exe dist\X-ReaderPlus.exe >nul
    echo OK: dist\X-ReaderPlus.exe
) else if exist backend\build\dist\X-ReaderPlus.exe (
    if not exist dist mkdir dist
    copy /y backend\build\dist\X-ReaderPlus.exe dist\X-ReaderPlus.exe >nul
    echo OK: dist\X-ReaderPlus.exe
) else (
    echo ERROR: built binary not found
    pause
    exit /b 1
)

echo.
echo Build complete.
pause
