# Module Gestion Stock - Spécifications

> **Pour reprendre le développement :** "Lis le fichier `docs/STOCK-MODULE-SPEC.md` et continue le développement du module stock depuis l'étape en cours."

---

## État d'avancement

| Info                     | Valeur                                                             |
| ------------------------ | ------------------------------------------------------------------ |
| **Étape courante**       | 3/7 - Ressources (ResourceService, ResourceStore, SupplierService) |
| **Statut**               | En attente du "go"                                                 |
| **Dernière mise à jour** | 2026-01-04                                                         |

### Plan de développement

- [x] **Étape 1** : Structure, Routes & Intégration
- [x] **Étape 2** : Models & Config
- [ ] **Étape 3** : Ressources (ResourceService, ResourceStore, SupplierService)
- [ ] **Étape 4** : Service & Store Produit
- [ ] **Étape 5** : Page Recherche
- [ ] **Étape 6** : Formulaire & Création
- [ ] **Étape 7** : Consultation & Modification

---

## 1. Scope V1

### Inclus

- Recherche/Liste produits avec filtres
- Création produit (4 types : Monture, Verre, Lentille, Accessoire)
- Modification produit
- Consultation produit
- Alertes péremption (lentilles)
- Mock API (backend non implémenté)

### Exclus (V1)

- Transferts inter-entrepôts
- Mouvements stock (entrée/sortie)
- Opérations bulk
- Hiérarchie Groupe (juste Centre courant + Entrepôt)

---

## 2. Décisions validées

| #   | Sujet                   | Décision                                                      |
| --- | ----------------------- | ------------------------------------------------------------- |
| 1   | Alertes péremption      | 2 paliers globaux : Warning (30j), Critical (7j)              |
| 2   | Architecture formulaire | FieldTree pattern (`*-fields`)                                |
| 3   | Calculs prix            | Helpers sans stockage (calculé à la volée)                    |
| 4   | Génération codes        | Backend (codeInterne, codeBarres)                             |
| 5   | Photos                  | Hybride Base64/URL, 2MB max, JPG/PNG/WebP                     |
| 6   | Entrepôt                | `AuthStore.currentTenant` + `WarehouseService` existant       |
| 7   | Statut                  | Automatique selon quantité (DISPONIBLE/RUPTURE)               |
| 8   | Valeurs défaut          | Configurables par produit (seuil=2, TVA=20%, coef=2.5, min=1) |
| 9   | Mode consultation       | Même formulaire en mode readonly                              |
| 10  | Quantité initiale       | Saisie manuelle en création                                   |
| 11  | Fournisseur principal   | Texte libre V1 (référence module futur)                       |
| 12  | Famille/Sous-famille    | Implémenté avec UI, autocomplete, ajout libre                 |

---

## 3. Architecture Ressources

### ResourceStore (chargé au démarrage - APP_INITIALIZER)

#### Groupe 1 : Type unifié `Resource`

```typescript
interface Resource {
  id: string;
  code: string;
  label: string;
  order?: number;
  active?: boolean;
}
```

| Ressource           | Autocomplete | Ajout libre |
| ------------------- | ------------ | ----------- |
| productTypes        | Oui          | Non (figé)  |
| productStatuses     | Oui          | Non (figé)  |
| frameCategories     | Oui          | Non (figé)  |
| genders             | Oui          | Non (figé)  |
| frameShapes         | Oui          | Non (figé)  |
| frameMaterials      | Oui          | Non (figé)  |
| frameTypes          | Oui          | Non (figé)  |
| hingeTypes          | Oui          | Non (figé)  |
| lensTypes           | Oui          | Non (figé)  |
| lensMaterials       | Oui          | Non (figé)  |
| lensTints           | Oui          | Non (figé)  |
| lensFilters         | Oui          | Non (figé)  |
| lensTreatments      | Oui          | Non (figé)  |
| lensIndices         | Oui          | Non (figé)  |
| contactLensTypes    | Oui          | Non (figé)  |
| contactLensUsages   | Oui          | Non (figé)  |
| accessoryCategories | Oui          | Non (figé)  |
| familles            | Oui          | Oui         |
| sousFamilles        | Oui          | Oui         |
| couleurs            | Oui          | Oui         |

#### Groupe 2 : Types spécifiques (avec metadata)

