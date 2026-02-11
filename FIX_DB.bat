@echo off
echo ==========================================
echo   REPARATION DE LA BASE DE DONNEES
echo ==========================================
echo.
echo 1. Application des changements de schema (Force)...
cd backend
call npx prisma db push --accept-data-loss

echo.
echo 2. Regeneration du client Prisma...
call npx prisma generate

echo.
echo ==========================================
echo   TERMINE ! Vous pouvez relancer le serveur.
echo ==========================================
pause
