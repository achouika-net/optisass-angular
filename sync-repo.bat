@echo off
echo ======================================================
echo SYNC OPTISAAS REPOSITORIES
echo ======================================================

set BRANCH=main

:: Get current branch
for /f "tokens=*" %%i in ('git rev-parse --abbrev-ref HEAD') do set BRANCH=%%i

echo Current branch: %BRANCH%
echo.

echo [+] Pushing to optisaas25 (Main)...
git push optisaas25 %BRANCH%

echo.
echo [+] Pushing to achouika (Mirror)...
git push achouika %BRANCH%

echo.
echo ======================================================
echo Sync completed on branch %BRANCH%
echo ======================================================
pause
