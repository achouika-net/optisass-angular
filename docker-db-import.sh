#!/bin/bash
echo "Importation de la base de données dans Docker..."
echo "ATTENTION : Cela écrasera les données actuelles dans le container Docker."
read -p "Voulez-vous continuer ? (y/n) : " confirm
if [[ $confirm != "y" ]]; then
    exit 1
fi

if [ ! -f dump.sql ]; then
    echo "Erreur : Le fichier dump.sql est introuvable."
    exit 1
fi

docker exec -i optisaas-db psql -U postgres optisaas < dump.sql
echo "Importation terminée avec succès."
