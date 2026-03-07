# Fichiers à valider - Stock Entry Feature

> ⚠️ **FICHIER TEMPORAIRE** - À supprimer après validation complète
> Date : 2026-01-20

---

## Résumé

| Type                   | Nombre |
| ---------------------- | ------ |
| Nouveaux fichiers (A)  | 42     |
| Fichiers modifiés (M)  | 25     |
| Fichiers supprimés (D) | 7      |
| Non suivis (??)        | 4      |

---

## 🆕 NOUVEAUX FICHIERS (à valider en priorité)

### Feature Stock-Entry (nouvelle feature)

```
src/app/features/stock/stock-entry/
├── components/
│   ├── bulk-action-conflict-dialog/
│   │   ├── bulk-action-conflict-dialog.component.html
│   │   └── bulk-action-conflict-dialog.component.ts
│   ├── ocr-upload-dialog/
│   │   ├── ocr-upload-dialog.component.html
│   │   └── ocr-upload-dialog.component.ts
│   ├── product-search-dialog/
│   │   ├── product-search-dialog.component.html
│   │   └── product-search-dialog.component.ts
│   ├── split-quantity-dialog/
│   │   ├── split-quantity-dialog.component.html
│   │   └── split-quantity-dialog.component.ts
│   ├── stock-entry/
│   │   ├── stock-entry.component.html
│   │   └── stock-entry.component.ts
│   ├── stock-entry-actions/
│   │   ├── stock-entry-actions.component.html
│   │   └── stock-entry-actions.component.ts
│   ├── stock-entry-form/
│   │   ├── stock-entry-form.component.html
│   │   └── stock-entry-form.component.ts
│   ├── stock-entry-row/
│   │   ├── stock-entry-row.component.html
│   │   └── stock-entry-row.component.ts
│   ├── stock-entry-table/
│   │   ├── stock-entry-table.component.html
│   │   └── stock-entry-table.component.ts
│   └── supplier-quick-create-dialog/
│       ├── supplier-quick-create-dialog.component.html
│       └── supplier-quick-create-dialog.component.ts
├── models/
│   ├── index.ts
│   ├── stock-entry-form.model.ts
│   └── stock-entry.model.ts
├── parsers/
│   └── supplier-invoice.parser.ts
├── services/
│   ├── index.ts
│   └── stock-entry.service.ts
├── stock-entry.routes.ts
└── stock-entry.store.ts
```

### Shared Components (nouveaux)

```
src/app/shared/components/
├── camera-capture-dialog/
│   ├── camera-capture-dialog.component.html
│   └── camera-capture-dialog.component.ts
└── product-autocomplete/
    ├── product-autocomplete.component.html
    └── product-autocomplete.component.ts
```

### Shared Models (nouveaux/déplacés)

```
src/app/shared/models/
├── device-capabilities.model.ts    # Nouveau
├── product-form.model.ts           # Déplacé depuis product/
├── product-request.model.ts        # Déplacé depuis product/
└── product-search.model.ts         # Déplacé depuis product/
```

### Shared Services (nouveaux/déplacés)

```
src/app/shared/services/
├── product.service.ts              # Déplacé depuis product/
└── product.service.mock.ts         # Déplacé depuis product/
```

### Core Services (nouveau)

```
src/app/core/services/
└── device-capabilities.service.ts
```

### Shared Data (nouveau - seed database)

```
src/app/shared/data/
├── index.ts
└── optical-database.seed.ts        # Base marques/modèles/fabricants
```

### Styles (nouveau)

```
src/assets/styles/material-overrides/
└── _mat-dialog.scss
```

### Documentation (nouveau)

```
docs/specs/
└── product-matching-architecture.spec.md
```

---

## ✏️ FICHIERS MODIFIÉS

### Configuration

| Fichier                               | Description        |
| ------------------------------------- | ------------------ |
| `src/app/app.config.ts`               | Providers globaux  |
| `src/app/config/app-routes.config.ts` | Routes stock-entry |
| `src/app/config/menu.config.ts`       | Menu stock-entry   |

### Core

| Fichier                                | Description                |
| -------------------------------------- | -------------------------- |
| `src/app/core/services/index.ts`       | Export device-capabilities |
| `src/app/core/store/resource.store.ts` | Ajout données partagées    |

### Feature Product (existante)

