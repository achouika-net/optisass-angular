# OPTI-SAAS Frontend - Instructions IA

> Document destiné UNIQUEMENT à Claude AI. Dernière mise à jour : 2026-01-19 (stock-entry refactoring)

---

## 0. CHECKLIST PRÉ-CODE OBLIGATOIRE ⚠️

**AVANT de coder quoi que ce soit**, exécuter cette checklist dans l'ordre :

### Étape 1 : Identifier le type de tâche

| Type de tâche            | Fichier référence à lire EN PREMIER                   |
| ------------------------ | ----------------------------------------------------- |
| Formulaire (form)        | `features/stock/product/components/product-form/`     |
| Composant child form     | `shared/components/address-fields/`                   |
| Custom control simple    | `shared/components/resource-autocomplete/`            |
| Store NgRx (signalStore) | `features/stock/product/product.store.ts`             |
| Store NgRx (signalState) | `features/stock/stock-entry/stock-entry.store.ts` ⭐  |
| Service HTTP             | `features/authentication/services/auth.service.ts`    |
| Service Product (shared) | `shared/services/product.service.ts`                  |
| Feature CRUD             | `features/settings/warehouse/`                        |
| Models/Interfaces        | `features/stock/product/models/product-form.model.ts` |

### Étape 2 : Consulter MCP Angular

```
Toujours appeler MCP AVANT de coder pour :
- Signal Forms (form, Field, FieldTree, FormField, validators)
- Angular Material (composants, theming, providers)
- Nouvelles APIs Angular 20+
```

### Étape 3 : Vérifier les providers globaux

Avant d'ajouter un provider dans un composant, vérifier `app.config.ts` :

| Provider                         | Déjà global ? |
| -------------------------------- | ------------- |
| `provideNativeDateAdapter()`     | ✅ OUI        |
| `MAT_FORM_FIELD_DEFAULT_OPTIONS` | ✅ OUI        |
| `MAT_ICON_DEFAULT_OPTIONS`       | ✅ OUI        |
| `provideSignalFormsConfig()`     | ✅ OUI        |
| `provideAnimations()`            | ✅ OUI        |

**Règle** : NE JAMAIS ajouter ces providers dans un composant.

### Étape 4 : Pattern Signal Forms (formulaires)

**Pattern UNIQUE pour les formulaires** (voir `product-form.component.ts`) :

```typescript
// 1. Un signal pour le model (dans le composant)
readonly #formModel = signal<IMyForm>(getDefaultForm());

// 2. UN SEUL form() avec tous les validators
readonly form = form(this.#formModel, (fieldPath) => {
  required(fieldPath.field1);
  required(fieldPath.field2);
  min(fieldPath.numberField, 0);
});

// 3. Effect pour sync données externes (mode édition)
constructor() {
  effect(() => {
    const externalData = this.externalInput();
    untracked(() => {
      if (externalData) {
        this.#formModel.set(toFormData(externalData));
      }
    });
  });
}
```

**Règles Signal Forms** :

- ❌ PAS de multiples `form()` séparés
- ❌ PAS de `ngModel` ni `formControl`
- ❌ PAS de sync manuel dans constructor
- ✅ Un seul `signal<IFormModel>()` + un seul `form()`
- ✅ `effect()` avec `untracked()` pour sync externe

### Étape 5 : Interfaces dans models/

**AVANT de créer une interface** :

1. Vérifier si elle existe dans `shared/models/` ou `@app/models`
2. Vérifier si Angular la fournit (Field, FieldTree, FormValueControl)
3. Si nouvelle interface → créer dans `models/*.model.ts` PAS dans le composant

### Étape 6 : Styles - Classes globales UNIQUEMENT

**JAMAIS de fichier `.scss` spécifique par composant !**

| Besoin            | Solution                                             |
| ----------------- | ---------------------------------------------------- |
| Layout formulaire | Classes `form-grid`, `form-grid-compact`             |
| Layout recherche  | Classe `search-form-grid`                            |
| Spacing/sizing    | Variables CSS globales (`--spacing`, etc.)           |
| Customisation     | Tailwind CSS ou modifier `_form-layouts.scss` global |

