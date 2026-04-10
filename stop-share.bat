@echo off
echo ============================================================
echo  OPTISAAS - Arret du partage de la base de donnees en reseau
echo ============================================================
echo.

echo [1/2] Arret des containers partages (Backend, Frontend, DB)...
docker-compose -f docker-compose.shared.yml down

echo.
echo [2/2] Suppression du volume temporaire partage...
docker volume rm golden-cluster_pgdata_shared >nul 2>&1

echo.
echo  ====================================================
echo   [OK] Le partage reseau est completement arrete.
echo   Vos collegues n'ont plus acces a l'application.
echo  ====================================================
echo.
pause
