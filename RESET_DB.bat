@echo off
echo ==============================================
echo   REINITIALISATION COMPLETE (FIX PASSWORD)
echo ==============================================
echo.
echo ATTENTION : Cela va supprimer les donnees actuelles de la base de donnees.
echo C'est necessaire car le mot de passe actuel est inconnu/incorrect.
echo.
pause

echo 1. Arret des conteneurs et suppression du volume...
docker-compose down -v

echo.
echo 2. Redemarrage (avec mot de passe 'mypassword')...
docker-compose up -d

echo.
echo 3. Attente du demarrage (10s)...
timeout /t 10 /nobreak >nul

echo.
echo 4. Application du schema corrige...
cd backend
call npx prisma db push --accept-data-loss
call npx prisma generate

echo.
echo ==============================================
echo   TERMINE ! Tout est synchronise.
echo   Vous pouvez relancer l'application.
echo ==============================================
pause
