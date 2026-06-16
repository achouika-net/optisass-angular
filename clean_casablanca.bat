@echo off
echo ===================================================
echo   Lancement du Nettoyage du Centre Casablanca
echo ===================================================
cd backend
set DATABASE_URL=postgresql://postgres:mypassword@localhost:5435/optisaas?schema=public
set NODE_PATH=node_modules
node clean_casablanca.js
pause
