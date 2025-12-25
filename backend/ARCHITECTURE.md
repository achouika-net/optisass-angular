# 📚 OptiSaas Backend - Architecture NestJS

## 🎯 Vue d'ensemble

API REST NestJS pour la gestion d'un centre optique. Architecture modulaire avec 13 modules métier indépendants.

---

## 🏗️ Structure du Projet

```
backend/
├── src/
│   ├── features/        # 13 modules métier
│   ├── prisma/          # ORM & migrations
│   ├── app.module.ts    # Module racine
│   └── main.ts          # Point d'entrée
├── prisma/
│   └── schema.prisma    # Schéma base de données
```

---

## 📦 Modules Métier (13)

### 1. 🏢 centers
**Chemin**: `src/features/centers/`
**Responsable**: [À assigner]

**Endpoints**:
- `GET /centers` - Liste des centres
- `GET /centers/:id` - Détail centre
- `POST /centers` - Créer centre
- `PUT /centers/:id` - Modifier centre
- `DELETE /centers/:id` - Supprimer centre

**Fichiers**:
- `centers.controller.ts` - Routes API
- `centers.service.ts` - Logique métier
- `centers.module.ts` - Configuration
- `dto/create-centre.dto.ts` - DTO création
- `dto/update-centre.dto.ts` - DTO modification

---

### 2. 👥 clients
**Chemin**: `src/features/clients/`
**Responsable**: [À assigner]

**Endpoints**:
- `GET /clients` - Liste clients
- `GET /clients/:id` - Détail client
- `POST /clients` - Créer client
- `PUT /clients/:id` - Modifier client
- `GET /clients/:id/fiches` - Fiches du client
- `GET /clients/:id/factures` - Factures du client

**Fichiers**:
- `clients.controller.ts`
- `clients.service.ts`
- `clients.module.ts`
- `dto/create-client.dto.ts`
- `dto/update-client.dto.ts`

---

### 3. 💰 factures
**Chemin**: `src/features/factures/`
**Responsable**: [À assigner]

**Endpoints**:
- `GET /factures` - Liste factures
- `GET /factures/:id` - Détail facture
- `POST /factures` - Créer facture
- `PUT /factures/:id` - Modifier facture
- `POST /factures/:id/validate` - Valider facture
- `GET /factures/:id/pdf` - Générer PDF

**Fichiers**:
- `factures.controller.ts`
- `factures.service.ts`
- `factures.module.ts`
- `dto/create-facture.dto.ts`
- `dto/update-facture.dto.ts`

---

### 4. 📋 fiches
**Chemin**: `src/features/fiches/`
**Responsable**: [À assigner]

**Endpoints**:
- `GET /fiches` - Liste fiches
- `GET /fiches/:id` - Détail fiche
- `POST /fiches` - Créer fiche
- `PUT /fiches/:id` - Modifier fiche
- `GET /fiches/:id/facture` - Facture liée

**Fichiers**:
- `fiches.controller.ts`
- `fiches.service.ts`
- `fiches.module.ts`
- `dto/create-fiche.dto.ts`
- `dto/update-fiche.dto.ts`

---

### 5. 👤 groups
**Chemin**: `src/features/groups/`
**Responsable**: [À assigner]

**Endpoints**:
- `GET /groups` - Liste groupes
- `GET /groups/:id` - Détail groupe
- `POST /groups` - Créer groupe
- `PUT /groups/:id` - Modifier groupe
- `DELETE /groups/:id` - Supprimer groupe

**Fichiers**:
- `groups.controller.ts`
- `groups.service.ts`
- `groups.module.ts`
- `dto/create-group.dto.ts`
- `dto/update-group.dto.ts`

---

### 6. 🎁 loyalty
**Chemin**: `src/features/loyalty/`
**Responsable**: [À assigner]

**Endpoints**:
- `GET /loyalty/config` - Configuration fidélité
- `POST /loyalty/config` - Mettre à jour config
- `POST /loyalty/redeem` - Échanger points
- `GET /loyalty/check-reward/:clientId` - Vérifier éligibilité

**Fichiers**:
- `loyalty.controller.ts`
- `loyalty.service.ts`
- `loyalty.module.ts`

---

### 7. 💳 paiements
**Chemin**: `src/features/paiements/`
**Responsable**: [À assigner]

**Endpoints**:
- `GET /paiements` - Liste paiements
- `GET /paiements/:id` - Détail paiement
- `POST /paiements` - Créer paiement
- `GET /paiements/facture/:id` - Paiements d'une facture

**Fichiers**:
- `paiements.controller.ts`
- `paiements.service.ts`
- `paiements.module.ts`
- `dto/create-paiement.dto.ts`

---

### 8. 📦 products
**Chemin**: `src/features/products/`
**Responsable**: [À assigner]

**Endpoints**:
- `GET /products` - Liste produits
- `GET /products/:id` - Détail produit
- `POST /products` - Créer produit
- `PUT /products/:id` - Modifier produit
- `DELETE /products/:id` - Supprimer produit
- `GET /products/stats` - Statistiques stock

**Fichiers**:
- `products.controller.ts`
- `products.service.ts`
- `products.module.ts`
- `dto/create-product.dto.ts`
- `dto/update-product.dto.ts`

---

### 9. 📊 sales-control
**Chemin**: `src/features/sales-control/`
**Responsable**: [À assigner]

