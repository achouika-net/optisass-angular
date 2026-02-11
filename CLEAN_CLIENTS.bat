@echo off
echo.
echo ===========================================
echo   PURGE DE LA TABLE CLIENTS
echo ===========================================
echo.
echo Cette action va supprimer TOUS les clients de la base de donnees.
echo.
set /p confirm="Etes-vous sur de vouloir continuer ? (O/N) : "
if /i "%confirm%" neq "O" goto cancel

echo Execution du script...
cd backend
npx ts-node src/scripts/clean-clients.ts
cd ..

echo.
echo Termine.
pause
exit

:cancel
echo Operation annulee.
pause
exit
