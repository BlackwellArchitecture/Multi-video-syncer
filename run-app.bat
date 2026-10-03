@echo off
title Video Syncer - Desktop Application
cd /d "%~dp0"

echo [VIDEO SYNCER] Starting hardware-accelerated desktop application...
call npm.cmd start
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Failed to start application via npm.
    echo Attempting direct npx launch...
    call npx.cmd electron .
)
pause
