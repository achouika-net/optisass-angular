# 🚀 Optisaas — Partage de la Base de Données en Réseau

Ce guide permet aux membres de l'équipe d'accéder à la **base de données de démonstration** partagée depuis le serveur hôte.

---

## 📋 Prérequis

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installé et démarré
- Être sur le **même réseau local (Wi-Fi ou LAN)** que la machine hôte

---

## 🖥️ Pour l'hôte (la machine qui partage)

### Démarrage rapide

Double-cliquez sur **`share-db.bat`** ou exécutez depuis un terminal :

```bat
share-db.bat
```

Ce script va automatiquement :

1. Exporter les données actuelles de la base locale
2. Démarrer le stack Docker partagé (DB + Backend + Frontend)
3. Afficher l'IP et les liens à partager avec l'équipe

### Arrêter le partage

```bat
docker-compose -f docker-compose.shared.yml down
```

---

## 👥 Pour les membres de l'équipe (accès réseau)

### Option A — Accès direct (recommandé pour tester des données)

Utilisez directement les URLs partagées par l'hôte dans votre navigateur :

| Service             | URL                       |
|---------------------|---------------------------|
| 🌐 Application Web  | `http://<IP_HOTE>:4200`   |
| ⚙️ API Backend      | `http://<IP_HOTE>:3002`   |
| 🗄️ Prisma Studio    | `http://<IP_HOTE>:5556`   |

### Option B — Connexion à la base de données (pgAdmin / DBeaver)

| Paramètre | Valeur       |
|-----------|--------------|
| Host      | `<IP_HOTE>`  |
| Port      | `5436`       |
| Database  | `optisaas`   |
| Username  | `postgres`   |
| Password  | `mypassword` |

### Option C — Lancer votre propre stack local avec les mêmes données

1. Récupérez le fichier `dump.sql` depuis l'hôte  
2. Placez-le dans le dossier `init-scripts/`  
3. Lancez :

```bat
docker-compose -f docker-compose.shared.yml up -d
```

L'application sera disponible sur `http://localhost:4200`

---

## 🔧 Dépannage

| Problème                                   | Solution                                                                             |
|--------------------------------------------|--------------------------------------------------------------------------------------|
| Page inaccessible depuis une autre machine | Vérifier le pare-feu Windows : autoriser les ports `4200`, `3002`, `5436`            |
| Base de données vide                       | Relancer `share-db.bat` pour ré-exporter les données                                 |
| `docker-compose` introuvable               | Utiliser `docker compose` (sans tiret) si Docker Desktop récent                      |
| Container ne démarre pas                   | Exécuter `docker-compose -f docker-compose.shared.yml logs` pour voir les erreurs |

---

## 🔥 Commandes utiles

```bat
# Voir l'état des containers
docker-compose -f docker-compose.shared.yml ps

# Voir les logs en temps réel
docker-compose -f docker-compose.shared.yml logs -f

# Redémarrer proprement (avec nouvelles données)
docker-compose -f docker-compose.shared.yml down
docker volume rm golden-cluster_pgdata_shared
share-db.bat
```