| Ressource    | Chargement           | Ajout libre |
| ------------ | -------------------- | ----------- |
| marques      | Autocomplete backend | Oui         |
| modeles      | Autocomplete backend | Oui         |
| fabricants   | Au démarrage         | Non (figé)  |
| laboratoires | Au démarrage         | Non (figé)  |

#### Groupe 3 : Services existants

| Ressource    | Service                          | Source   |
| ------------ | -------------------------------- | -------- |
| Centres      | `AuthStore.currentTenant`        | Existant |
| Entrepôts    | `WarehouseService`               | Existant |
| Fournisseurs | `SupplierService` (nouveau mock) | À créer  |

---

## 4. Organisation fichiers

```
shared/models/
├── resource.model.ts           # Interface Resource
├── marque.model.ts             # Interface Marque
├── modele.model.ts             # Interface Modele
├── fabricant.model.ts          # Interface Fabricant
├── laboratoire.model.ts        # Interface Laboratoire
├── product.model.ts            # BaseProduct, Frame, Lens, ContactLens, Accessory, Product
└── index.ts

features/stock/
├── models/
│   ├── product-request.model.ts   # ProductCreateRequest, ProductUpdateRequest
│   ├── product-search.model.ts    # ProductSearchRequest, ProductSearchResponse
│   └── index.ts
├── services/
│   └── product.service.ts         # providedIn: 'root'
├── mocks/
│   └── product.mock.ts
├── store/
│   └── product.store.ts
├── components/
│   ├── product-search/
│   ├── product-form/
│   │   ├── base-product-fields/
│   │   ├── frame-fields/
│   │   ├── lens-fields/
│   │   ├── contact-lens-fields/
│   │   └── accessory-fields/
│   ├── product-add/
│   └── product-view/
└── stock.routes.ts
```

---

## 5. Models

### 5.1 Product (Response) - Discriminated Union

```typescript
interface BaseProduct {
  id?: string;
  codeInterne?: string;
  codeBarres?: string;
  typeArticle: string;
  designation: string;
  marqueId?: string;
  modeleId?: string;
  couleur?: string;
  referenceFournisseur?: string;
  familleId?: string;
  sousFamilleId?: string;
  fournisseurPrincipal?: string;
  quantiteActuelle: number;
  seuilAlerte: number;
  prixAchatHT: number;
  coefficient: number;
  tauxTVA: number;
  photo?: ProductPhoto;
  entrepotId: string;
  statut?: string;
  dateCreation?: Date;
  dateModification?: Date;
}

interface ProductPhoto {
  type: 'base64' | 'url';
  value: string;
}

interface Frame extends BaseProduct {
  typeArticle: 'monture';
  categorie: string;
  genre?: string;
  forme: string;
  matiere: string;
  typeMonture: string;
  typeCharniere?: string;
  calibre: number;
  pont: number;
  branche: number;
  couleurMonture?: string;
  couleurBranches?: string;
  photoFace?: ProductPhoto;
  photoProfil?: ProductPhoto;
}

interface Lens extends BaseProduct {
  typeArticle: 'verre';
  typeVerre: string;
  materiau: string;
  indiceRefraction?: string;
  teinte?: string;
  filtres?: string[];
  traitements?: string[];
  puissanceSph?: number;
  puissanceCyl?: number;
  axe?: number;
  addition?: number;
  diametre?: number;
  base?: number;
  courbure?: number;
  fabricantId?: string;
  familleOptique?: string;
}

interface ContactLens extends BaseProduct {
  typeArticle: 'lentille';
  typeLentille: string;
  usage: string;
  laboratoireId?: string;
  modeleCommercial?: string;
  puissanceSph?: number;
  cylindre?: number;
  axe?: number;
  addition?: number;
  rayonCourbure: number;
  diametre: number;
  nombreParBoite: number;
  prixParBoite: number;
  prixParUnite: number;
  numeroLot?: string;
  datePeremption?: Date;
  quantiteBoites?: number;
  quantiteUnites?: number;
}

interface Accessory extends BaseProduct {
  typeArticle: 'accessoire';
  categorie: string;
  sousCategorie?: string;
}

type Product = Frame | Lens | ContactLens | Accessory;
```

### 5.2 Request (Discriminated Union)

