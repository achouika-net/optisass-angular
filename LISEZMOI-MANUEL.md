# OptiSaas - Version Portable (Sans Docker)

Ce dossier contient le code source de l'application OptiSaas, prêt à fonctionner en environnement de développement local sans Docker.

## Prérequis

1. **Node.js** (version 18 ou supérieure) installé sur la machine.
2. **PostgreSQL** (version 15 ou supérieure) installé sur la machine.

---

## Étape 1 : Base de données (PostgreSQL)

1. Ouvrez l'outil d'administration PostgreSQL (par exemple `pgAdmin`) ou votre terminal `psql`.
2. Créez une nouvelle base de données nommée `optisaas`.
3. Importez (restaurez) le fichier contenant vos données existantes :
   Trouvez le fichier **`init-db/01-init.sql`** situé dans ce dossier.
   Exécutez ce fichier SQL dans votre nouvelle base de données `optisaas`.

---

## Étape 2 : Configuration du Backend

1. Ouvrez le dossier `backend`.
2. Renommez le fichier `.env.example` en `.env` (ou créez-en un s'il n'existe pas).
3. À l'intérieur du fichier `.env`, ajoutez/modifiez la variable `DATABASE_URL` pour qu'elle pointe vers votre base de données locale fraîchement créée :

   ```env
   DATABASE_URL="postgresql://VOTRE_UTILISATEUR:VOTRE_MOT_DE_PASSE@localhost:5432/optisaas?schema=public"
   ```

   *(Remplacez `VOTRE_UTILISATEUR` et `VOTRE_MOT_DE_PASSE` par vos vrais accès PostgreSQL locaux).*

---

## Étape 3 : Démarrage de l'Application (Windows)

Une fois la base de données configurée, vous pouvez tout lancer facilement :

1. Retournez dans le dossier racine du projet.
2. Double-cliquez sur le fichier **`demarrer-windows.bat`**.

Ce script se chargera d'installer les dépendances (`npm install`) puis d'ouvrir deux fenêtres noires (Consoles) :

- Une pour le **serveur Backend** (qui gère la logique de l'API et la BDD) démarrant sur le port 3000.
- Une pour le **serveur Frontend** (l'interface utilisateur Angular) démarrant sur le port 4200.

Une fois que les lignes de code s'arrêtent de défiler, ouvrez votre navigateur et allez sur :
👉 [http://localhost:4200](http://localhost:4200)

*(Ne fermez pas les fenêtres noires de console pendant que vous utilisez l'application).*
