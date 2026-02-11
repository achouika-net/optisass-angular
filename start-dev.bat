@echo off
echo ========================================
echo   Demarrage des serveurs OptiSass
echo ========================================
echo.

echo 1. Arret des processus existants...
:: Optionnel: Tuer les processus sur les ports 3000, 4200, 5555 si possible via cmd
:: (Nécessite souvent des droits admin ou des commandes complexes, on laisse start gérer les nouvelles fenêtres)

echo 2. Synchronisation de la Base de Donnees...
cd backend 
call npx prisma db push --accept-data-loss
call npx prisma generate
cd ..

echo 3. Demarrage du Backend (Port 3000)...
start "Backend - NestJS" cmd /k "cd backend && npm run start:dev"
timeout /t 5 /nobreak >nul

echo 3. Demarrage du Frontend (Port 4200)...
start "Frontend - Angular" cmd /k "cd frontend && npm start"

echo 4. Demarrage de Prisma Studio (Port 5555)...
start "Prisma Studio" cmd /k "cd backend && npx prisma studio"

echo.
echo ========================================
echo   Les serveurs sont en cours de demarrage
echo   Backend:  http://localhost:3000
echo   Frontend: http://localhost:4200
echo   Prisma:   http://localhost:5555
echo ========================================
echo.
echo Appuyez sur une touche pour fermer cette fenetre...
pause >nul
