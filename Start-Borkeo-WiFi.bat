@echo off
rem Start Borkeo EMR so phones on the same Wi-Fi can open it.
rem v42.2: runs Node directly (no npm), checks the usual problems first, and
rem keeps this window open on any error so the message can be read.
setlocal
cd /d "%~dp0"
title Borkeo EMR

if not exist "%~dp0server\server.mjs" (
  echo.
  echo [ERROR] The EMR files were not found next to this file.
  echo         If you opened the ZIP, extract it first ^(right-click - Extract All^),
  echo         then double-click Start-Borkeo-WiFi.bat inside the extracted folder.
  goto failed
)

set "NODE_EXE="
for %%N in (node.exe) do set "NODE_EXE=%%~$PATH:N"
if not defined NODE_EXE if exist "%ProgramFiles%\nodejs\node.exe" set "NODE_EXE=%ProgramFiles%\nodejs\node.exe"
if not defined NODE_EXE if exist "%LocalAppData%\Programs\nodejs\node.exe" set "NODE_EXE=%LocalAppData%\Programs\nodejs\node.exe"
if not defined NODE_EXE (
  echo.
  echo [ERROR] Node.js was not found. Install Node.js 24 or newer from https://nodejs.org
  echo         then restart the computer and double-click this file again.
  goto failed
)

rem The Node launcher selects this copy's port and opens its existing EMR.
rem Never kill another EMR or an unrelated program.

"%NODE_EXE%" scripts\start-wifi.mjs
if errorlevel 1 (
  echo.
  echo [ERROR] The EMR server stopped with an error ^(see the message above^).
  goto failed
)
exit /b 0

:failed
echo.
pause
exit /b 1
