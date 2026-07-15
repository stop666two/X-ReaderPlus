@echo off
cd /d "%~dp0"
title X-ReaderPlus Backend
set XREADER_SERVER_ONLY=true
go run -tags desktop,dev .
pause