**Endpoints**:
- `GET /sales-control/dashboard-data` - Données dashboard
- `GET /sales-control/statistics` - Stats par vendeur
- `GET /sales-control/brouillon-with-payments` - Devis avec paiements
- `GET /sales-control/brouillon-without-payments` - Devis sans paiements
- `POST /sales-control/validate/:id` - Valider facture
- `POST /sales-control/archive/:id` - Archiver facture

**Fichiers**:
- `sales-control.controller.ts`
- `sales-control.service.ts`
- `sales-control.module.ts`

---

### 10. 📈 stats ⭐ NOUVEAU
**Chemin**: `src/features/stats/`
**Responsable**: [À assigner]

**Endpoints**:
- `GET /stats/summary` - Résumé global
- `GET /stats/revenue-evolution` - Évolution CA (daily/monthly/yearly)
- `GET /stats/product-distribution` - Répartition produits
- `GET /stats/conversion-rate` - Taux conversion devis→factures
- `GET /stats/stock-by-warehouse` - Stock par entrepôt
- `GET /stats/top-clients` - Top 10 clients
- `GET /stats/payment-methods` - Méthodes de paiement

**Fichiers**:
- `stats.controller.ts`
- `stats.service.ts`
- `stats.module.ts`

**Interfaces exportées**:
- `RevenueDataPoint`
- `ProductDistribution`
- `ConversionMetrics`
- `WarehouseStock`
- `TopClient`
- `PaymentMethodStat`

---

### 11. 📦 stock-movements
**Chemin**: `src/features/stock-movements/`
**Responsable**: [À assigner]

**Endpoints**:
- `GET /stock-movements` - Liste mouvements
- `POST /stock-movements` - Créer mouvement
- `GET /stock-movements/product/:id` - Mouvements d'un produit

**Fichiers**:
- `stock-movements.controller.ts`
- `stock-movements.service.ts`
- `stock-movements.module.ts`

---

### 12. 👨‍💼 users
**Chemin**: `src/features/users/`
**Responsable**: [À assigner]

**Endpoints**:
- `GET /users` - Liste utilisateurs
- `GET /users/:id` - Détail utilisateur
- `POST /users` - Créer utilisateur
- `PUT /users/:id` - Modifier utilisateur
- `DELETE /users/:id` - Supprimer utilisateur

**Fichiers**:
- `users.controller.ts`
- `users.service.ts`
- `users.module.ts`
- `dto/create-user.dto.ts`
- `dto/update-user.dto.ts`

---

### 13. 🏭 warehouses
**Chemin**: `src/features/warehouses/`
**Responsable**: [À assigner]

**Endpoints**:
- `GET /warehouses` - Liste entrepôts
- `GET /warehouses/:id` - Détail entrepôt (avec produits)
- `POST /warehouses` - Créer entrepôt
- `PUT /warehouses/:id` - Modifier entrepôt
- `DELETE /warehouses/:id` - Supprimer entrepôt

**Fichiers**:
- `warehouses.controller.ts`
- `warehouses.service.ts`
- `warehouses.module.ts`
- `dto/create-entrepot.dto.ts`
- `dto/update-entrepot.dto.ts`

---

## 📂 Structure Type d'un Module

```
features/
└── nom-module/
    ├── dto/                    # Data Transfer Objects
    │   ├── create-*.dto.ts
    │   └── update-*.dto.ts
    ├── entities/               # Entités (optionnel)
    ├── nom-module.controller.ts  # Routes API
    ├── nom-module.service.ts     # Logique métier
    └── nom-module.module.ts      # Configuration
```

---

## 🔄 Flux de Données

```
HTTP Request
    ↓
Controller (@Get, @Post, etc.)
    ↓
Service (Logique métier)
    ↓
Prisma Client
    ↓
PostgreSQL Database
    ↓
Response JSON
```

---

## 🛠️ Technologies

- **Framework**: NestJS 10
- **ORM**: Prisma
- **Database**: PostgreSQL
- **Validation**: class-validator
- **Documentation**: Swagger (optionnel)

---

## 👥 Workflow Git

### 1. Créer une branche feature
```bash
git checkout -b feature/nom-module-fonctionnalite
```

### 2. Développer
- Modifier uniquement votre module
- Tester avec Postman/Insomnia

### 3. Commiter
```bash
git add .
git commit -m "feat(nom-module): description"
```

### 4. Pousser et PR
```bash
git push origin feature/nom-module-fonctionnalite
```

---

## 🚀 Démarrage

```bash
# Installer dépendances
npm install

# Configurer .env
cp .env.example .env

# Migrer base de données
npx prisma migrate dev

# Générer Prisma Client
npx prisma generate

# Lancer dev server
npm run start:dev

# Build production
npm run build

# Tests
npm test
```

**URL**: http://localhost:3000/api

---

## 📋 Conventions

### Commits
```
feat(module): nouvelle fonctionnalité
fix(module): correction bug
refactor(module): refactorisation
docs(module): documentation
```

### Fichiers
- `kebab-case.controller.ts`
- `kebab-case.service.ts`
- `kebab-case.module.ts`
- `create-kebab-case.dto.ts`

---

## 🗄️ Base de Données

### Prisma Schema
Fichier: `prisma/schema.prisma`

**Modèles principaux**:
- Client
- Fiche
- Facture
- Paiement
- Product
- Entrepot
- MouvementStock
- User
- Centre
- Group
- LoyaltyConfig
- RewardRedemption

---

## 📚 Ressources

- **NestJS Docs**: https://docs.nestjs.com
- **Prisma Docs**: https://www.prisma.io/docs
- **PostgreSQL**: https://www.postgresql.org/docs

---

**Version**: 1.0.0  
**Dernière MAJ**: 25 décembre 2024
