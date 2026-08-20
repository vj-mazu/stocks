@echo off
echo ==============================================
echo INITIALIZING AND PUSHING TO GITHUB
echo ==============================================
cd /d "%~dp0"

:: Check if git repository is initialized locally
if not exist .git (
    echo [1/4] Initializing new local Git repository...
    git init
    echo.
    echo [2/4] Linking to GitHub remote...
    git remote add origin https://github.com/vj-mazu/stocks.git
) else (
    echo Local Git repository already initialized.
)

echo.
echo [3/4] Staging files (forcing past ignore rules)...
:: Use git add -A to stage files inside the local folder
git add -A

echo.
echo [4/4] Committing changes...
git commit -m "Push all updates from today"

echo.
echo [5/4] Pushing to GitHub main branch...
git branch -M main
git push -u origin main --force

echo.
echo ==============================================
echo Done!
echo ==============================================
pause
