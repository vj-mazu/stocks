@echo off
echo ==============================================
echo SYNCING LOCAL PROJECT WITH GITHUB
echo ==============================================
cd /d "%~dp0"

:: Initialize Git if not present
if not exist .git (
    echo [1/3] Git not found. Initializing local repository...
    git init
    echo.
    echo [2/3] Connecting to GitHub remote...
    git remote add origin https://github.com/vj-mazu/stocks.git
) else (
    echo Local Git repository already exists.
)

echo.
echo [3/3] Pulling latest commits from GitHub...
:: Fetch the latest code from GitHub
git fetch origin main

:: Reset local branch to match remote exactly
echo Syncing files with GitHub branch...
git reset --hard origin/main

echo.
echo ==============================================
echo Sync Complete! Your local project is now up to date.
echo ==============================================
pause