**Fichiers styles globaux :**

- `src/assets/styles/_form-layouts.scss` - Layouts formulaires responsive
- `src/assets/styles/global-vars.scss` - Variables CSS
- `src/assets/styles/material-overrides/` - Overrides Material

### Étape 7 : Données globales - ResourceStore

**AVANT de créer une constante ou données partagées** :

1. Vérifier si elle existe dans `ResourceStore` (`core/store/resource.store.ts`)
2. Si c'est une donnée utilisée dans plusieurs features → l'ajouter à ResourceStore

| Donnée         | Source                       |
| -------------- | ---------------------------- |
| `tvaRates`     | `ResourceStore.tvaRates`     |
| `suppliers`    | `ResourceStore.suppliers`    |
| `brands`       | `ResourceStore.brands`       |
| `productTypes` | `ResourceStore.productTypes` |
| `pricingModes` | `ResourceStore.pricingModes` |

**Règle** : NE JAMAIS hardcoder des données partagées (TVA, types, etc.) dans un composant.

### Étape 8 : Layout - Analyser composants existants

**AVANT de proposer un layout**, analyser 2-3 composants similaires :

| Type de page      | Composants à analyser                                |
| ----------------- | ---------------------------------------------------- |
| Page recherche    | `product-search-form`, `user-search-form`            |
| Formulaire simple | `user-form`, `warehouse-form`                        |
| Grand formulaire  | `product-form` (stepper/accordion)                   |
| Page hybride      | `stock-entry` (plusieurs cards pour blocs distincts) |

**Règles UX :**

- Pas de `mat-card-header` → breadcrumb gère le titre
- N blocs logiques distincts → N `mat-card` séparées
- Formulaire complexe création → `mat-stepper`
- Formulaire complexe édition → `mat-accordion`

Voir **Section 16** pour les patterns détaillés.

---

## OBJECTIF DE CE DOCUMENT

Permettre à Claude AI de :

1. **Développer efficacement** en respectant les patterns et conventions du projet
2. **Éviter les erreurs connues** grâce à l'historique des solutions
3. **Apprendre continuellement** des nouvelles décisions et erreurs résolues
4. **Consulter les bonnes sources** (MCP, fichiers référence) avant de coder

---

## 1. RÈGLES CRITIQUES

1. **Relire CLAUDE.md** : Au début de chaque session continuée, relire ce fichier
2. **MCP First** : Consulter MCP Angular/Material/NgRx AVANT de coder
3. **Git** : Ne JAMAIS commit/push sans permission explicite
4. **Git Commit** : Ne PAS ajouter de signature Claude Code ou Co-Authored-By dans les messages de commit
5. **Build** : Toujours `npm run build` après modifications
6. **Type Safety** : Pas de `any` - utiliser `as unknown as { prop?: Type }`
7. **JSDoc** : Toutes les méthodes avec `@param` et `@returns`
8. **Commentaires** : Pas de séparateurs (`// =====`), uniquement pour code complexe
9. **Lire avant modifier** : Toujours lire un fichier avant de le modifier

---

## 2. FICHIERS RÉFÉRENCE

| Besoin                   | Fichier                                                                      |
| ------------------------ | ---------------------------------------------------------------------------- |
| **Formulaire complet**   | `features/stock/product/components/product-form/` ⭐                         |
| **Form model + helpers** | `features/stock/product/models/product-form.model.ts` ⭐                     |
| Signal Forms + FieldTree | `shared/components/address-fields/address-fields.component.ts`               |
| FormValueControl simple  | `shared/components/resource-autocomplete/resource-autocomplete.component.ts` |
| Product autocomplete     | `shared/components/product-autocomplete/product-autocomplete.component.ts`   |
| Feature CRUD complète    | `features/settings/warehouse/`                                               |
| Signal Store (lourd)     | `features/stock/product/product.store.ts`                                    |
| **Signal State (léger)** | `features/stock/stock-entry/stock-entry.store.ts` ⭐                         |
| Routes + Permissions     | `config/app-routes.config.ts`                                                |
| Menu typé                | `config/menu.config.ts`                                                      |
| Guards                   | `core/guards/permission.guard.ts`                                            |
| Auth Flow                | `core/store/auth.store.ts`                                                   |
| Validation errors        | `shared/components/field-error/field-error.component.ts`                     |
| Service HTTP             | `features/authentication/services/auth.service.ts`                           |
| Interceptors             | `core/interceptors/`                                                         |
| **OCR Architecture**     | `docs/specs/ocr-architecture.spec.md` _(Quick Reference en haut du doc)_     |

