@echo off
echo Importation de la base de donnees dans Docker...
echo ATTENTION : Cela ecrasera les donnees actuelles dans le container Docker.
set /p confirm="Voulez-vous continuer ? (y/n) : "
if /i "%confirm%" neq "y" exit /b

if not exist dump.sql (
    echo Erreur : Le fichier dump.sql est introuvable.
    pause
    exit /b
)

docker exec -i optisaas-db psql -U postgres optisaas < dump.sql
echo Importation terminee avec succes.
pause
