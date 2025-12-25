# 📚 OptiSaas - Guide de l'Architecture et Organisation du Code

## 🎯 Vue d'ensemble

OptiSaas est organisé en **architecture modulaire** avec séparation claire entre Backend (NestJS) et Frontend (Angular). Chaque module est **autonome** et peut être développé/maintenu **indépendamment** par différents membres de l'équipe.

---

## 🏗️ Structure Globale

```
golden-cluster/
├── backend/          # API NestJS
│   └── src/
│       └── features/ # 13 modules métier
└── frontend/         # Application Angular
    └── src/app/
        └── features/ # 12 modules fonctionnels
```

---

## 🔧 Backend - Modules NestJS

Chaque module backend suit le pattern **Controller → Service → Prisma**

### 📦 Liste des Modules Backend

| Module | Responsabilité | Fichiers Clés |
|--------|---------------|---------------|
| **centers** | Gestion des centres optiques | `centers.controller.ts`, `centers.service.ts` |
| **clients** | Gestion des clients | `clients.controller.ts`, `clients.service.ts` |
| **factures** | Facturation et devis | `factures.controller.ts`, `factures.service.ts` |
| **fiches** | Fiches médicales (montures/lentilles) | `fiches.controller.ts`, `fiches.service.ts` |
| **groups** | Groupes d'utilisateurs | `groups.controller.ts`, `groups.service.ts` |
| **loyalty** | Programme de fidélité | `loyalty.controller.ts`, `loyalty.service.ts` |
| **paiements** | Gestion des paiements | `paiements.controller.ts`, `paiements.service.ts` |
| **products** | Catalogue produits | `products.controller.ts`, `products.service.ts` |
| **sales-control** | Contrôle des ventes | `sales-control.controller.ts`, `sales-control.service.ts` |
| **stats** | Statistiques avancées | `stats.controller.ts`, `stats.service.ts` |
| **stock-movements** | Mouvements de stock | `stock-movements.controller.ts`, `stock-movements.service.ts` |
| **users** | Gestion des utilisateurs | `users.controller.ts`, `users.service.ts` |
| **warehouses** | Gestion des entrepôts | `warehouses.controller.ts`, `warehouses.service.ts` |

### 📂 Structure Type d'un Module Backend

```
features/
└── nom-module/
    ├── dto/                    # Data Transfer Objects
    │   ├── create-*.dto.ts
    │   └── update-*.dto.ts
    ├── entities/               # Entités Prisma (optionnel)
    ├── nom-module.controller.ts  # Routes API
    ├── nom-module.service.ts     # Logique métier
    └── nom-module.module.ts      # Configuration module
```

---

## 🎨 Frontend - Modules Angular

Chaque module frontend suit le pattern **Component → Service → API**

### 📦 Liste des Modules Frontend

| Module | Responsabilité | Composants Principaux |
|--------|---------------|----------------------|
| **authentication** | Connexion/Inscription | `login.component`, `register.component` |
| **centers** | Gestion centres | `center-list.component`, `center-form-dialog.component` |
| **client-management** | Gestion clients & fiches | `client-list`, `client-detail`, `lentilles-form`, `monture-form` |
| **dashboard** | Tableau de bord | `dashboard.component` |
| **groups** | Gestion groupes | `groups-list.component`, `group-detail.component` |
| **measurement** | Mesures optiques | `camera-view`, `measurement-form` |
| **reports** | Rapports & statistiques | `sales-control-report`, `advanced-stats` |
| **settings** | Paramètres | `loyalty-config.component` |
| **stock-management** | Gestion stock | `product-list`, `product-form`, `stock-transfer-dialog` |
| **user-management** | Gestion utilisateurs | `user-list.component`, `user-form.component` |
| **warehouses** | Gestion entrepôts | `warehouse-list`, `warehouse-detail` |

### 📂 Structure Type d'un Module Frontend