---

## 3. DÉCISIONS DE DESIGN

| Décision             | Choix                                              | Raison                                                          |
| -------------------- | -------------------------------------------------- | --------------------------------------------------------------- |
| Child Forms          | FieldTree + `[(input)]`                            | Accès sous-champs, propagation erreurs                          |
| Custom Form Control  | `FormValueControl<T>` + `model<T>()`               | Pattern Angular 19+ pour contrôles simples                      |
| Signal Debounce      | `debounce(s, 300)` dans `form()`                   | Debounce natif dans Signal Forms                                |
| Filtrage local       | `computed()` (pas `rxResource`)                    | rxResource = HTTP, computed = en mémoire                        |
| Permissions          | APP_ROUTES source unique                           | Évite duplication menu/routes                                   |
| Mocking              | `*.mock.ts` séparé                                 | Facilite suppression quand backend prêt                         |
| ValidationError      | `as unknown as { prop?: Type }`                    | Typage explicite sans `any`                                     |
| State Management     | NgRx Signal Store (pas Redux classique)            | Plus simple, signals natifs                                     |
| signalState vs Store | `signalState` pour features légères                | Plus léger, classe `@Injectable()` simple                       |
| ID nullable          | `id: string \| null` (null = nouveau)              | Distingue entité existante vs nouvelle                          |
| UI fields prefix     | `_rowId`, `_isExpanded`, `_ocrConfidence`          | Séparation données métier vs état UI                            |
| Interface extension  | `IFormRow extends IBaseForm`                       | Réutilise interface base + ajoute UI fields                     |
| Error Handling Store | `catchError` (pas `tapResponse`)                   | Laisser 401 passer à l'interceptor JWT                          |
| Animations           | `provideAnimations()` sync                         | Pas async pour éviter problèmes chargement                      |
| Traduction composant | Passer clé i18n, traduire dans composant           | `resource-autocomplete` fait `{{ placeholder() \| translate }}` |
| Services partagés    | UN seul service par entité dans `shared/services/` | `ProductService` gère tout le CRUD produit                      |

---

## 4. PATTERNS (Checklists)

### Contrôle Simple (FormValueControl)

Composant avec UN seul champ (ex: autocomplete, upload, toggle custom).

- [ ] `implements FormValueControl<T>`
- [ ] `readonly value = model<T>(null)`
- [ ] Parent utilise `[field]="form.myField"` (directive Field gère le binding)
- [ ] Référence : `resource-autocomplete.component.ts`

### Composant Composite (FieldTree)

Composant avec PLUSIEURS champs liés (ex: address-fields avec street, city, postcode).

- [ ] `readonly myFields = model.required<FieldTree<T>>()`
- [ ] Importer `Field` directive
- [ ] Computed pour sous-champs : `computed(() => this.myFields().street)`
- [ ] Parent : `[(myFields)]="form.address"` (two-way binding)
- [ ] Model parent : initialiser avec objet complet (pas null)
- [ ] Référence : `address-fields.component.ts`

### Feature CRUD

```
{feature}/
├── components/{feature}.component.ts, {feature}-add/, {feature}-view/, {feature}-form/, {feature}-search/
├── models/, services/{feature}.service.ts, {feature}.mock.ts
├── {feature}.store.ts, {feature}.routes.ts
```

### Signal Store (fonctionnel, features complexes)

- [ ] `signalStore()` avec `withState`, `withComputed`, `withMethods`
- [ ] `rxMethod` pour effets async
- [ ] `patchState` pour mutations
- [ ] `catchError` (pas `tapResponse`) pour erreurs HTTP
- [ ] Accès direct `store.field()` (pas de computed wrapper)
- [ ] Référence : `product.store.ts`

### Signal State (léger, features simples)