```typescript
interface BaseProductRequest {
  designation: string;
  marqueId?: string;
  modeleId?: string;
  couleur?: string;
  referenceFournisseur?: string;
  familleId?: string;
  sousFamilleId?: string;
  fournisseurPrincipal?: string;
  quantiteActuelle: number;
  seuilAlerte: number;
  prixAchatHT: number;
  coefficient: number;
  tauxTVA: number;
  photo?: ProductPhoto;
  entrepotId: string;
}

interface FrameCreateRequest extends BaseProductRequest {
  typeArticle: 'monture';
  categorie: string;
  forme: string;
  matiere: string;
  calibre: number;
  pont: number;
  branche: number;
  typeMonture: string;
  genre?: string;
  typeCharniere?: string;
  couleurMonture?: string;
  couleurBranches?: string;
  photoFace?: ProductPhoto;
  photoProfil?: ProductPhoto;
}

interface LensCreateRequest extends BaseProductRequest {
  typeArticle: 'verre';
  typeVerre: string;
  materiau: string;
  indiceRefraction?: string;
  teinte?: string;
  filtres?: string[];
  traitements?: string[];
  puissanceSph?: number;
  puissanceCyl?: number;
  axe?: number;
  addition?: number;
  diametre?: number;
  base?: number;
  courbure?: number;
  fabricantId?: string;
  familleOptique?: string;
}

interface ContactLensCreateRequest extends BaseProductRequest {
  typeArticle: 'lentille';
  typeLentille: string;
  usage: string;
  rayonCourbure: number;
  diametre: number;
  nombreParBoite: number;
  prixParBoite: number;
  prixParUnite: number;
  laboratoireId?: string;
  modeleCommercial?: string;
  puissanceSph?: number;
  cylindre?: number;
  axe?: number;
  addition?: number;
  numeroLot?: string;
  datePeremption?: Date;
  quantiteBoites?: number;
  quantiteUnites?: number;
}

interface AccessoryCreateRequest extends BaseProductRequest {
  typeArticle: 'accessoire';
  categorie: string;
  sousCategorie?: string;
}

type ProductCreateRequest =
  | FrameCreateRequest
  | LensCreateRequest
  | ContactLensCreateRequest
  | AccessoryCreateRequest;

type ProductUpdateRequest = Partial<ProductCreateRequest> & { id: string };
```

### 5.3 Search Request/Response

```typescript
interface ProductSearchRequest {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
  typeArticle?: string;
  entrepotId?: string;
  statut?: string;
  marqueId?: string;
  familleId?: string;
  sousFamilleId?: string;
  stockMin?: number;
  stockMax?: number;
  prixMin?: number;
  prixMax?: number;
  stockBas?: boolean;
  rupture?: boolean;
  peremptionProche?: boolean;
}

interface ProductSearchResponse {
  data: Product[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
```

---

## 6. Helpers & Config

### stock.config.ts

```typescript
export const STOCK_DEFAULTS = {
  SEUIL_ALERTE: 2,
  TAUX_TVA: 0.2,
  COEFFICIENT: 2.5,
  COEFFICIENT_MIN: 1,
};

export const PEREMPTION_WARNING_DAYS = 30;
export const PEREMPTION_CRITICAL_DAYS = 7;
```

### product.helper.ts

```typescript
export const calculatePrixVenteHT = (prixAchatHT: number, coefficient: number): number =>
  Math.round(prixAchatHT * coefficient * 100) / 100;

export const calculatePrixVenteTTC = (prixVenteHT: number, tauxTVA: number): number =>
  Math.round(prixVenteHT * (1 + tauxTVA) * 100) / 100;

export const calculateStatut = (quantite: number): ProductStatus =>
  quantite === 0 ? 'RUPTURE' : 'DISPONIBLE';
```

---

## 7. Règles métier

### 7.1 Calculs de prix

#### Prix de vente HT

```
prixVenteHT = prixAchatHT × coefficient
```

- Arrondi à 2 décimales : `Math.round(prixAchatHT * coefficient * 100) / 100`
- Coefficient minimum : 1.0 (pas de vente à perte)
- Coefficient par défaut : 2.5

#### Prix de vente TTC

```
prixVenteTTC = prixVenteHT × (1 + tauxTVA)
```

