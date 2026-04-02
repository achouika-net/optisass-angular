@echo off
echo ============================================
echo  Export de la base de donnees optisaas
echo ============================================
echo.

REM Verifier que le container est actif
docker ps --filter "name=optisaas-db" --format "{{.Names}}" | findstr /i "optisaas-db" >nul 2>&1
if errorlevel 1 (
    echo [ERREUR] Le container optisaas-db n'est pas en cours d'execution.
    echo Lancez d'abord: docker-compose up -d db
    pause
    exit /b 1
)

echo [1/3] Export des donnees depuis le container...
docker exec -t optisaas-db pg_dump -U postgres --no-owner --no-acl --clean --if-exists optisaas > dump.sql

if errorlevel 1 (
    echo [ERREUR] L'export a echoue.
    pause
    exit /b 1
)

echo [2/3] Copie vers init-scripts pour partage...
if not exist "init-scripts" mkdir init-scripts
copy /Y dump.sql init-scripts\dump.sql >nul

echo [3/3] Export termine avec succes!
echo.
echo  Fichiers crees:
echo    - dump.sql             (a partager avec l'equipe)
echo    - init-scripts\dump.sql (utilise par docker-compose.shared.yml)
echo.
echo  Taille du dump:
for %%F in (dump.sql) do echo    %%~zF octets
echo.
pause
