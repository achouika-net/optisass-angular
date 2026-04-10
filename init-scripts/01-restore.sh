#!/bin/bash
# Ce script est execute automatiquement par PostgreSQL au premier demarrage du container
# Il restaure la base de donnees depuis le dump.sql

set -e

echo "========================================"
echo " Restauration de la base optisaas..."
echo "========================================"

DUMP_FILE="/docker-entrypoint-initdb.d/dump.sql"

if [ -f "$DUMP_FILE" ]; then
    echo "[INFO] Fichier dump.sql trouve, restauration en cours..."
    psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f "$DUMP_FILE"
    echo "[OK] Base de donnees restauree avec succes!"
else
    echo "[WARN] Aucun dump.sql trouve - base de donnees vide."
fi