- TVA par défaut : 20% (0.20)
- Arrondi à 2 décimales : `Math.round(prixVenteHT * (1 + tauxTVA) * 100) / 100`

#### Prix moyen pondéré (pour V2 - mouvements stock)

```
nouveauPrixMoyen = (stockActuel × ancienPrix + nouvelleQté × nouveauPrix) / (stockActuel + nouvelleQté)
```

### 7.2 Gestion des statuts

| Condition                | Statut       |
| ------------------------ | ------------ |
| `quantiteActuelle === 0` | `RUPTURE`    |
| `quantiteActuelle > 0`   | `DISPONIBLE` |

**Note :** Le statut est calculé automatiquement, pas de sélection manuelle.

### 7.3 Alertes stock

| Type      | Condition                     | Affichage |
| --------- | ----------------------------- | --------- |
| Stock OK  | `quantité > seuilAlerte`      | Vert      |
| Stock bas | `0 < quantité <= seuilAlerte` | Orange    |
| Rupture   | `quantité === 0`              | Rouge     |

Seuil alerte par défaut : 2 unités

### 7.4 Alertes péremption (Lentilles uniquement)

| Palier   | Condition                            | Affichage |
| -------- | ------------------------------------ | --------- |
| OK       | `datePeremption > aujourd'hui + 30j` | Normal    |
| Warning  | `7j < datePeremption <= 30j`         | Orange    |
| Critical | `datePeremption <= 7j`               | Rouge     |

### 7.5 Génération des codes (Backend)

#### Code interne

Format : `{PREFIX}{4 chiffres aléatoires}`

| Type produit | Préfixe |
| ------------ | ------- |
| Monture      | `MON`   |
| Verre        | `VER`   |
| Lentille     | `LEN`   |
| Accessoire   | `ACC`   |

Exemple : `MON1234`, `VER0567`

#### Code-barres

Format : EAN-13 `200{9 chiffres aléatoires}{checksum}`

- Préfixe fixe : `200`
- Checksum calculé selon algorithme EAN-13

### 7.6 Validations par type de produit

#### Monture (Frame) - Champs obligatoires

| Champ       | Obligatoire | Min |
| ----------- | ----------- | --- |
| designation | ✅          | -   |
| categorie   | ✅          | -   |
| forme       | ✅          | -   |
| matiere     | ✅          | -   |
| calibre     | ✅          | 1   |
| pont        | ✅          | 1   |
| branche     | ✅          | 1   |
| typeMonture | ✅          | -   |

#### Verre (Lens) - Champs obligatoires

| Champ       | Obligatoire | Notes                 |
| ----------- | ----------- | --------------------- |
| typeVerre   | ✅          | -                     |
| materiau    | ✅          | -                     |
| designation | ❌          | Peut être auto-généré |

#### Lentille (ContactLens) - Champs obligatoires

| Champ          | Obligatoire | Notes                 |
| -------------- | ----------- | --------------------- |
| typeLentille   | ✅          | -                     |
| usage          | ✅          | -                     |
| rayonCourbure  | ✅          | -                     |
| diametre       | ✅          | -                     |
| nombreParBoite | ✅          | -                     |
| prixParBoite   | ✅          | -                     |
| prixParUnite   | ✅          | -                     |
| designation    | ❌          | Peut être auto-généré |

#### Accessoire - Champs obligatoires

| Champ       | Obligatoire |
| ----------- | ----------- |
| designation | ✅          |
| categorie   | ✅          |

#### Champs communs (tous types)

| Champ            | Obligatoire | Min | Défaut |
| ---------------- | ----------- | --- | ------ |
| typeArticle      | ✅          | -   | -      |
| entrepotId       | ✅          | -   | -      |
| prixAchatHT      | ✅          | 0   | -      |
| coefficient      | ✅          | 1   | 2.5    |
| tauxTVA          | ✅          | 0   | 0.20   |
| quantiteActuelle | ✅          | 0   | 0      |
| seuilAlerte      | ✅          | 0   | 2      |

### 7.7 Photos produits

| Aspect            | Règle                   |
| ----------------- | ----------------------- |
| Formats acceptés  | JPG, PNG, WebP          |
| Taille max        | 2 MB                    |
| Stockage          | Hybride (Base64 ou URL) |
| Photo générique   | Tous types              |
| Photo Face/Profil | Montures uniquement     |

