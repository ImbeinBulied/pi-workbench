@echo off
bun "%~dp0src\cli.ts" %*
exit /b %errorlevel%
