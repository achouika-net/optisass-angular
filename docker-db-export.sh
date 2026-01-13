#!/bin/bash
echo "Exportation de la base de données depuis Docker..."
docker exec -t optisaas-db pg_dump -U postgres optisaas > dump.sql
echo "Exportation terminée : dump.sql"
