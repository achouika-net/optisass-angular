# OPTI-SAAS Frontend - Instructions IA

> Document destiné UNIQUEMENT à Claude AI. Dernière mise à jour : 2026-01-04

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
| Signal Forms + FieldTree | `shared/components/address-fields/address-fields.component.ts`               |
| FormValueControl simple  | `shared/components/resource-autocomplete/resource-autocomplete.component.ts` |
| Feature CRUD complète    | `features/settings/warehouse/`                                               |
| Signal Store             | `features/settings/user/user.store.ts`                                       |
| Routes + Permissions     | `config/app-routes.config.ts`                                                |
| Menu typé                | `config/menu.config.ts`                                                      |
| Guards                   | `core/guards/permission.guard.ts`                                            |
| Auth Flow                | `core/store/auth.store.ts`                                                   |
| Validation errors        | `shared/components/field-error/field-error.component.ts`                     |
| Service HTTP             | `features/authentication/services/auth.service.ts`                           |
| Interceptors             | `core/interceptors/`                                                         |

---

## 3. DÉCISIONS DE DESIGN

| Décision             | Choix                                   | Raison                                     |
| -------------------- | --------------------------------------- | ------------------------------------------ |
| Child Forms          | FieldTree + `[(input)]`                 | Accès sous-champs, propagation erreurs     |
| Custom Form Control  | `FormValueControl<T>` + `model<T>()`    | Pattern Angular 19+ pour contrôles simples |
| Signal Debounce      | `toObservable` + `toSignal`             | Pas de debounce natif dans Signals API     |
| Filtrage local       | `computed()` (pas `rxResource`)         | rxResource = HTTP, computed = en mémoire   |
| Permissions          | APP_ROUTES source unique                | Évite duplication menu/routes              |
| Mocking              | `*.mock.ts` séparé                      | Facilite suppression quand backend prêt    |
| ValidationError      | `as unknown as { prop?: Type }`         | Typage explicite sans `any`                |
| State Management     | NgRx Signal Store (pas Redux classique) | Plus simple, signals natifs                |
| Error Handling Store | `catchError` (pas `tapResponse`)        | Laisser 401 passer à l'interceptor JWT     |
| Animations           | `provideAnimations()` sync              | Pas async pour éviter problèmes chargement |

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

### Signal Store

- [ ] `signalState` pour état initial
- [ ] `rxMethod` pour effets async
- [ ] `patchState` pour mutations
- [ ] `catchError` (pas `tapResponse`) pour erreurs HTTP
- [ ] Accès direct `store.field()` (pas de computed wrapper)

### Service HTTP

- [ ] `#http = inject(HttpClient)` (private)
- [ ] JSDoc sur chaque méthode
- [ ] Types génériques sur les appels HTTP
- [ ] Pas de `.pipe(map(r => r.data))` (ExtractDataInterceptor le fait)

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

| Erreur                            | Cause                         | Solution                          |
| --------------------------------- | ----------------------------- | --------------------------------- |
| `tapResponse` capture 401         | Empêche JWT interceptor       | `catchError` avec filtre 401      |
| Computed wrapper sur store        | `withState` déjà proxy        | Accès direct `store.field()`      |
| rxResource `request`/`loader`     | API deprecated                | `params`/`stream`                 |
| `translate.instant()` breadcrumb  | Traductions pas chargées      | Pipe `\| translate`               |
| `[field]` sur composant composite | Pas accès sous-champs         | `[(input)]` + FieldTree           |
| `ValidationError` avec `any`      | Propriétés dynamiques         | `as unknown as { prop?: Type }`   |
| Node v14 dans husky hooks         | nvm pas chargé                | `nvm use 22` dans hooks           |
| `route.snapshot.data` hérite      | Données parents incluses      | `route.routeConfig?.data`         |
| `route.children` doublons         | Parcours récursif             | `route.firstChild`                |
| Double extraction data            | ExtractDataInterceptor existe | Pas de `.pipe(map(r => r.data))`  |
| `appearance="outline"` répété     | Config globale existe         | `MAT_FORM_FIELD_DEFAULT_OPTIONS`  |
| `APP_INITIALIZER` deprecated      | Angular 19+                   | `provideAppInitializer()`         |
| Interfaces custom pour Angular    | Types Angular existent déjà   | `FormValueControl<T>` + `model()` |

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
| Debounce/throttle           | `toObservable` + pipe + `toSignal`      |
| Appel HTTP                  | `rxResource({ params, stream })`        |
| Filtrage local (en mémoire) | `computed()` (PAS rxResource)           |
| Two-way binding             | `model<T>()` ou `model.required<T>()`   |

### Signal Debounce (pattern officiel)

Pas de debounce natif dans l'API Signals. Utiliser le bridge RxJS :

```typescript
readonly #debouncedQuery = toSignal(
  toObservable(this.searchQuery).pipe(debounceTime(200), distinctUntilChanged()),
  { initialValue: '' }
);
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