- [ ] Classe `@Injectable()` avec `signalState<T>()`
- [ ] `patchState(this.#state, ...)` pour mutations
- [ ] `computed()` pour valeurs dérivées
- [ ] Exposer signaux directement : `readonly field = this.#state.field`
- [ ] Méthodes simples pour actions (pas de rxMethod)
- [ ] Référence : `stock-entry.store.ts`

```typescript
@Injectable()
export class MyStore {
  readonly #state = signalState<MyState>({ ... });
  readonly field = this.#state.field;
  readonly derived = computed(() => this.#state.field().length);

  updateField(value: string): void {
    patchState(this.#state, (s) => ({ ...s, field: value }));
  }
}
```

### Service HTTP

- [ ] `#http = inject(HttpClient)` (private)
- [ ] JSDoc sur chaque méthode
- [ ] Types génériques sur les appels HTTP
- [ ] Pas de `.pipe(map(r => r.data))` (ExtractDataInterceptor le fait)
- [ ] **AVANT de créer un service**, vérifier s'il existe déjà dans `shared/services/` ou dans la feature
- [ ] Si le service est utilisé par plusieurs features → le mettre dans `shared/services/`

---

## 5. CONSULTER MCP POUR

- Signal Forms, FieldTree, FormValueControl
- rxResource (params/stream, pas request/loader)
- APIs deprecated et migrations
- NgRx Signal Store patterns
- Angular Material components
- Nouvelles fonctionnalités Angular 20+
- Validators built-in et custom
- Router, Guards, Resolvers
- HttpClient, Interceptors

---

## 6. CONVENTIONS NOMMAGE

| Suffixe    | Usage                          |
| ---------- | ------------------------------ |
| `*-fields` | Groupe de champs réutilisable  |
| `*-form`   | Formulaire complet avec submit |
| `*-search` | Page recherche/liste           |
| `*-table`  | Tableau de données             |
| `*-view`   | Page visualisation/édition     |
| `*-add`    | Page création                  |

**Éviter** : `*-form-group` (suggère Reactive Forms)

**Fichiers** : `*.component.ts`, `*.service.ts`, `*.store.ts`, `*.guard.ts`, `*.model.ts`, `*.helper.ts`, `*.type.ts`

**Code** : `IInterface`, `AuthService`, `AuthStore`, `PermissionGuard`, `APP_NAME`

---

## 7. ERREURS RÉSOLUES

| Erreur                             | Cause                             | Solution                                       |
| ---------------------------------- | --------------------------------- | ---------------------------------------------- |
| `tapResponse` capture 401          | Empêche JWT interceptor           | `catchError` avec filtre 401                   |
| Computed wrapper sur store         | `withState` déjà proxy            | Accès direct `store.field()`                   |
| rxResource `request`/`loader`      | API deprecated                    | `params`/`stream`                              |
| `translate.instant()` breadcrumb   | Traductions pas chargées          | Pipe `\| translate`                            |
| `[field]` sur composant composite  | Pas accès sous-champs             | `[(input)]` + FieldTree                        |
| `ValidationError` avec `any`       | Propriétés dynamiques             | `as unknown as { prop?: Type }`                |
| Node v14 dans husky hooks          | nvm pas chargé                    | `nvm use 22` dans hooks                        |
| `route.snapshot.data` hérite       | Données parents incluses          | `route.routeConfig?.data`                      |
| `route.children` doublons          | Parcours récursif                 | `route.firstChild`                             |
| Double extraction data             | ExtractDataInterceptor existe     | Pas de `.pipe(map(r => r.data))`               |
| `appearance="outline"` répété      | Config globale existe             | `MAT_FORM_FIELD_DEFAULT_OPTIONS`               |
| `APP_INITIALIZER` deprecated       | Angular 19+                       | `provideAppInitializer()`                      |
| Interfaces custom pour Angular     | Types Angular existent déjà       | `FormValueControl<T>` + `model()`              |
| `displayFn` retourne vide          | Reçoit `string` au lieu d'objet   | Gérer `typeof option === 'string'`             |
| `provideNativeDateAdapter` répété  | Provider dans composant           | Déjà global dans `app.config.ts`               |
| Multiples `form()` séparés         | Pattern incorrect                 | Un seul `form()` + un `signal()`               |
| `.scss` par composant              | Styles spécifiques créés          | Classes globales `form-grid`, etc.             |
| `TVA_RATES` hardcodé               | Constante dans composant          | `ResourceStore.tvaRates`                       |
| Données partagées dupliquées       | Constantes locales                | Toujours via `ResourceStore`                   |
| Layout incorrect proposé           | Pas analysé composants existants  | Analyser 2-3 composants similaires             |
| `mat-card-header` utilisé          | Titre dans la card                | Breadcrumb gère le titre                       |
| 1 seule card pour blocs distincts  | Pattern non respecté              | N cards pour N blocs logiques                  |
| `[object Object]` dans placeholder | Clé JSON dupliquée (string+objet) | Renommer pour éviter conflit                   |
| `translate` pipe retourne objet    | Clé i18n pointe vers objet JSON   | Vérifier structure JSON, pas de clé dupliquée  |
| Services dupliqués créés           | Service existant pas identifié    | Déplacer le service existant, ne pas dupliquer |
| `??` et `\|\|` mélangés            | Opérateurs sans parenthèses       | `(a ?? b) \|\| c` avec parenthèses explicites  |
| `signalStore` trop lourd           | Feature simple avec boilerplate   | `signalState` + classe `@Injectable()`         |
| `store.state.field()`              | Pattern signalStore utilisé       | `store.field()` (exposer signaux directement)  |