| Fichier                                                                                      | Description      |
| -------------------------------------------------------------------------------------------- | ---------------- |
| `product/components/product-search/product-search-form/product-search-form.component.ts`     | Adaptations      |
| `product/components/product-search/product-search-table/product-search-table.component.html` | Adaptations      |
| `product/components/product-search/product-search-table/product-search-table.component.ts`   | Adaptations      |
| `product/models/index.ts`                                                                    | Exports modifiés |
| `product/models/product-form.model.ts`                                                       | Adaptations      |
| `product/product.store.ts`                                                                   | Adaptations      |

### Feature Stock

| Fichier                                  | Description        |
| ---------------------------------------- | ------------------ |
| `src/app/features/stock/stock.routes.ts` | Import stock-entry |

### Shared

| Fichier                                                                        | Description                 |
| ------------------------------------------------------------------------------ | --------------------------- |
| `shared/components/index.ts`                                                   | Exports nouveaux composants |
| `shared/components/resource-autocomplete/resource-autocomplete.component.html` | Fix/amélioration            |
| `shared/models/index.ts`                                                       | Exports nouveaux models     |
| `shared/models/product.model.ts`                                               | Enrichissement interface    |
| `shared/models/supplier.model.ts`                                              | Enrichissement interface    |
| `shared/services/index.ts`                                                     | Exports nouveaux services   |
| `shared/services/resource.service.mock.ts`                                     | Données mock                |
| `shared/services/resource.service.ts`                                          | Adaptations                 |
| `shared/services/supplier.service.ts`                                          | Adaptations                 |

### Traductions

| Fichier                   | Description      |
| ------------------------- | ---------------- |
| `src/assets/i18n/en.json` | Clés stock-entry |
| `src/assets/i18n/fr.json` | Clés stock-entry |

### Styles

| Fichier                         | Description                |
| ------------------------------- | -------------------------- |
| `src/assets/styles/styles.scss` | Import mat-dialog override |

### Documentation

| Fichier                               | Description         |
| ------------------------------------- | ------------------- |
| `CLAUDE.md`                           | Mises à jour normes |
| `docs/specs/ocr-architecture.spec.md` | Mises à jour specs  |

---

## 🗑️ FICHIERS SUPPRIMÉS

> Ces fichiers ont été déplacés vers `shared/` ou supprimés car obsolètes

| Fichier                                                                             | Raison                            |
| ----------------------------------------------------------------------------------- | --------------------------------- |
| `features/stock/alimentation/alimentation.routes.ts`                                | Feature remplacée par stock-entry |
| `features/stock/alimentation/components/invoice-upload/invoice-upload.component.ts` | Remplacé par ocr-upload-dialog    |
| `features/stock/alimentation/parsers/supplier-invoice.parser.ts`                    | Déplacé vers stock-entry/parsers/ |
| `features/stock/product/models/product-request.model.ts`                            | Déplacé vers shared/models/       |
| `features/stock/product/models/product-search.model.ts`                             | Déplacé vers shared/models/       |
| `features/stock/product/services/product.service.ts`                                | Déplacé vers shared/services/     |
| `features/stock/product/services/product.service.mock.ts`                           | Déplacé vers shared/services/     |

---

## 📂 DOSSIERS NON SUIVIS (à vérifier)

| Dossier                                                               | Description                           |
| --------------------------------------------------------------------- | ------------------------------------- |
| `src/app/features/stock/stock-entry/components/supplier-diff-dialog/` | Dialog comparaison fournisseur (WIP?) |
| `src/app/features/stock/stock-entry/components/supplier-info-card/`   | Card info fournisseur (WIP?)          |
| `src/app/shared/data/`                                                | Base de données optique seed          |
| `docs/specs/product-matching-architecture.spec.md`                    | Spec product matching                 |

---

## ✅ Checklist de validation

- [ ] Vérifier les nouveaux composants stock-entry
- [ ] Vérifier les dialogs (OCR, product-search, split-quantity, etc.)
- [ ] Vérifier le store stock-entry.store.ts (signalState)
- [ ] Vérifier les models (stock-entry-form.model.ts, stock-entry.model.ts)
- [ ] Vérifier les fichiers déplacés vers shared/
- [ ] Vérifier les traductions (fr.json, en.json)
- [ ] Vérifier la base de données optique (optical-database.seed.ts)
- [ ] Vérifier les specs (product-matching-architecture.spec.md)
- [ ] Tester le build : `npm run build`
- [ ] Supprimer ce fichier après validation

---

## Commandes utiles

```bash
# Voir les modifications d'un fichier
git diff src/app/shared/models/product.model.ts

# Voir un nouveau fichier
cat src/app/features/stock/stock-entry/stock-entry.store.ts

# Build pour vérifier
npm run build
```