---

## 8. Données Mock (Ressources)

### 8.1 Types de produit (productTypes)

```typescript
[
  { id: '1', code: 'monture', label: 'Monture' },
  { id: '2', code: 'verre', label: 'Verre' },
  { id: '3', code: 'lentille', label: 'Lentille' },
  { id: '4', code: 'accessoire', label: 'Accessoire' },
];
```

### 8.2 Statuts produit (productStatuses)

```typescript
[
  { id: '1', code: 'DISPONIBLE', label: 'Disponible' },
  { id: '2', code: 'RESERVE', label: 'Réservé' },
  { id: '3', code: 'EN_COMMANDE', label: 'En commande' },
  { id: '4', code: 'EN_TRANSIT', label: 'En transit' },
  { id: '5', code: 'RUPTURE', label: 'Rupture' },
  { id: '6', code: 'OBSOLETE', label: 'Obsolète' },
];
```

### 8.3 Catégories monture (frameCategories)

```typescript
[
  { id: '1', code: 'optique', label: 'Optique' },
  { id: '2', code: 'solaire', label: 'Solaire' },
];
```

### 8.4 Genres (genders)

```typescript
[
  { id: '1', code: 'homme', label: 'Homme' },
  { id: '2', code: 'femme', label: 'Femme' },
  { id: '3', code: 'enfant', label: 'Enfant' },
  { id: '4', code: 'mixte', label: 'Mixte' },
];
```

### 8.5 Formes monture (frameShapes)

```typescript
[
  { id: '1', code: 'ronde', label: 'Ronde' },
  { id: '2', code: 'carree', label: 'Carrée' },
  { id: '3', code: 'rectangulaire', label: 'Rectangulaire' },
  { id: '4', code: 'papillon', label: 'Papillon' },
  { id: '5', code: 'aviateur', label: 'Aviateur' },
  { id: '6', code: 'ovale', label: 'Ovale' },
  { id: '7', code: 'autre', label: 'Autre' },
];
```

### 8.6 Matières monture (frameMaterials)

```typescript
[
  { id: '1', code: 'acetate', label: 'Acétate' },
  { id: '2', code: 'metal', label: 'Métal' },
  { id: '3', code: 'titane', label: 'Titane' },
  { id: '4', code: 'mixte', label: 'Mixte' },
  { id: '5', code: 'plastique', label: 'Plastique' },
  { id: '6', code: 'autre', label: 'Autre' },
];
```

### 8.7 Types monture (frameTypes)

```typescript
[
  { id: '1', code: 'cerclee', label: 'Cerclée' },
  { id: '2', code: 'nylor', label: 'Nylor' },
  { id: '3', code: 'percee', label: 'Percée' },
];
```

### 8.8 Types charnière (hingeTypes)

```typescript
[
  { id: '1', code: 'standard', label: 'Standard' },
  { id: '2', code: 'flex', label: 'Flex' },
  { id: '3', code: 'ressort', label: 'Ressort' },
];
```

### 8.9 Types de verre (lensTypes)

```typescript
[
  { id: '1', code: 'unifocal', label: 'Unifocal' },
  { id: '2', code: 'progressif', label: 'Progressif' },
  { id: '3', code: 'degressif', label: 'Dégressif' },
  { id: '4', code: 'bifocal', label: 'Bifocal' },
  { id: '5', code: 'trifocal', label: 'Trifocal' },
  { id: '6', code: 'mi_distance', label: 'Mi-distance' },
  { id: '7', code: 'bureau', label: 'Bureau' },
  { id: '8', code: 'sport', label: 'Sport' },
];
```

### 8.10 Matériaux verre (lensMaterials)

```typescript
[
  { id: '1', code: 'organique', label: 'Organique' },
  { id: '2', code: 'polycarbonate', label: 'Polycarbonate' },
  { id: '3', code: 'mineral', label: 'Minéral' },
  { id: '4', code: 'trivex', label: 'Trivex' },
  { id: '5', code: 'haut_indice', label: 'Haut indice' },
  { id: '6', code: 'cr39', label: 'CR-39' },
];
```

### 8.11 Teintes verre (lensTints)