```
features/
└── nom-module/
    ├── pages/                  # Pages principales
    │   └── nom-page/
    │       ├── nom-page.component.ts
    │       ├── nom-page.component.html
    │       └── nom-page.component.scss
    ├── dialogs/                # Modales/Dialogues
    │   └── nom-dialog/
    │       ├── nom-dialog.component.ts
    │       ├── nom-dialog.component.html
    │       └── nom-dialog.component.scss
    ├── services/               # Services API
    │   └── nom.service.ts
    ├── models/                 # Interfaces TypeScript
    │   └── nom.model.ts
    └── components/             # Composants réutilisables
        └── nom-component/
```

---

## 🔄 Flux de Données

### Backend (NestJS)
```
Client HTTP Request
    ↓
Controller (@Get, @Post, etc.)
    ↓
Service (Logique métier)
    ↓
Prisma (Base de données)
    ↓
Response JSON
```

### Frontend (Angular)
```
User Action (Click, Form Submit)
    ↓
Component (TypeScript)
    ↓
Service (HTTP Client)
    ↓
Backend API
    ↓
Component Update (Template)
```

---

## 👥 Guide pour le Travail en Équipe

### 🎯 Attribution des Modules

Chaque développeur peut être assigné à un ou plusieurs modules :

**Exemple d'attribution** :
- **Développeur A** : `clients`, `fiches`, `client-management`
- **Développeur B** : `products`, `warehouses`, `stock-management`
- **Développeur C** : `factures`, `paiements`, `sales-control`
- **Développeur D** : `stats`, `reports`, `dashboard`

### 📝 Workflow Git Recommandé

1. **Créer une branche feature** :
   ```bash
   git checkout -b feature/nom-module-fonctionnalite
   ```

2. **Travailler sur votre module** :
   - Modifier uniquement les fichiers de votre module
   - Tester localement

3. **Commiter régulièrement** :
   ```bash
   git add .
   git commit -m "feat(nom-module): description du changement"
   ```

4. **Pousser et créer une PR** :
   ```bash
   git push origin feature/nom-module-fonctionnalite
   ```

5. **Code Review** par un autre membre

6. **Merge** après validation

### 🔒 Règles de Collaboration

✅ **À FAIRE** :
- Travailler uniquement dans votre module assigné
- Créer une branche pour chaque nouvelle fonctionnalité
- Écrire des commits descriptifs
- Tester avant de pousser
- Demander une code review

❌ **À ÉVITER** :
- Modifier des fichiers d'autres modules sans coordination
- Commiter directement sur `main`
- Mélanger plusieurs fonctionnalités dans un commit
- Pousser du code non testé

---

## 📖 Conventions de Nommage

### Commits
```
feat(module): ajouter nouvelle fonctionnalité
fix(module): corriger bug
refactor(module): refactoriser code
docs(module): mettre à jour documentation
style(module): formater code
test(module): ajouter tests
```

### Branches
```
feature/nom-module-fonctionnalite
fix/nom-module-bug
refactor/nom-module-amelioration
```

### Fichiers
- **Backend** : `kebab-case.ts` (ex: `sales-control.service.ts`)
- **Frontend** : `kebab-case.component.ts` (ex: `client-list.component.ts`)

---

## 🚀 Démarrage Rapide pour Nouveaux Développeurs

### 1. Cloner le projet
```bash
git clone https://github.com/achouika-net/optisass-angular.git
cd optisass-angular
```

### 2. Installer les dépendances
```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 3. Configurer la base de données
```bash
cd backend
npx prisma migrate dev
npx prisma generate
```

### 4. Lancer l'application
```bash
# Terminal 1 - Backend
cd backend
npm run start:dev

# Terminal 2 - Frontend
cd frontend
npm start
```

### 5. Accéder à l'application
- Frontend : http://localhost:4200
- Backend API : http://localhost:3000/api

---

## 📚 Ressources Utiles

- **Documentation NestJS** : https://docs.nestjs.com
- **Documentation Angular** : https://angular.io/docs
- **Documentation Prisma** : https://www.prisma.io/docs
- **Documentation Chart.js** : https://www.chartjs.org/docs

---

## 🆘 Support

Pour toute question :
1. Consulter cette documentation
2. Vérifier les issues GitHub
3. Demander sur le canal Slack/Teams de l'équipe
4. Contacter le lead technique

---

**Dernière mise à jour** : 25 décembre 2024  
**Version** : 1.0.0
