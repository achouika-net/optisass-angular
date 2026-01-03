# Utilisation de Docker pour OptiSaaS

Pour démarrer l'application complète sans installer de dépendances locales, suivez ces étapes :

## Prérequis
- Docker Desktop installé et lancé.

## Lancement rapide
1. Ouvrez un terminal à la racine du projet.
2. Lancez la commande suivante :
   ```bash
   docker-compose up --build
   ```

## Accès aux services
Une fois le lancement terminé, vous pourrez accéder à :
- **Frontend** : [http://localhost:4200](http://localhost:4200)
- **Backend (API)** : [http://localhost:3000/api](http://localhost:3000/api)
- **Prisma Studio** : [http://localhost:5555](http://localhost:5555)

## Notes importantes
- La base de données PostgreSQL est incluse dans le Docker. Les données sont persistées dans un volume nommé `pgdata`.
- Le backend génère automatiquement le client Prisma au démarrage du container.
- Le frontend est configuré pour supporter le rechargement à chaud (Hot Reload) si vous modifiez vos fichiers locaux.
