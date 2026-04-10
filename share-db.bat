@echo off
setlocal enabledelayedexpansion
echo ============================================================
echo  OPTISAAS - Partage de la base de donnees en reseau
echo ============================================================
echo.

REM --- Verifier que Docker est disponible ---
docker info >nul 2>&1
if errorlevel 1 (
    echo [ERREUR] Docker n'est pas demarre ou n'est pas installe.
    echo Veuillez demarrer Docker Desktop et reessayer.
    pause
    exit /b 1
)

REM --- Etape 1 : Exporter les donnees depuis le container local ---
echo [1/4] Export des donnees locales...
docker ps --format "{{.Names}}" | findstr /x /i "optisaas-db" >nul 2>&1
if errorlevel 1 (
    echo [WARN] Container optisaas-db non trouve - demarrage temporaire...
    docker-compose up -d db
    timeout /t 5 /nobreak >nul
)

docker exec -t optisaas-db pg_dump -U postgres --no-owner --no-acl --clean --if-exists optisaas > dump.sql
if errorlevel 1 (
    echo [ERREUR] Export de la base echoue.
    pause
    exit /b 1
)
echo  [OK] dump.sql cree.

REM --- Etape 2 : Copier vers init-scripts ---
echo [2/4] Preparation des scripts d'initialisation...
if not exist "init-scripts" mkdir init-scripts
copy /Y dump.sql init-scripts\dump.sql >nul
echo  [OK] init-scripts\dump.sql pret.

REM --- Etape 3 : Demarrer le stack partage ---
echo [3/4] Demarrage du stack Docker partage...
docker-compose -f docker-compose.shared.yml down >nul 2>&1
docker volume rm golden-cluster_pgdata_shared >nul 2>&1
docker-compose -f docker-compose.shared.yml up -d --build
if errorlevel 1 (
    echo [ERREUR] Echec du demarrage du stack Docker.
    pause
    exit /b 1
)
echo  [OK] Stack demarre avec succes.

REM --- Etape 4 : Afficher l'IP locale ---
echo [4/4] Detection de l'adresse IP du reseau local...
echo.
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4"') do (
    set ip=%%a
    set ip=!ip: =!
    echo  ====================================================
    echo   Partagez ces liens avec votre equipe :
    echo  ====================================================
    echo.
    echo   Application Web  : http://!ip!:4200
    echo   API Backend      : http://!ip!:3002
    echo   Prisma Studio    : http://!ip!:5556
    echo   Base de donnees  : !ip!:5436  (user: postgres / pass: mypassword)
    echo.
    echo   Depuis pgAdmin / DBeaver :
    echo     Host     : !ip!
    echo     Port     : 5436
    echo     Database : optisaas
    echo     Username : postgres
    echo     Password : mypassword
    echo.
)
echo  ====================================================
echo   Pour arreter le partage : docker-compose -f docker-compose.shared.yml down
echo  ====================================================
echo.
pause