---

## 8. APIs EXTERNES

### Geoapify Address Autocomplete

- **Endpoint** : `https://api.geoapify.com/v1/geocode/autocomplete`
- **Config** : `environment.geoapifyApiKey`
- **Limites** : 3000 req/jour (free tier)
- **Filtrage** : `filter=countrycode:ma`
- **Pattern** : Toujours inclure saisie utilisateur comme fallback
- **Référence** : `shared/components/address-fields/geoapify-address.service.ts`

### Backend NestJS

- **Header tenant** : `x-tenant-id`
- **Format réponse** : `{ status, data }` (ExtractDataInterceptor extrait `data`)
- **Auth** : JWT Bearer token

---

## 9. TODO PROJET

- [x] `/users/options` (implémenté)
- [ ] Gestion rôles utilisateur
- [ ] Menu favoris persistés

---

## 10. PRÉFÉRENCES PROJET

| Aspect                | Préférence                      |
| --------------------- | ------------------------------- |
| Feedback succès       | `toastr.success()`              |
| Feedback erreur       | `ErrorService.getError()`       |
| Langue par défaut     | FR                              |
| Langue secondaire     | EN                              |
| Format date affichage | `displayDateFormatter()` helper |
| Multi-tenant          | Header `x-tenant-id`            |
| Icônes                | Material Symbols Outlined       |
| Form fields           | Outline (config globale)        |

---

## 11. ARCHITECTURE RAPIDE

```
src/app/
├── core/           # Singletons: guards, interceptors, stores globaux
├── features/       # Modules métier lazy-loaded
├── layout/         # Sidebar, header, breadcrumb
├── shared/         # Components, helpers, models, directives réutilisables
└── config/         # URLs API, menu, routes, constantes
```

**Principes** : Standalone components, Signals, Lazy loading, rxResource pour HTTP

---

## 12. ANGULAR SIGNALS - GUIDE COMPLET

### Quand utiliser quoi

| Besoin                      | Solution                                |
| --------------------------- | --------------------------------------- |
| État simple                 | `signal<T>()`                           |
| Valeur dérivée synchrone    | `computed(() => ...)`                   |
| Valeur liée à une source    | `linkedSignal({ source, computation })` |
| Debounce dans Signal Forms  | `debounce(s, 300)` dans `form()`        |
| Appel HTTP                  | `rxResource({ params, stream })`        |
| Filtrage local (en mémoire) | `computed()` (PAS rxResource)           |
| Two-way binding             | `model<T>()` ou `model.required<T>()`   |

### Signal Forms Debounce

Signal Forms expose `debounce` comme validateur natif :