```typescript
[
  { id: '1', code: 'blanc', label: 'Blanc' },
  { id: '2', code: 'photochromique', label: 'Photochromique' },
  { id: '3', code: 'solaire', label: 'Solaire' },
  { id: '4', code: 'polarisant', label: 'Polarisant' },
  { id: '5', code: 'autre', label: 'Autre' },
];
```

### 8.12 Filtres verre (lensFilters)

```typescript
[
  { id: '1', code: 'filtre_bleu', label: 'Filtre lumière bleue' },
  { id: '2', code: 'uv', label: 'UV' },
];
```

### 8.13 Traitements verre (lensTreatments)

```typescript
[
  { id: '1', code: 'antireflet', label: 'Antireflet' },
  { id: '2', code: 'durci', label: 'Durci' },
  { id: '3', code: 'hydrophobe', label: 'Hydrophobe' },
  { id: '4', code: 'oleophobe', label: 'Oléophobe' },
  { id: '5', code: 'uv', label: 'UV' },
  { id: '6', code: 'anti_rayure', label: 'Anti-rayure' },
  { id: '7', code: 'filtre_lumiere_bleue', label: 'Filtre lumière bleue' },
  { id: '8', code: 'anti_buee', label: 'Anti-buée' },
  { id: '9', code: 'anti_salissure', label: 'Anti-salissure' },
  { id: '10', code: 'super_hydrophobe', label: 'Super hydrophobe' },
];
```

### 8.14 Indices de réfraction (lensIndices)

```typescript
[
  { id: '1', code: '1.5', label: '1.5' },
  { id: '2', code: '1.53', label: '1.53' },
  { id: '3', code: '1.56', label: '1.56' },
  { id: '4', code: '1.59', label: '1.59' },
  { id: '5', code: '1.6', label: '1.6' },
  { id: '6', code: '1.67', label: '1.67' },
  { id: '7', code: '1.74', label: '1.74' },
];
```

### 8.15 Types de lentille (contactLensTypes)

```typescript
[
  { id: '1', code: 'journaliere', label: 'Journalière' },
  { id: '2', code: 'bimensuelle', label: 'Bimensuelle' },
  { id: '3', code: 'mensuelle', label: 'Mensuelle' },
  { id: '4', code: 'annuelle', label: 'Annuelle' },
];
```

### 8.16 Usages lentille (contactLensUsages)

```typescript
[
  { id: '1', code: 'myopie', label: 'Myopie' },
  { id: '2', code: 'hypermetropie', label: 'Hypermétropie' },
  { id: '3', code: 'astigmatisme', label: 'Astigmatisme' },
  { id: '4', code: 'presbytie', label: 'Presbytie' },
  { id: '5', code: 'cosmetique', label: 'Cosmétique' },
];
```

### 8.17 Catégories accessoire (accessoryCategories)

```typescript
[
  { id: '1', code: 'etui', label: 'Étui' },
  { id: '2', code: 'chiffon', label: 'Chiffon' },
  { id: '3', code: 'cordon', label: 'Cordon' },
  { id: '4', code: 'visserie', label: 'Visserie' },
  { id: '5', code: 'entretien', label: 'Entretien' },
  { id: '6', code: 'presentation', label: 'Présentation' },
  { id: '7', code: 'autre', label: 'Autre' },
];
```

### 8.18 Marques (exemples mock)

```typescript
[
  { id: '1', code: 'rayban', label: 'Ray-Ban', logo: null, pays: 'Italie' },
  { id: '2', code: 'oakley', label: 'Oakley', logo: null, pays: 'USA' },
  { id: '3', code: 'gucci', label: 'Gucci', logo: null, pays: 'Italie' },
  { id: '4', code: 'dior', label: 'Dior', logo: null, pays: 'France' },
  { id: '5', code: 'prada', label: 'Prada', logo: null, pays: 'Italie' },
  { id: '6', code: 'chanel', label: 'Chanel', logo: null, pays: 'France' },
  { id: '7', code: 'tomford', label: 'Tom Ford', logo: null, pays: 'USA' },
  { id: '8', code: 'versace', label: 'Versace', logo: null, pays: 'Italie' },
];
```

### 8.19 Fabricants verre (exemples mock)

