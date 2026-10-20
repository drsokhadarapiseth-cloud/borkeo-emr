@echo off
rem Start Borkeo EMR so phones on the same Wi-Fi can open it.
cd /d "%~dp0"
npm run start:wifi
pause
