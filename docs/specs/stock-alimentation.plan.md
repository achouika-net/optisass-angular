# Plan d'Implémentation - Stock Alimentation

> **Version:** 1.2
> **Date création:** 2026-01-14
> **Dernière mise à jour:** 2026-01-14
> **Statut:** En cours de validation

---

## Légende des statuts

| Statut | Signification          |
| ------ | ---------------------- |
| `[ ]`  | Non commencé           |
| `[~]`  | En cours               |
| `[V]`  | Validé (plan approuvé) |
| `[X]`  | Terminé (implémenté)   |
| `[S]`  | Skipped (ignoré)       |

---

## Phase 0 : Architecture OCR Globale

**Objectif :** Mettre en place l'infrastructure OCR réutilisable (interfaces partagées + implémentations)

**Référence :** `docs/specs/ocr-architecture.spec.md`

### 0.1 Interfaces partagées (`@optisaas/opti-saas-lib`)

> **Localisation :** `/Applications/MAMP/htdocs/Workspace/OPTI-SAAS/opti_saas_lib/src/shared/ocr/`

- [ ] Créer `ocr/index.ts` (barrel export)
- [ ] Créer `ocr/ocr.interfaces.ts`
  - `IOcrEngine` - Interface du moteur OCR
  - `IOcrOptions` - Options de traitement
  - `IOcrResult` - Résultat brut OCR
  - `IOcrConfig` - Configuration globale
- [ ] Créer `ocr/ocr.models.ts`
  - `IOcrBoundingBox` - Coordonnées texte
  - `IOcrWord` - Mot avec confiance
  - `IOcrLine` - Ligne de texte
  - `IOcrBlock` - Bloc de texte
- [ ] Créer `ocr/document-parser.interfaces.ts`
  - `IDocumentParser<T>` - Interface parser générique
  - `IParseResult<T>` - Résultat parsing avec confiance
  - `IFieldConfidence` - Confiance par champ
- [ ] Mettre à jour `shared/index.ts` pour exporter `ocr`
- [ ] Build lib : `npm run build`
- [ ] Publier/mettre à jour dans projets : `npm link` ou version bump

### 0.2 Providers Frontend (`frontend/src/app/core/ocr/`)

- [ ] Installer `tesseract.js` (`npm install tesseract.js`)
- [ ] Créer `providers/tesseract.provider.ts`
  - Implémente `IOcrEngine`
  - Worker loading, preprocessing, traitement
- [ ] Créer `providers/backend-ocr.provider.ts`
  - Implémente `IOcrEngine`
  - Délègue à l'API backend via HTTP

### 0.3 Service et intégration Frontend

- [ ] Créer `ocr.config.ts` - Tokens d'injection + config
- [ ] Créer `ocr.service.ts` - Service façade
- [ ] Créer `ocr.providers.ts` - `provideOcr()` function
- [ ] Créer `index.ts` - Barrel exports
- [ ] Intégrer `provideOcr()` dans `app.config.ts`
- [ ] Ajouter config OCR dans `environment.ts` et `environment.development.ts`

### 0.4 Tests (optionnel - Phase 10)

- [ ] Tests unitaires providers (reporter si non prioritaire)
- [ ] Tests unitaires service

**Décisions prises :**

