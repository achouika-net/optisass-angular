@echo off
echo ========================================
echo   Arret des serveurs OptiSass
echo ========================================
echo.

echo 🔍 Arret du Frontend (Port 4200)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :4200 ^| findstr LISTENING') do taskkill /F /PID %%a 2>nul
if %errorlevel% equ 0 (echo    ✅ Frontend arrete) else (echo    ℹ️  Frontend n'etait pas demarre)

echo 🔍 Arret du Backend (Port 3000)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do taskkill /F /PID %%a 2>nul
if %errorlevel% equ 0 (echo    ✅ Backend arrete) else (echo    ℹ️  Backend n'etait pas demarre)

echo 🔍 Arret de Prisma Studio (Port 5555)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5555 ^| findstr LISTENING') do taskkill /F /PID %%a 2>nul
if %errorlevel% equ 0 (echo    ✅ Prisma Studio arrete) else (echo    ℹ️  Prisma Studio n'etait pas demarre)

echo.
echo ========================================
echo   ✅ Tous les serveurs ont ete arretes
echo ========================================
echo.
pause
