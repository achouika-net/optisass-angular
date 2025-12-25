# 📚 OptiSaas Frontend - Architecture Angular

## 🎯 Vue d'ensemble

Application Angular standalone pour la gestion d'un centre optique. Architecture modulaire avec 12 modules fonctionnels indépendants.

---

## 🏗️ Structure du Projet

```
frontend/
├── src/
│   ├── app/
│   │   ├── features/        # 12 modules fonctionnels
│   │   ├── core/            # Services globaux
│   │   ├── shared/          # Composants partagés
│   │   └── config/          # Configuration
│   └── assets/              # Ressources statiques
```

---

## 📦 Modules Fonctionnels (12)

### 1. 🔐 authentication
**Chemin**: `src/app/features/authentication/`
**Responsable**: [À assigner]

**Composants**:
- `login.component` - Connexion utilisateur
- `register.component` - Inscription
- `forgot-password.component` - Récupération mot de passe

**Services**:
- `auth.service.ts` - Gestion authentification

**Routes**:
- `/login`
- `/register`
- `/forgot-password`

---

### 2. 🏢 centers
**Chemin**: `src/app/features/centers/`
**Responsable**: [À assigner]

**Composants**:
- `center-list.component` - Liste des centres
- `center-form-dialog.component` - Formulaire création/édition

**Services**:
- `centers.service.ts` - API centres

**Routes**:
- `/p/centers`

---

### 3. 👥 client-management
**Chemin**: `src/app/features/client-management/`
**Responsable**: [À assigner]

**Composants**:
- `client-list.component` - Liste clients
- `client-detail.component` - Détail client
- `lentilles-form.component` - Fiche lentilles
- `monture-form.component` - Fiche monture
- `facture-form.component` - Formulaire facture
- `payment-list.component` - Liste paiements

**Services**:
- `client.service.ts` - API clients
- `fiche.service.ts` - API fiches
- `facture.service.ts` - API factures
- `paiement.service.ts` - API paiements
- `loyalty.service.ts` - API fidélité

**Routes**:
- `/p/clients`
- `/p/clients/:id`
- `/p/fiches/lentilles/:id`
- `/p/fiches/monture/:id`

---

### 4. 📊 dashboard
**Chemin**: `src/app/features/dashboard/`
**Responsable**: [À assigner]

**Composants**:
- `dashboard.component` - Tableau de bord principal

**Routes**:
- `/p/dashboard`

---

### 5. 👤 groups
**Chemin**: `src/app/features/groups/`
**Responsable**: [À assigner]

**Composants**:
- `groups-list.component` - Liste groupes
- `group-detail.component` - Détail groupe
- `group-form-dialog.component` - Formulaire groupe

**Services**:
- `groups.service.ts` - API groupes

**Routes**:
- `/p/groups`
- `/p/groups/:id`

---

### 6. 📏 measurement
**Chemin**: `src/app/features/measurement/`
**Responsable**: [À assigner]

**Composants**:
- `camera-view.component` - Vue caméra
- `measurement-form.component` - Formulaire mesures
- `virtual-centering-modal.component` - Centrage virtuel

**Services**:
- `mediapipe-engine.service.ts` - Moteur IA mesures

**Routes**:
- `/p/measurement`

---

### 7. 📈 reports
**Chemin**: `src/app/features/reports/`
**Responsable**: [À assigner]

**Composants**:
- `sales-control-report.component` - Contrôle des ventes
- `advanced-stats.component` ⭐ - Statistiques avancées (Chart.js)

**Services**:
- `sales-control.service.ts` - API contrôle ventes
- `stats.service.ts` - API statistiques

**Routes**:
- `/p/sales-control`
- `/p/stats` ⭐ NOUVEAU

**Fonctionnalités Stats** :
- 6 graphiques interactifs (Chart.js)
- 4 cartes récapitulatives
- Filtres période et dates

---

### 8. ⚙️ settings
**Chemin**: `src/app/features/settings/`
**Responsable**: [À assigner]

**Composants**:
- `loyalty-config.component` - Configuration programme fidélité

**Services**:
- `loyalty.service.ts` - API configuration

**Routes**:
- `/p/settings/loyalty`

---

### 9. 📦 stock-management
**Chemin**: `src/app/features/stock-management/`
**Responsable**: [À assigner]

**Composants**:
- `product-list.component` - Liste produits
- `product-form.component` - Formulaire produit
- `stock-transfer-dialog.component` - Transfert stock
- `stock-search-dialog.component` - Recherche stock

**Services**:
- `product.service.ts` - API produits
- `stock-movement.service.ts` - API mouvements

**Routes**:
- `/p/stock`
- `/p/stock/product/:id`

---

### 10. 👨‍💼 user-management
**Chemin**: `src/app/features/user-management/`
**Responsable**: [À assigner]

**Composants**:
- `user-list.component` - Liste utilisateurs
- `user-form.component` - Formulaire utilisateur

**Services**:
- `user.service.ts` - API utilisateurs

**Routes**:
- `/p/users`

---

### 11. 🏭 warehouses
**Chemin**: `src/app/features/warehouses/`
**Responsable**: [À assigner]

**Composants**:
- `warehouse-list.component` - Liste entrepôts
- `warehouse-detail.component` - Détail entrepôt
- `warehouse-form-dialog.component` - Formulaire entrepôt

**Services**:
- `warehouses.service.ts` - API entrepôts

**Routes**:
- `/p/warehouses`
- `/p/warehouses/:id`

---

### 12. 🎯 optisass-centering
**Chemin**: `src/app/optisass-centering/`
**Responsable**: [À assigner]

**Composants**:
- Module de centrage optique avec IA

---

## 📂 Structure Type d'un Module

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
```

---

## 🔄 Flux de Données

```
User Action (Click, Form)
    ↓
Component (TypeScript)
    ↓
Service (HTTP Client)
    ↓
Backend API
    ↓
Component Update
    ↓
Template Refresh
```

---

## 🛠️ Technologies

- **Framework**: Angular 21
- **UI**: Angular Material
- **Charts**: Chart.js 4.5.1
- **State**: NgRx Store
- **HTTP**: HttpClient
- **Routing**: Angular Router
- **Forms**: Reactive Forms

---

## 👥 Workflow Git

### 1. Créer une branche feature
```bash
git checkout -b feature/nom-module-fonctionnalite
```

### 2. Développer
- Modifier uniquement votre module
- Tester localement

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

# Lancer dev server
npm start

# Build production
npm run build

# Tests
npm test
```

**URL**: http://localhost:4200

---

## 📋 Conventions

### Commits
```
feat(module): nouvelle fonctionnalité
fix(module): correction bug
refactor(module): refactorisation
style(module): formatage
docs(module): documentation
```

### Fichiers
- `kebab-case.component.ts`
- `kebab-case.service.ts`
- `kebab-case.model.ts`

---

## 📚 Ressources

- **Angular Docs**: https://angular.io/docs
- **Material Design**: https://material.angular.io
- **Chart.js**: https://www.chartjs.org/docs

---

**Version**: 1.0.0  
**Dernière MAJ**: 25 décembre 2024