- ✅ Interfaces dans `opti_saas_lib` pour partage front/back
- ✅ Providers : Tesseract + Backend uniquement (pas OpenAI/Google pour l'instant)
- ⏳ Tests : À valider si Phase 0 ou Phase 10

---

## Phase 1 : Configuration et Routes

**Objectif :** Préparer l'infrastructure de base

### 1.1 Routes et Navigation

- [ ] Ajouter routes dans `app-routes.config.ts`
  - `'stock/entry': []`
  - `'stock/entry/add': []`
- [ ] Créer `stock-entry.routes.ts`
- [ ] Ajouter entrée menu dans `menu.config.ts` (sous Stock)
- [ ] Ajouter traductions navigation dans `fr.json` et `en.json`

### 1.2 Structure dossiers

- [ ] Créer arborescence `features/stock/stock-entry/`
  ```
  stock-entry/
  ├── components/
  ├── services/
  ├── models/
  ├── stock-entry.store.ts
  └── stock-entry.routes.ts
  ```

**Questions à valider :**

1. Le menu "Alimentation Stock" doit-il être sous "Stock" ou au même niveau ?
2. Icône à utiliser pour le menu ?

---

## Phase 2 : Modèles de données

**Objectif :** Définir les interfaces TypeScript

### 2.1 Modèles principaux

- [ ] Créer `stock-entry.model.ts`
  - `IStockEntryPayload`
  - `IStockEntryProduct`
  - `IWarehouseAllocation`
  - `ISupplierQuickCreate`

### 2.2 Modèles UI

- [ ] Créer `stock-entry-form.model.ts`
  - `IStockEntryFormState`
  - `IStockEntryProductRow`
  - Fonctions helper (`getDefaultFormState`, `toPayload`)

**Questions à valider :**

1. Faut-il un modèle séparé pour la réponse backend ou réutiliser les existants ?

---

## Phase 3 : Service API

**Objectif :** Créer le service HTTP

### 3.1 StockEntryService

- [ ] Créer `stock-entry.service.ts`
  - `createEntry(payload: IStockEntryPayload): Observable<void>`
  - `searchProductByDesignation(designation: string): Observable<Product | null>`
  - `searchProducts(params: IProductSearchParams): Observable<Product[]>`
  - `createSupplierQuick(data: ISupplierQuickCreate): Observable<ISupplier>`

**Questions à valider :**

1. Le backend est-il prêt pour ces endpoints ou faut-il des mocks ?

---

## Phase 4 : Signal Store

**Objectif :** State management

### 4.1 StockEntryStore

- [ ] Créer `stock-entry.store.ts`
  - State initial (form, products, UI state)
  - Actions : `addProduct`, `removeProduct`, `updateProduct`, `setSupplier`
  - Actions split : `splitProduct`, `updateAllocation`
  - Actions groupées : `applyBulkWarehouse`, `applyBulkTva`
  - Action validation : `submitEntry`
  - Computed : `isFormValid`, `incompleteProducts`, `totalProducts`

**Questions à valider :**

1. Gérer l'état OCR dans ce store ou store séparé ?

---

## Phase 5 : Composants UI - Structure de base

**Objectif :** Composants principaux sans logique complexe

### 5.1 Container principal

- [ ] Créer `stock-entry.component.ts` (page container)

### 5.2 Formulaire document

- [ ] Créer `stock-entry-form.component.ts`
  - Autocomplete fournisseur (réutiliser `resource-autocomplete`)
  - Type document (radio)
  - Numéro et date
  - Bouton création fournisseur

### 5.3 Zone d'import

- [ ] Créer zone avec boutons "Scanner" et "Rechercher"
  - Scanner : upload image (Phase 8 - OCR)
  - Rechercher : ouvre dialog recherche

### 5.4 Actions groupées

- [ ] Créer section actions groupées
  - Compteur sélection
  - Select entrepôt
  - Select TVA
  - Bouton appliquer

**Questions à valider :**

1. Utiliser des composants séparés ou tout dans le container ?

---

## Phase 6 : Tableau produits

**Objectif :** Tableau avec expandable rows

### 6.1 Tableau principal

- [ ] Créer `stock-entry-table.component.ts`
  - Mat-table avec colonnes définies
  - Checkbox sélection multiple
  - Colonnes éditables (quantité, prix)
  - Menu actions par ligne

### 6.2 Row expandable

- [ ] Implémenter expansion panel dans les rows
  - Animation expand/collapse
  - Auto-expand si incomplet

### 6.3 Formulaire rapide produit

- [ ] Créer `product-quick-form.component.ts`
  - Champs dynamiques selon type produit
  - Validation en temps réel
  - Intégré dans row expandable

**Questions à valider :**

1. Utiliser `mat-table` avec `multiTemplateDataRows` ou custom implementation ?

---

## Phase 7 : Dialogs

**Objectif :** Dialogs pour fonctionnalités avancées

### 7.1 Recherche produit

- [ ] Créer `product-search-dialog.component.ts`
  - Champs recherche selon type
  - Liste résultats
  - Bouton "Créer" si non trouvé

### 7.2 Split quantité

- [ ] Créer `warehouse-split-dialog.component.ts`
  - Liste entrepôts avec quantités
  - Validation somme = total
  - Ajout/suppression entrepôt

### 7.3 Conflit actions groupées

- [ ] Créer `bulk-action-conflict-dialog.component.ts`
  - Affichage produits en conflit
  - Options : Écraser / Exclure / Annuler

**Questions à valider :**

1. Dialog recherche : pleine page ou modal ?

---

## Phase 8 : Intégration OCR

**Objectif :** Scanner et parser factures

**Prérequis :** Architecture OCR globale implémentée (voir `ocr-architecture.spec.md`)

### 8.1 InvoiceParserService

- [ ] Créer `invoice-parser.service.ts`
  - Extends `DocumentParser<IStockEntryProduct[]>`
  - Méthode `extractData` pour parser texte facture
  - Méthode `validate` pour valider résultats

### 8.2 Intégration UI

- [ ] Upload image
- [ ] Progress indicator
- [ ] Mapping résultats → tableau
- [ ] Indicateurs confiance

**Questions à valider :**

1. Implémenter OCR global d'abord ou en parallèle ?

---

## Phase 9 : Validation et Soumission

**Objectif :** Validation complète et envoi backend

### 9.1 Validation front-end

- [ ] Validation document (fournisseur, numéro, date)
- [ ] Validation produits (quantité, prix, entrepôt)
- [ ] Validation nouveaux produits (champs obligatoires selon type)
- [ ] Highlight erreurs + expand rows incomplètes

### 9.2 Soumission

- [ ] Transformation form state → payload API
- [ ] Appel backend
- [ ] Gestion succès (toast + reset form)
- [ ] Gestion erreurs (toast + conserver données)

**Questions à valider :**

1. Validation synchrone ou avec appel backend pour doublons ?

---

## Phase 10 : Tests et Finitions

**Objectif :** Qualité et polish

### 10.1 Tests

- [ ] Tests unitaires composants
- [ ] Tests store
- [ ] Tests service

### 10.2 UX/UI

- [ ] Responsive design
- [ ] Accessibilité
- [ ] Traductions complètes
- [ ] Loading states

---

## Historique des validations

| Phase    | Date validation | Notes      |
| -------- | --------------- | ---------- |
| Phase 0  | -               | En attente |
| Phase 1  | -               | En attente |
| Phase 2  | -               | En attente |
| Phase 3  | -               | En attente |
| Phase 4  | -               | En attente |
| Phase 5  | -               | En attente |
| Phase 6  | -               | En attente |
| Phase 7  | -               | En attente |
| Phase 8  | -               | En attente |
| Phase 9  | -               | En attente |
| Phase 10 | -               | En attente |

---

## Notes de session

### Session 2026-01-14

- Création du plan initial
- Ajout Phase 0 (OCR global) avant les phases feature
- Mise à jour spec OCR avec BackendOcrProvider et architecture NestJS
- Analyse structure `opti_saas_lib` existante :
  - Package : `@optisaas/opti-saas-lib` v0.1.6
  - Build : tsup (CJS + ESM + types)
  - Structure : `shared/` (front+back), `client/` (front), `backoffice/` (back)
  - Contenu actuel : système d'autorisation (resources, permissions)
- Décision : Interfaces OCR dans `shared/ocr/` de la lib
- Plan mis à jour v1.2 avec localisation précise des fichiers
- **En attente validation Phase 0** avant implémentation

---
