@echo off
cd /d "%~dp0"
title X-ReaderPlus Rebuild

set SKIP_BACKEND=0
set CLEAN=0

:parse
if /i "%1"=="--clean" set CLEAN=1& shift & goto parse
if /i "%1"=="--frontend-only" set SKIP_BACKEND=1& shift & goto parse
if /i "%1"=="--help" goto help
if "%1"=="" goto proceed
echo Unknown option: %1
goto help

:help
echo Usage: %0 [options]
echo.
echo Options:
echo   --clean           Remove node_modules before building
echo   --frontend-only   Skip backend/Wails build, frontend only
echo   --help            Show this help
echo.
pause
exit /b 0

:proceed

:: ── Prerequisites check ──
echo === Checking prerequisites ===
where node >nul 2>&1
if %errorlevel% neq 0 ( echo ERROR: Node.js not found. Install from https://nodejs.org & pause & exit /b 1 )
call node -v

where go >nul 2>&1
if %errorlevel% neq 0 ( echo ERROR: Go not found. Install from https://go.dev & pause & exit /b 1 )
call go version

if "%SKIP_BACKEND%"=="0" (
  where wails >nul 2>&1
  if %errorlevel% neq 0 (
    echo WARNING: Wails CLI not found. Attempting to install...
    call go install github.com/wailsapp/wails/v2/cmd/wails@latest
    where wails >nul 2>&1
    if %errorlevel% neq 0 ( echo ERROR: Wails installation failed & pause & exit /b 1 )
  )
  call wails version
)

:: ── Clean ──
if "%CLEAN%"=="1" (
  echo Removing node_modules...
  if exist node_modules rmdir /s /q node_modules
)

echo Cleaning old builds...
if exist backend\frontend rmdir /s /q backend\frontend
if exist backend\build rmdir /s /q backend\build
if exist dist rmdir /s /q dist

:: ── Frontend build ──
echo Installing npm dependencies...
call npm install
if %errorlevel% neq 0 (
  echo npm install FAILED
  pause
  exit /b 1
)

:: ── Frontend quality gates ──
echo Running vue-tsc type check...
call npx vue-tsc --noEmit
if %errorlevel% neq 0 (
  echo vue-tsc type check FAILED
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

if "%SKIP_BACKEND%"=="1" (
  echo.
  echo Frontend build complete (--frontend-only, skipped backend).
  pause
  exit /b 0
)

:: ── Backend quality gates ──
echo Running go vet...
cd backend
call go vet ./...
if %errorlevel% neq 0 (
  cd ..
  echo go vet FAILED
  pause
  exit /b 1
)
cd ..

:: ── Backend build ──
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

:: ── Copy binary ──
echo Copying binary to dist/...
if not exist dist mkdir dist
if exist backend\build\bin\X-ReaderPlus.exe (
  copy /y backend\build\bin\X-ReaderPlus.exe dist\X-ReaderPlus.exe >nul
  echo OK: dist\X-ReaderPlus.exe
) else if exist backend\build\dist\X-ReaderPlus.exe (
  copy /y backend\build\dist\X-ReaderPlus.exe dist\X-ReaderPlus.exe >nul
  echo OK: dist\X-ReaderPlus.exe
) else (
  echo ERROR: built binary not found
  dir /s /b backend\build\*.exe 2>nul
  pause
  exit /b 1
)

echo.
echo Build complete.
pause
