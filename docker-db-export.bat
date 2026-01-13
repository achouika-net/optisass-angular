@echo off
echo Exportation de la base de donnees depuis Docker...
docker exec -t optisaas-db pg_dump -U postgres optisaas > dump.sql
echo Exportation terminee : dump.sql
pause