```typescript
import { debounce, form, required } from '@angular/forms/signals';

readonly internalForm = form(this.#searchText, (s) => {
  required(s, { when: () => this.required() });
  debounce(s, 300);
});
```

### rxResource vs computed

| Cas                    | Solution     |
| ---------------------- | ------------ |
| Données HTTP           | `rxResource` |
| Filtrage liste locale  | `computed()` |
| Transformation données | `computed()` |
| Recherche API          | `rxResource` |

### Signal Forms - Hiérarchie

```
form(model, validators) → FieldTree<T>
    ↓
FieldTree.property → Field (signal)
    ↓
Field() → FieldState (value, touched, invalid, errors)
```

### Accès aux valeurs

```typescript
// Depuis FieldTree
form.name; // Field (signal)
form.name(); // FieldState
form.name().value(); // Valeur actuelle
form.name().value.set(x); // Modifier valeur
form.name().touched(); // boolean
form.name().invalid(); // boolean
```

### NE PAS faire

- ❌ `linkedSignal` pour debounce (synchrone uniquement)
- ❌ `rxResource` pour filtrage local
- ❌ Créer interfaces custom (`FieldLike`, `FieldAccessor`)
- ❌ Double appel dans template `form()().value()`

---

## 13. INTERFACES - RÈGLES STRICTES

### Règles d'or

1. **NE PAS créer d'interfaces pour Angular** - Les types existent déjà
2. **NE PAS définir interfaces/types dans les composants ou services** - Toujours dans `*.model.ts`
3. **NE PAS utiliser `?` pour les propriétés optionnelles** - Utiliser `| null`

### Interfaces interdites (Angular les fournit)

- ❌ `FieldLike`, `FieldAccessor`, `FieldSignal` → `FormValueControl<T>`
- ❌ `WritableSignalLike` → `WritableSignal<T>`
- ❌ Wrapper autour de types Angular existants

### Où définir les interfaces

| Emplacement      | ✅ / ❌ |
| ---------------- | ------- |
| `*.model.ts`     | ✅      |
| `*.component.ts` | ❌      |
| `*.service.ts`   | ❌      |
| `*.store.ts`     | ❌      |

### Propriétés optionnelles : `| null` pas `?`

```typescript
// ❌ MAUVAIS
interface IUser {
  name: string;
  email?: string; // Éviter ?
}

// ✅ BON
interface IUser {
  name: string;
  email: string | null;
}
```

### Pattern ID nullable : distinguer nouveau vs existant

```typescript
// ✅ BON - ID null signifie "nouvelle entité"
interface ISupplier {
  id: string | null; // null = nouveau fournisseur
  name: string;
}

// Utilisation
const isNew = supplier.id === null;
```

### Pattern UI fields : préfixe `_`

```typescript
// ✅ BON - Séparation données métier vs état UI
interface IProductFormRow extends IProductForm {
  readonly id: string | null;           // Donnée métier
  readonly warehouseAllocations: ...;   // Donnée métier
  readonly _rowId: string;              // UI only (identifiant unique ligne)
  readonly _ocrConfidence: number | null; // UI only (confiance OCR)
  readonly _isExpanded: boolean;        // UI only (état expansion)
}
```

### Quand créer une interface

| Cas                           | Action                                      |
| ----------------------------- | ------------------------------------------- |
| Modèle métier (User, Product) | ✅ Créer `IUser`, `IProduct` dans `models/` |
| Réponse API                   | ✅ Créer interface pour typer la réponse    |
| Props de composant complexe   | ✅ Créer interface si > 3 propriétés liées  |
| Type Angular existant         | ❌ NE PAS recréer, importer depuis Angular  |
| Type "générique" abstrait     | ❌ NE PAS créer, utiliser le type concret   |

### Avant de créer une interface

1. **Chercher dans Angular** : `Field`, `FieldTree`, `FormValueControl`, `Signal`, `WritableSignal`
2. **Chercher dans le projet** : `shared/models/`, `core/models/`
3. **Consulter MCP** : Vérifier si le type existe déjà

---

## 14. COMMENTAIRES - RÈGLES

### Ce qui est interdit

