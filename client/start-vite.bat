@echo off
cd /d "%~dp0"
set CI=false
npx vite --port 3000 --host > C:\Users\maju\AppData\Local\Temp\vite-dev.log 2>&1
