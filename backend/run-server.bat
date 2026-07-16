@echo off
cd /d "%~dp0"
title X-ReaderPlus Backend

:: Format: delete all database files for a clean state
if exist data\settings.db del /q data\settings.db 2>nul
if exist data\content.db del /q data\content.db 2>nul
if exist data\meta.db del /q data\meta.db 2>nul
if exist data\settings.db-wal del /q data\settings.db-wal 2>nul
if exist data\content.db-wal del /q data\content.db-wal 2>nul
if exist data\meta.db-wal del /q data\meta.db-wal 2>nul
if exist data\settings.db-shm del /q data\settings.db-shm 2>nul
if exist data\content.db-shm del /q data\content.db-shm 2>nul
if exist data\meta.db-shm del /q data\meta.db-shm 2>nul
echo Database formatted.

if not exist frontend\ mkdir frontend
if not exist frontend\.gitkeep type nul > frontend\.gitkeep
set XREADER_SERVER_ONLY=true
go run -tags desktop,dev .
pause