- ❌ Séparateurs de blocs : `// ===== INPUTS =====`, `// -----`
- ❌ Commentaires évidents : `// Inject the service`, `// Get user`
- ❌ JSDoc sur classes, interfaces, propriétés
- ❌ Commentaires de code supprimé

### Ce qui est obligatoire

- ✅ JSDoc sur TOUTES les méthodes (avec `@param` et `@returns`)

### Ce qui est autorisé

- ✅ Commentaire court pour logique complexe non évidente
- ✅ `// TODO:` avec contexte si vraiment nécessaire

### Exemple

```typescript
// ❌ MAUVAIS
// ===== INPUTS =====
readonly options = input.required<IOption[]>();

// Get the filtered options
readonly filtered = computed(() => ...);

// ✅ BON
readonly options = input.required<IOption[]>();

readonly filtered = computed(() => ...);

/**
 * Filtre les options selon la hiérarchie parent-enfant.
 * Exclut les options dont le parent est désactivé.
 */
#filterByHierarchy(options: IOption[]): IOption[] { ... }
```

---

## 15. MÉTHODOLOGIE DE DÉBOGAGE

### Checklist OBLIGATOIRE avant de proposer une solution

1. **Identifier TOUS les flux de données**
   - Flux principal (signal → computed → template)
   - Callbacks et fonctions passées aux librairies (`displayWith`, `compareWith`, `trackBy`)
   - Events handlers (`optionSelected`, `selectionChange`)

2. **Vérifier les types à chaque frontière**
   - Qu'est-ce que la librairie ENVOIE à ma fonction ?
   - Qu'est-ce que ma fonction ATTEND comme type ?
   - Exemple : `displayWith` de `mat-autocomplete` peut recevoir `string` OU `object` selon le contexte

3. **Simuler les scénarios utilisateur étape par étape**
   - Scénario 1 : Initialisation (composant charge avec valeur existante)
   - Scénario 2 : Utilisateur tape dans l'input → que reçoit chaque fonction ?
   - Scénario 3 : Utilisateur sélectionne une option
   - Scénario 4 : Utilisateur efface et quitte le champ (blur)

4. **Ne PAS présumer que le code existant est correct**
   - Un bug peut être dans du code qui "marchait avant" mais pas avec la nouvelle architecture
   - Analyser TOUT le code impliqué, pas seulement ce qui a été modifié

### Questions à se poser systématiquement

| Question                                            | Exemple                                        |
| --------------------------------------------------- | ---------------------------------------------- |
| Quel type de données circule ?                      | `string` vs `IAutocompleteOption`              |
| Qui écrit dans ce signal ?                          | `[formField]` directive vs `effect` vs méthode |
| Qui lit ce signal ?                                 | `computed`, template, callback                 |
| La librairie externe appelle-t-elle mes fonctions ? | `displayWith`, `compareWith`                   |

### Erreurs de diagnostic à éviter

- ❌ Analyser uniquement le flux principal et ignorer les callbacks
- ❌ Focaliser sur le code modifié et ignorer le code existant
- ❌ Proposer des solutions sans avoir tracé tous les chemins de données
- ❌ Présumer du type de données sans vérifier ce que la librairie envoie réellement

---

## 16. PATTERNS UX / LAYOUT

### ⚠️ RÈGLE CRITIQUE : Analyser les composants existants AVANT de coder

**TOUJOURS** analyser 2-3 composants similaires existants avant de proposer un layout.

### Patterns identifiés

| Type de page                | Pattern UX                                         | Référence                         |
| --------------------------- | -------------------------------------------------- | --------------------------------- |
| **Page recherche (search)** | Plusieurs `mat-card` séparées                      | `product-search-form.component`   |
| **Formulaire simple**       | 1 `mat-card` + sections avec `mat-divider`         | `user-form.component`             |
| **Grand formulaire ajout**  | `mat-stepper` multi-étapes                         | `product-form.component` (create) |
| **Grand formulaire edit**   | `mat-accordion` avec `mat-expansion-panel`         | `product-form.component` (edit)   |
| **Page hybride (entry)**    | Plusieurs `mat-card` pour blocs logiques distincts | `stock-entry.component`           |

### Pattern 1 : Page de recherche (product-search)

