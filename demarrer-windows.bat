@echo off
echo ====================================================
echo BIENVENUE SUR OPTISAAS - LANCEMENT MANUEL LOCAL
echo ====================================================
echo.

echo Verification de l'installation du Backend...
cd backend
if not exist node_modules (
    echo Installation des dependances du Backend en cours...
    call npm install
)

echo Generation du client Prisma...
call npx prisma generate

echo Demarrage du Backend sur le port 3000...
start "OptiSaas Backend" cmd /k "npm run start:dev"

cd ..
echo.

echo Verification de l'installation du Frontend...
cd frontend
if not exist node_modules (
    echo Installation des dependances du Frontend en cours...
    call npm install
)

echo Demarrage du Frontend sur le port 4200...
start "OptiSaas Frontend" cmd /k "npm start"

cd ..
echo.
echo ====================================================
echo LES SERVEURS SONT LANCES !
echo Gardez les deux nouvelles fenetres noires ouvertes.
echo L'application sera disponible sur http://localhost:4200
echo ====================================================
pause