```typescript
[
  { id: '1', code: 'essilor', label: 'Essilor', pays: 'France', contact: null },
  { id: '2', code: 'zeiss', label: 'Zeiss', pays: 'Allemagne', contact: null },
  { id: '3', code: 'hoya', label: 'Hoya', pays: 'Japon', contact: null },
  { id: '4', code: 'rodenstock', label: 'Rodenstock', pays: 'Allemagne', contact: null },
  { id: '5', code: 'nikon', label: 'Nikon', pays: 'Japon', contact: null },
  { id: '6', code: 'bbgr', label: 'BBGR', pays: 'France', contact: null },
];
```

### 8.20 Laboratoires lentilles (exemples mock)

```typescript
[
  { id: '1', code: 'coopervision', label: 'CooperVision', pays: 'USA' },
  { id: '2', code: 'alcon', label: 'Alcon', pays: 'Suisse' },
  { id: '3', code: 'bausch', label: 'Bausch + Lomb', pays: 'USA' },
  { id: '4', code: 'johnson', label: 'Johnson & Johnson', pays: 'USA' },
  { id: '5', code: 'menicon', label: 'Menicon', pays: 'Japon' },
];
```

### 8.21 Familles (exemples mock)

```typescript
[
  { id: '1', code: 'luxe', label: 'Luxe' },
  { id: '2', code: 'sport', label: 'Sport' },
  { id: '3', code: 'classique', label: 'Classique' },
  { id: '4', code: 'enfant', label: 'Enfant' },
  { id: '5', code: 'economique', label: 'Économique' },
];
```

### 8.22 Sous-familles (exemples mock)

```typescript
[
  { id: '1', code: 'homme_luxe', label: 'Homme Luxe' },
  { id: '2', code: 'femme_luxe', label: 'Femme Luxe' },
  { id: '3', code: 'running', label: 'Running' },
  { id: '4', code: 'cyclisme', label: 'Cyclisme' },
  { id: '5', code: 'natation', label: 'Natation' },
];
```

### 8.23 Couleurs (exemples mock)

```typescript
[
  { id: '1', code: 'noir', label: 'Noir' },
  { id: '2', code: 'marron', label: 'Marron' },
  { id: '3', code: 'bleu', label: 'Bleu' },
  { id: '4', code: 'rouge', label: 'Rouge' },
  { id: '5', code: 'vert', label: 'Vert' },
  { id: '6', code: 'or', label: 'Or' },
  { id: '7', code: 'argent', label: 'Argent' },
  { id: '8', code: 'transparent', label: 'Transparent' },
  { id: '9', code: 'ecaille', label: 'Écaille' },
  { id: '10', code: 'rose', label: 'Rose' },
];
```

---

## 9. Colonnes tableau (product-list)

```typescript
[
  'select',
  'codeInterne',
  'designation',
  'marque',
  'typeArticle',
  'entrepot',
  'quantiteActuelle',
  'prixVenteTTC',
  'statut',
  'actions',
];
```

| Colonne          | Description                                 |
| ---------------- | ------------------------------------------- |
| select           | Checkbox pour opérations bulk (V2)          |
| codeInterne      | Code interne produit                        |
| designation      | Nom du produit                              |
| marque           | Marque                                      |
| typeArticle      | Type (Monture, Verre, Lentille, Accessoire) |
| entrepot         | Entrepôt de stockage                        |
| quantiteActuelle | Quantité en stock                           |
| prixVenteTTC     | Prix de vente TTC                           |
| statut           | Statut du produit                           |
| actions          | Menu actions (voir, modifier, supprimer)    |

---

## 10. Traductions (i18n)

Clés à ajouter dans `assets/i18n/fr.json` :

