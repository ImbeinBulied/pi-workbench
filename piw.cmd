@echo off
if "%~1"=="--help" (
  echo Usage: piw [project-folder] [--demo] [--session session.jsonl]
  echo Opens Pi Workbench in the current folder when no project is supplied.
  exit /b 0
)
bun "%~dp0src\main.ts" %*
exit /b %errorlevel%
