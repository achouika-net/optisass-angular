@echo off
setlocal
title Build OptiSaas DEMO (Native)
color 0B

echo ========================================================
echo    Preparation du Package de Deploiment DEMO (SANS DOCKER)
echo ========================================================
echo.

:: Dossier de sortie
set DEPLOY_DIR=deploy_demo_native
if exist %DEPLOY_DIR% rd /s /q %DEPLOY_DIR%
mkdir %DEPLOY_DIR%
mkdir %DEPLOY_DIR%\backend
mkdir %DEPLOY_DIR%\frontend

echo [1/4] Build du Backend NestJS...
cd backend
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo [ERREUR] Le build du backend a echoue.
    pause
    exit /b
)
echo Copie des fichiers backend...
xcopy /E /I /Y dist ..\%DEPLOY_DIR%\backend\dist > nul
copy package.json ..\%DEPLOY_DIR%\backend\ > nul
copy package-lock.json ..\%DEPLOY_DIR%\backend\ > nul
copy prisma ..\%DEPLOY_DIR%\backend\prisma /E /I /Y > nul
cd ..

echo.
echo [2/4] Build du Frontend Angular (Production)...
cd frontend
:: Modification temporaire de l'URL API pour utiliser le proxy Nginx (/api)
powershell -Command "(Get-Content src/environments/environment.ts) -replace ': isLocal \?.*', ': isLocal ? ''http://localhost:3001'' : ''/api'',' | Set-Content src/environments/environment.ts"
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo [ERREUR] Le build du frontend a echoue.
    pause
    exit /b
)
echo Copie des fichiers frontend...
xcopy /E /I /Y dist\optisaas\browser ..\%DEPLOY_DIR%\frontend > nul
:: Remise a zero pour le dev local/shared
powershell -Command "(Get-Content src/environments/environment.ts) -replace ': isLocal \?.*', ': isLocal ? ''http://localhost:3001'' : \"http://${hostname}:3002\",' | Set-Content src/environments/environment.ts"
cd ..

echo.
echo [3/4] Export de la Base de Donnees...
call docker-db-export.bat
copy dump.sql %DEPLOY_DIR%\dump_demo.sql > nul

echo.
echo [4/4] Finalisation du dossier de deploiment...
copy ecosystem.demo.config.js %DEPLOY_DIR%\ecosystem.config.js > nul
copy nginx.demo.conf %DEPLOY_DIR%\nginx.conf > nul

echo.
echo ========================================================
echo   PACKAGE DEMO PRET !
echo   --------------------------------------------------
echo   Dossier : .\%DEPLOY_DIR%
echo.
echo   Etapes suivantes (sur votre serveur OVH) :
echo   1. Copier le contenu de '%DEPLOY_DIR%' vers /home/devuser/optisaas-demo
echo   2. Creer la DB : psql -U postgres -c "CREATE DATABASE optisaas_demo;"
echo   3. Restaurer : psql -U postgres -d optisaas_demo ^< dump_demo.sql
echo   4. Lancer le backend : pm2 start ecosystem.config.js
echo   5. Configurer Nginx avec le fichier nginx.conf fourni
echo ========================================================
echo.
pause