```json
{
  "stock": {
    "title": "Gestion Stock",
    "products": "Produits",
    "addProduct": "Ajouter un produit",
    "editProduct": "Modifier le produit",
    "viewProduct": "Détail du produit",
    "searchPlaceholder": "Rechercher un produit...",
    "noProducts": "Aucun produit trouvé",
    "filters": {
      "type": "Type de produit",
      "status": "Statut",
      "brand": "Marque",
      "warehouse": "Entrepôt"
    },
    "columns": {
      "code": "Code",
      "designation": "Désignation",
      "brand": "Marque",
      "type": "Type",
      "warehouse": "Entrepôt",
      "quantity": "Quantité",
      "price": "Prix TTC",
      "status": "Statut",
      "actions": "Actions"
    },
    "form": {
      "generalInfo": "Informations générales",
      "specificInfo": "Informations spécifiques",
      "pricing": "Prix et stock",
      "internalCode": "Code interne",
      "barcode": "Code-barres",
      "autoGenerated": "Généré automatiquement",
      "designation": "Désignation",
      "brand": "Marque",
      "model": "Modèle",
      "color": "Couleur",
      "family": "Famille",
      "subFamily": "Sous-famille",
      "supplier": "Fournisseur principal",
      "warehouse": "Entrepôt",
      "purchasePrice": "Prix d'achat HT",
      "coefficient": "Coefficient",
      "sellingPriceHT": "Prix de vente HT",
      "sellingPriceTTC": "Prix de vente TTC",
      "vat": "TVA",
      "quantity": "Quantité",
      "alertThreshold": "Seuil d'alerte"
    },
    "types": {
      "monture": "Monture",
      "verre": "Verre",
      "lentille": "Lentille",
      "accessoire": "Accessoire"
    },
    "status": {
      "DISPONIBLE": "Disponible",
      "RESERVE": "Réservé",
      "EN_COMMANDE": "En commande",
      "EN_TRANSIT": "En transit",
      "RUPTURE": "Rupture",
      "OBSOLETE": "Obsolète"
    },
    "frame": {
      "category": "Catégorie",
      "gender": "Genre",
      "shape": "Forme",
      "material": "Matière",
      "frameType": "Type de monture",
      "hingeType": "Type de charnière",
      "caliber": "Calibre",
      "bridge": "Pont",
      "temple": "Branche",
      "frameColor": "Couleur monture",
      "templeColor": "Couleur branches"
    },
    "lens": {
      "lensType": "Type de verre",
      "material": "Matériau",
      "index": "Indice de réfraction",
      "tint": "Teinte",
      "filters": "Filtres",
      "treatments": "Traitements",
      "manufacturer": "Fabricant"
    },
    "contactLens": {
      "type": "Type de lentille",
      "usage": "Usage",
      "laboratory": "Laboratoire",
      "boxQuantity": "Nombre par boîte",
      "boxPrice": "Prix par boîte",
      "unitPrice": "Prix par unité",
      "lotNumber": "Numéro de lot",
      "expirationDate": "Date de péremption"
    },
    "accessory": {
      "category": "Catégorie",
      "subCategory": "Sous-catégorie"
    },
    "messages": {
      "createSuccess": "Produit créé avec succès",
      "updateSuccess": "Produit modifié avec succès",
      "deleteSuccess": "Produit supprimé avec succès",
      "deleteConfirm": "Êtes-vous sûr de vouloir supprimer ce produit ?",
      "deleteError": "Impossible de supprimer ce produit"
    }
  }
}
```

---

## 11. Notes supplémentaires

| Aspect             | Détail                                  |
| ------------------ | --------------------------------------- |
| Image placeholder  | `assets/images/placeholder-product.png` |
| Format devise      | DH (Dirham marocain)                    |
| Format prix        | 2 décimales                             |
| TVA par défaut     | 20%                                     |
| Timeout chargement | 5-6 secondes                            |
| Message vide       | "Aucun produit trouvé"                  |

---

## 12. Notes de session

### Session 2026-01-04

- Analyse du module stock-management de optisass-angular
- Extraction des règles métier
- Validation complète du besoin (12 décisions)
- Définition de l'architecture ressources (ResourceStore hybride)
- Définition des models (Product, Request, Response) avec Discriminated Union
- Validation du plan en 7 étapes
- Création du fichier STOCK-MODULE-SPEC.md
- Ajout des colonnes, filtres, styles, API, traductions
- En attente du "go" pour démarrer l'Étape 1

---

## 13. Règles de développement

1. **MCP First** : Consulter MCP Angular/Material/NgRx avant de coder
2. **Signal Forms + FieldTree** : Pattern pour les formulaires composites
3. **Signal Store** : Pour le state management
4. **Mock d'abord** : Pas de backend, utiliser les fichiers `.mock.ts`
5. **Validation étape par étape** : Attendre le "go" avant de passer à l'étape suivante
6. **Build après chaque étape** : `npm run build` pour valider