```html
<!-- Card 1: Filtres -->
<mat-card>
  <mat-card-content>
    <form class="search-form-grid">...</form>
  </mat-card-content>
</mat-card>

<!-- Card 2: Résultats -->
<mat-card class="mt-4">
  <mat-card-content>
    <table mat-table>
      ...
    </table>
  </mat-card-content>
</mat-card>

<!-- Cards N: Filtres avancés (grid) -->
<div class="search-criteria-card-grid mt-4">
  <mat-card>...</mat-card>
  <mat-card>...</mat-card>
</div>
```

### Pattern 2 : Formulaire simple (user-form, warehouse-form)

```html
<mat-card>
  <mat-card-content>
    <form>
      <div class="form-grid">...</div>

      <mat-divider class="my-4" />

      <h3 class="text-lg font-medium mb-4">Section 2</h3>
      <div class="form-grid">...</div>

      <!-- Boutons en bas centré -->
      <div class="flex justify-center gap-4 mt-6">
        <button matButton>Annuler</button>
        <button matButton="filled" class="tertiary">Sauvegarder</button>
      </div>
    </form>
  </mat-card-content>
</mat-card>
```

### Pattern 3 : Grand formulaire multi-étapes (product-form)

- **Mode création** : `mat-stepper linear`
- **Mode édition** : `mat-accordion multi` avec `mat-expansion-panel expanded`

### Pattern 4 : Page hybride avec blocs distincts (stock-entry)

```html
<!-- Card 1: Bloc logique A -->
<mat-card>
  <mat-card-content>...</mat-card-content>
</mat-card>

<!-- Card 2: Bloc logique B (conditionnel) -->
@if (condition) {
<mat-card class="mt-4">
  <mat-card-content>...</mat-card-content>
</mat-card>
}

<!-- Card 3: Bloc logique C + Actions -->
<mat-card class="mt-4">
  <mat-card-content>
    ...
    <div class="flex justify-center gap-4 mt-6">...</div>
  </mat-card-content>
</mat-card>
```

### Règles communes

| Règle                         | Détail                                            |
| ----------------------------- | ------------------------------------------------- |
| **Pas de `mat-card-header`**  | Le breadcrumb gère le titre de page               |
| **Espacement entre cards**    | `class="mt-4"` sur les cards suivantes            |
| **Titres de section**         | `<h3 class="text-lg font-medium mb-4">`           |
| **Séparateurs dans une card** | `<mat-divider class="my-4" />`                    |
| **Boutons d'action**          | En bas, centré : `flex justify-center gap-4 mt-6` |
| **Bouton principal**          | `matButton="filled" class="tertiary"`             |
| **Bouton secondaire**         | `matButton` ou `matButton="outlined"`             |

### Checklist avant de coder un layout

- [ ] Identifier le type de page (recherche, formulaire, hybride)
- [ ] Analyser 2-3 composants similaires existants
- [ ] Vérifier si `mat-stepper` ou `mat-accordion` est approprié
- [ ] Compter le nombre de blocs logiques distincts → N cards si distincts
- [ ] Utiliser les classes globales (`form-grid`, `search-form-grid`)

---

## RÈGLES DE MISE À JOUR

### Quand sync CLAUDE.md

- Après résolution d'erreur non documentée → section 7
- Nouveau pattern validé → section 4
- Nouvelle décision architecturale → section 3
- Nouvelle API externe → section 8
- Nouvelle préférence projet → section 10
- Quand l'utilisateur demande "sync claude.md"

### NE PAS ajouter

- Code > 10 lignes (référencer fichier source)
- Documentation Angular standard (MCP)
- Infos dans package.json/tsconfig
- Explications longues (garder concis)

### Comment améliorer ce document

1. **Ajouter des erreurs** : Chaque bug résolu = une ligne dans section 7
2. **Enrichir les patterns** : Nouveaux checklists quand pattern récurrent
3. **Documenter les décisions** : Choix "pourquoi X et pas Y" dans section 3
4. **Mettre à jour les références** : Nouveaux fichiers exemplaires dans section 2
5. **Garder concis** : Si une section dépasse 15 lignes, la résumer
