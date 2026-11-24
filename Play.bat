@echo off
title Part-Time Pilot
cd /d "%~dp0"
where node >nul 2>nul
if %errorlevel%==0 (
  node server.js
) else (
  echo Node.js not found - opening index.html directly in your browser instead.
  start "" "%~dp0index.html"
)
