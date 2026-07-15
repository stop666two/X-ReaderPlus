@echo off
cd /d "%~dp0"
title X-ReaderPlus Backend
if not exist frontend\ mkdir frontend
if not exist frontend\.gitkeep echo . > frontend\.gitkeep
set XREADER_SERVER_ONLY=true
go run -tags desktop,dev .
pause
