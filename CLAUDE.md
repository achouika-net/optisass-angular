# OPTI-SAAS Frontend - Development Guide

> Dernière mise à jour : 2025-12-31

## RÈGLES DE CONSULTATION DES SOURCES

### Ordre de priorité strict

1. **MCP (Model Context Protocol)** - TOUJOURS consulter en premier
   - Angular MCP : Angular, Signals, RxJS, Router, Forms, HttpClient, Animations
   - Angular Material MCP : Material Design components, CDK, theming
   - NgRx MCP : Signal Store, State Management, operators
   - Utilisation : Outil `Task` avec `subagent_type='claude-code-guide'`

2. **WebSearch** (si MCP insuffisant)
   - Sources 2024-2025 uniquement

3. **Ce fichier** - Pour patterns déjà validés

### Quand consulter MCP (obligatoire)

- Nouvelles fonctionnalités ou patterns inconnus
- Signal Forms, rxResource, Signals
- Questions d'architecture ou best practices
- APIs deprecated et migrations
- Quand l'utilisateur le demande

### Règles CRITIQUES

1. **API deprecated** : Chercher IMMÉDIATEMENT le remplacement dans MCP. Ne pas inventer de solutions manuelles.
2. **Pas de solutions manuelles** : Si une API officielle existe, l'utiliser.
3. **Git** : Ne JAMAIS commit/push sans permission explicite
4. **CLAUDE.md** : Peut être committé - sert de mémoire persistante du projet
5. **JSDoc** : Uniquement pour les méthodes, pas pour les classes/interfaces
6. **Build** : Toujours `npm run build` après modifications pour vérifier TypeScript

---

## Stack Technique

| Catégorie | Technologie |
|-----------|-------------|
| Framework | Angular 21.x |
| TypeScript | 5.x (mode strict) |
| Node.js | v22.13.1 |
| State | @ngrx/signals (Signal Store) |
| UI | Angular Material + Tailwind CSS |
| i18n | @ngx-translate/core |
| Animations | `provideAnimations()` (PAS async) |
| Notifications | ngx-toastr |
| Backend | NestJS (API REST, Multi-tenant: header `x-tenant-id`) |
| Librairie interne | @optisaas/opti-saas-lib (ResourceAuthorizations) |

---

## Architecture

```
src/app/
├── core/           # Singletons (guards, interceptors, stores, services)
├── features/       # Modules métier (authentication, settings, etc.)
├── layout/         # Composants layout (sidebar, breadcrumb, header)
├── shared/         # Code partagé (components, helpers, models, types)
└── config/         # Configuration (API URLs, menu, routes)
```

### Principes

- **Standalone Components** : Pas de NgModule
- **Signal-based** : Angular Signals + NgRx Signal Store
- **Lazy Loading** : Routes lazy-loadées
- **rxResource** : Pour les appels HTTP avec états automatiques

---

## Code Style

### JSDoc pour les méthodes uniquement

```typescript
/**
 * Description de la méthode
 * @param query - Texte de recherche
 * @returns Observable des résultats
 */
searchAddresses(query: string): Observable<IAddressOption[]> {
  // ...
}
```

### Naming

```typescript
// Services
export class AuthService { }

// Stores
export const AuthStore = signalStore({ ... });

// Guards
export const PermissionCanActivateGuard: CanActivateFn = ...

// Models/Interfaces
export interface IUserOptions { }

// Constants
export const APP_NAME = 'OPTIC SAAS';
```

### File naming

- Components : `*.component.ts`
- Services : `*.service.ts`
- Guards : `*.guard.ts`
- Stores : `*.store.ts`
- Models : `*.model.ts`
- Helpers : `*.helper.ts`
- Types : `*.type.ts`

### Conventions de nommage composants

| Suffixe | Usage | Exemple |
|---------|-------|---------|
| `*-fields` | Groupe de champs réutilisable (Signal Forms) | `address-fields` |
| `*-form` | Formulaire complet avec submit | `warehouse-form` |
| `*-search` | Page de recherche/liste | `warehouse-search` |
| `*-table` | Tableau de données | `warehouse-search-table` |
| `*-view` | Page de visualisation/édition | `warehouse-view` |
| `*-add` | Page de création | `warehouse-add` |

**À éviter** : `*-form-group` (suggère Reactive Forms, pas Signal Forms)

### Import aliases

```typescript
import { AuthStore } from '@app/core/store';
import { IUserOptions, IAddress, AddressField, BreadcrumbItem } from '@app/models';
import { TypedRoute, RouteData } from '@app/types';
import { AddressSchema } from '@app/validators';
import { AddressFieldsComponent } from '@app/components';
```

---

## Angular 21 Signals & rxResource

### Utiliser les Signals

```typescript
// BON
signal(), computed(), effect()
rxResource() pour HTTP avec isLoading/error/value automatiques
toSignal() / toObservable() pour interop RxJS

// MAUVAIS
BehaviorSubject, toSignal sans defaultValue
```

### rxResource (Angular 20+)

**API Angular 20+** : Utilise `params` et `stream` (pas `request`/`loader` qui sont obsolètes)

```typescript
readonly addressResource = rxResource({
  params: () => ({ query: this.query(), countryCode: this.countryCode() }),
  stream: ({ params }) => this.service.search(params.query, params.countryCode),
  defaultValue: [],  // Évite null, pas besoin de computed wrapper
});

// Utilisation directe des Signals - PAS de computed wrapper !
addressResource.value()      // Signal<T> - déjà un signal
addressResource.isLoading()  // Signal<boolean> - déjà un signal
addressResource.error()      // Signal<Error | undefined>
```

---

## Signal Forms (`@angular/forms/signals`)

### FormValueControl (remplace ControlValueAccessor)

```typescript
import { FormValueControl, ValidationError } from '@angular/forms/signals';

export class MyComponent implements FormValueControl<T | null> {
  // REQUIS
  value = model<T | null>(null);

  // OPTIONNELS - auto-bindés par [field]
  touched = input<boolean>(false);
  dirty = input<boolean>(false);
  errors = input<readonly ValidationError.WithOptionalField[]>([]);
  valid = input<boolean>(true);
  invalid = input<boolean>(false);
  pending = input<boolean>(false);
  disabled = input<boolean>(false);
  readonly = input<boolean>(false);
  hidden = input<boolean>(false);
  required = input<boolean>(false);
  name = input<string>();
}
```

### Validation Schema Pattern (réutilisable)

```typescript
// src/app/shared/validators/address.validators.ts
import { maxLength, pattern, required } from '@angular/forms/signals';

export function AddressSchema(addressFieldPath: any, isRequired: boolean = true): void {
  if (isRequired) {
    required(addressFieldPath.street);
    required(addressFieldPath.postcode);
    required(addressFieldPath.city);
  }
  maxLength(addressFieldPath.street, 200);
  maxLength(addressFieldPath.city, 100);
  pattern(addressFieldPath.postcode, /^\d{5}$/);
}

// Usage dans formulaire parent
warehouseForm = form(this.warehouseFormModel, (fieldPath) => {
  required(fieldPath.name);
  AddressSchema(fieldPath.address);  // isRequired=true par défaut
});
```

### Nested Validation Flow

```
Parent form définit validation → [field] directive bind errors → Enfant filtre par fieldTree
```

```typescript
// Enfant filtre les erreurs par champ
#getFieldErrors(field: AddressField): readonly ValidationError.WithOptionalField[] {
  return this.errors().filter((error) => {
    const fieldTree = error.fieldTree;
    if (Array.isArray(fieldTree)) {
      return fieldTree.includes(field) || fieldTree[fieldTree.length - 1] === field;
    }
    return false;
  });
}
```

### Utilisation avec [field]

```html
<!-- Parent - validation définie dans le form() -->
<app-address-fields [field]="warehouseForm.address" />
```

### showError Pattern

```typescript
// Afficher erreur seulement si touched ET erreurs présentes
readonly showStreetError = computed(() =>
  this.touched() && this.#getFieldErrors('street').length > 0
);
```

### Exemple concret : AddressFieldsComponent

```typescript
// Selector: app-address-fields
// Inputs spécifiques:
addressRequired = input<boolean>(true);   // Affiche astérisques si true
countryCode = input<string>('ma');        // Filtre pays pour autocomplete

// Comportement:
// - Autocomplete Geoapify sur champ street
// - Auto-remplit postcode/city depuis sélection
// - Erreurs filtrées par fieldTree depuis parent
```

---

## NgRx Signal Store

### withState crée des computed signals via Proxy

```typescript
// MAUVAIS - Redondant
withComputed((store) => ({
  availableRoutes: computed(() => store.navigation())  // Inutile !
}))

// BON - Accès direct
const routes = authStore.navigation();  // Déjà un computed signal
```

### Computed = fonction pure uniquement pour

- Transformation : `hasItems: computed(() => store.items().length > 0)`
- Extraction nested : `currentId: computed(() => store.current()?.id ?? null)`
- Logique métier : `isAuthenticated: computed(() => isValidUser(...) && ...)`
- Combinaison : `computed(() => store.a() + store.b())`

### tapResponse vs catchError

```typescript
// MAUVAIS - tapResponse capture 401 avant l'interceptor JWT
tapResponse({ error: (error) => { ... } })

// BON - Laisser 401 passer à l'interceptor
catchError((error: HttpErrorResponse) => {
  if (error.status === 401) return EMPTY;  // Interceptor gère le refresh
  // Gérer autres erreurs...
  return EMPTY;
})
```

---

## Authentification

### Flux Login

```
POST /auth/login
  ↓ { accessToken, refreshToken }
getCurrentUser({ isRestoreSession: false })
  ↓
GET /users/me
  ↓ ICurrentUser (avec tenants[])
getUserOptions({ isRestoreSession: false })
  ↓
GET /users/options (header x-tenant-id)
  ↓ IUserOptions { authorizations }
Redirection /p
```

### Flux Refresh Page (Session Restore)

```
provideAppInitializer (bloque bootstrap)
  ↓
inject(AuthStore) → onInit restaure tokens depuis localStorage
  ↓
authStore.jwtTokens()?.accessToken existe ?
  ↓ OUI
getCurrentUser({ isRestoreSession: true })
  ↓
GET /users/me → GET /users/options
  ↓
isSessionRestoring = false
  ↓
Bootstrap continue → Router → Guards
  ↓
Reste sur la route actuelle (pas de redirect vers /p)
```

### provideAppInitializer (Angular 19+)

```typescript
// MAUVAIS - APP_INITIALIZER deprecated
{ provide: APP_INITIALIZER, useFactory: ... }

// BON - provideAppInitializer
provideAppInitializer(() => {
  const authStore = inject(AuthStore);

  if (authStore.jwtTokens()?.accessToken) {
    authStore.getCurrentUser({ isRestoreSession: true });

    // Bloque jusqu'à isSessionRestoring === false
    return firstValueFrom(
      toObservable(authStore.isSessionRestoring).pipe(
        filter((isRestoring) => !isRestoring || !authStore.jwtTokens()?.accessToken),
        take(1)
      )
    );
  }
  return Promise.resolve();
})
```

### AuthStore État

```typescript
interface AuthState {
  jwtTokens: IJwtTokens | null;
  user: ICurrentUser | null;
  currentTenant: ITenant | null;
  userAuthorizations: ResourceAuthorizations[];
  error: WsErrorState | null;
  refreshTokenInProgress: boolean;
  isSessionRestoring: boolean;  // Flag pour bloquer bootstrap
}
```

### AuthStore Computed

```typescript
// isAuthenticated vérifie AUSSI userAuthorizations pour s'assurer session complète
isAuthenticated: computed(() =>
  isValidUser(store.user()) &&
  store.userAuthorizations().length > 0 &&
  !!store.jwtTokens()?.accessToken
)

// Menu filtré automatiquement selon permissions
filteredMenu: computed(() => filterMenuByAuthorizations(MENU, store.userAuthorizations()))
```

### switchTenant

```typescript
// Changement de tenant avec rechargement des permissions
switchTenant: rxMethod<ITenant>(
  pipe(
    switchMap((tenant) => {
      const currentUrl = routeAuthService.getCurrentUrl();
      patchState(store, { currentTenant: tenant });

      return authService.getUserOptions().pipe(
        tap((userOptions) => {
          // Calculer fallback AVANT mise à jour des autorisations
          const fallbackRoute = calculateFallbackRoute(currentUrl, userOptions.authorizations);
          patchState(store, { userAuthorizations: userOptions.authorizations });

          if (fallbackRoute) {
            routeAuthService.navigateToFallbackRoute(fallbackRoute);
          } else {
            routeAuthService.showTenantSwitchSuccess();
          }
        })
      );
    })
  )
)
```

---

## Permissions (Route-Centric)

### APP_ROUTES = Source unique

```typescript
// src/app/config/app-routes.config.ts
export const APP_ROUTES = {
  dashboard: ['SUPPLIERS_CREATE'],
  'settings/users': ['USERS_READ'],
  'settings/users/add': ['USERS_CREATE'],
  'settings/users/:id': ['USERS_READ'],
} as const satisfies Record<string, readonly ResourceAuthorizations[]>;

export type AppRoute = keyof typeof APP_ROUTES;

export function getRoutePermissions(route: AppRoute): readonly ResourceAuthorizations[] {
  return APP_ROUTES[route];
}

export function isValidAppRoute(route: string): route is AppRoute {
  return route in APP_ROUTES;
}
```

### Architecture Permissions

```
┌─────────────────────────────────────────────────────────────┐
│                      APP_ROUTES                              │
│   Source unique de vérité (routes + permissions)            │
└─────────────────────────────────────────────────────────────┘
          │                           │
          ▼                           ▼
┌─────────────────────┐    ┌─────────────────────────────────┐
│    MENU config      │    │   Routes files (*.routes.ts)    │
│  route: AppRoute    │    │  getRoutePermissions('...')     │
└─────────────────────┘    └─────────────────────────────────┘
          │                           │
          ▼                           ▼
┌─────────────────────┐    ┌─────────────────────────────────┐
│  menu.helper.ts     │    │   permission.guard.ts           │
│  Filtre sidebar     │    │   Protège accès route           │
│  via APP_ROUTES     │    │   via route.data                │
└─────────────────────┘    └─────────────────────────────────┘
```

### Routes files

```typescript
import { getRoutePermissions } from '@app/config';

export default [
  {
    path: '',
    data: {
      breadcrumb: 'nav.users_list',
      authorizationsNeeded: getRoutePermissions('settings/users'),
    },
    loadComponent: () => import('./user-search.component'),
  },
] satisfies TypedRoute[];
```

### TypedRoute pour route.data typé

```typescript
export interface RouteData {
  breadcrumb: string;
  authorizationsNeeded?: readonly ResourceAuthorizations[];
}

export type TypedRoute = Omit<Route, 'data' | 'children'> & {
  data?: RouteData;
  children?: TypedRoute[];
};
```

### MenuItem typé avec AppRoute

```typescript
export interface MenuItem {
  label: string;
  icon: string;
  type: MenuItemType;  // 'link' | 'sub' | 'subchild' | 'extLink' | 'footer'
  route?: AppRoute;  // Force l'existence dans APP_ROUTES
  externalUrl?: string;
  children?: MenuItem[];
  disabled?: boolean;
}
```

### Permission Guard

```typescript
const checkPermission = (route: ActivatedRouteSnapshot): boolean => {
  const authStore = inject(AuthStore);
  const routeAuthService = inject(RouteAuthService);
  const userAuthorizations = authStore.userAuthorizations();

  const routeData = route.data as RouteData;
  const authorizationsNeeded = routeData.authorizationsNeeded ?? [];

  if (authorizationsNeeded.length === 0) return true;

  const hasAllAuthorizations = authorizationsNeeded.every((auth) =>
    userAuthorizations.includes(auth)
  );

  if (hasAllAuthorizations) return true;

  // Accès refusé → redirection vers fallback intelligent avec toast
  routeAuthService.navigateToFallback(userAuthorizations);
  return false;
};
```

### route-auth.helper.ts (fonctions pures)

```typescript
// Vérifie si l'utilisateur a les permissions pour une route APP_ROUTES
isRouteAuthorized(route: string | undefined, userAuthorizations: ResourceAuthorizations[]): boolean

// Convertit URL navigateur → clé APP_ROUTES
// Supporte paramètres dynamiques avec n'importe quel nom (:id, :userId, etc.)
normalizeUrlToAppRoute(url: string): string | null
// '/p/settings/users/123' → 'settings/users/:id'

// Calcule la route de fallback quand accès refusé
calculateFallbackRoute(currentUrl: string, userAuthorizations: ResourceAuthorizations[]): string | null
```

### RouteAuthService (orchestration Angular DI)

```typescript
@Injectable({ providedIn: 'root' })
export class RouteAuthService {
  navigateToFallback(userAuthorizations: ResourceAuthorizations[]): boolean;
  navigateToFallbackRoute(fallbackRoute: string): void;
  showTenantSwitchSuccess(): void;
  showTenantSwitchError(): void;
}
```

### ResourceAuthorizations (de @optisaas/opti-saas-lib)

```typescript
// Format: RESOURCE_ACTION
// USERS_CREATE, USERS_READ, USERS_UPDATE, USERS_DELETE
// CLIENTS_CREATE, CLIENTS_READ, CLIENTS_UPDATE, CLIENTS_DELETE
// SUPPLIERS_CREATE, SUPPLIERS_READ, SUPPLIERS_UPDATE, SUPPLIERS_DELETE
// PRODUCTS_CREATE, PRODUCTS_READ, PRODUCTS_UPDATE, PRODUCTS_DELETE
// etc.
```

---

## Interceptors HTTP

### Ordre d'exécution

```
Requête: WithCredentials → Tenant → JWT → ExtractData → Backend
Réponse: Backend → ExtractData → JWT → Tenant → WithCredentials → Service
```

### ExtractDataInterceptor - CRITIQUE

```typescript
// API retourne: { status: 200, data: { accessToken, refreshToken } }
// ExtractDataInterceptor extrait automatiquement → { accessToken, refreshToken }

// MAUVAIS - Double extraction
authService.refreshToken().pipe(map(r => r.data))

// BON - Pas de mapping
authService.refreshToken()  // Retourne directement IJwtTokens
```

### JWT Interceptor - Refresh Token Flow

```
401 Unauthorized → JwtInterceptor.handleUnauthorizedError()
  ↓
refreshTokenSubject.next(null)  // Reset
authStore.refreshToken(refreshToken)
  ↓
waitForNewToken() - souscrit à refreshTokenSubject
  ↓
refreshTokenSubject.next(newAccessToken) → relance requête originale
```

---

## Breadcrumb

### Configuration via route.data

```typescript
{
  path: 'users',
  data: { breadcrumb: 'nav.users' },  // Clé i18n
  loadChildren: () => import('./user/user.routes'),
}
```

### Traduction via pipe (pas translate.instant)

```typescript
// MAUVAIS - translate.instant() peut ne pas être chargé
const label = this.#translate.instant(breadcrumbKey);

// BON - Stocker la clé, traduire dans template
breadcrumbs.push({ label: breadcrumbKey, url });
// Template: {{ item.label | translate }}
```

**Points clés** :
- `route.routeConfig?.data` au lieu de `route.snapshot.data` (évite héritage)
- `route.firstChild` au lieu de `route.children` (évite doublons)
- Dédupliquer avec `Set<string>` sur la clé breadcrumb

---

## Menu (Sidebar)

### Configuration statique

```typescript
// src/app/config/menu.config.ts
export const MENU: MenuItem[] = [
  {
    label: 'nav.dashboard',  // Clé i18n
    icon: 'dashboard',
    type: 'link',
    route: 'dashboard',  // Typé AppRoute
  },
  {
    label: 'nav.settings',
    icon: 'settings',
    type: 'sub',
    children: [
      { label: 'nav.users', icon: 'people', type: 'link', route: 'settings/users' },
    ],
  },
];
```

### Filtrage par permissions

```typescript
// src/app/shared/helpers/menu.helper.ts
export function filterMenuByAuthorizations(
  items: MenuItem[],
  userAuthorizations: ResourceAuthorizations[]
): MenuItem[] {
  return items
    .map((item) => {
      if (item.type === 'sub' && item.children?.length) {
        const filteredChildren = filterMenuByAuthorizations(item.children, userAuthorizations);
        return filteredChildren.length > 0 ? { ...item, children: filteredChildren } : null;
      }
      return isRouteAuthorized(item.route, userAuthorizations) ? item : null;
    })
    .filter((item): item is MenuItem => item !== null);
}
```

---

## Organisation Fichiers Composant Réutilisable

```
shared/components/address-fields/
├── address-fields.component.ts      # Composant principal
├── address-fields.component.html    # Template
├── geoapify-address.service.ts      # Service spécifique (API externe)
├── geoapify-address.model.ts        # Models spécifiques
└── index.ts                         # Barrel export
```

**Règle** : Si un service/model est utilisé UNIQUEMENT par un composant, le mettre DANS le dossier du composant, pas dans `services/` ou `models/` global.

---

## Structure Feature CRUD (Pattern Warehouse)

### Architecture d'une feature CRUD

```
src/app/features/settings/warehouse/
├── components/
│   ├── warehouse.component.ts           # Container principal (router-outlet)
│   ├── warehouse-add/                   # Page création
│   ├── warehouse-view/                  # Page vue/édition
│   ├── warehouse-form/                  # Formulaire réutilisable
│   └── warehouse-search/
│       ├── warehouse-search.component.ts
│       ├── warehouse-search-form/       # Filtres de recherche
│       └── warehouse-search-table/      # Tableau résultats
├── models/
│   ├── index.ts                         # Barrel export
│   ├── warehouse.model.ts               # Interface IWarehouse
│   └── warehouse-search.model.ts        # Interface recherche/pagination
├── services/
│   ├── warehouse.service.ts             # Service HTTP
│   └── warehouse.mock.ts                # Mock data (temporaire)
├── warehouse.store.ts                   # NgRx Signal Store
└── warehouse.routes.ts                  # Routes lazy-loaded
```

### Routes pattern

```typescript
export default [
  {
    path: '',
    component: WarehouseComponent,
    children: [
      { path: '', component: WarehouseSearchComponent },
      { path: 'add', component: WarehouseAddComponent },
      { path: ':id', component: WarehouseViewComponent },
    ],
  },
] satisfies TypedRoute[];
```

---

## Mocking Strategy

### Service avec Mock séparé

```
services/
├── warehouse.service.ts      # Service propre
└── warehouse.mock.ts         # Données mock séparées
```

```typescript
// warehouse.service.ts
import { mockSearch } from './warehouse.mock';

search(...): Observable<...> {
  // TODO: Remplacer par appel API réel
  // return this.#http.get<...>(...);
  return mockSearch(...);
}
```

Quand le backend est prêt :
1. Décommenter les appels API réels
2. Supprimer les imports mock
3. Supprimer le fichier `.mock.ts`

---

## External APIs

### Geoapify Address Autocomplete

```typescript
// environment.ts
geoapifyApiKey: 'YOUR_API_KEY',  // https://www.geoapify.com/

// Endpoint
https://api.geoapify.com/v1/geocode/autocomplete

// Free tier: 3000 req/jour
// Filtrage pays: filter=countrycode:ma (configurable via input countryCode)
```

**Pattern de fallback** : Toujours inclure la saisie utilisateur comme dernière option
```typescript
searchAddresses(query: string): Observable<IAddressOption[]> {
  const userInputOption = { id: 'user-input', formatted: query };

  if (!this.isApiConfigured) {
    return of([userInputOption]);  // Fallback si pas de clé API
  }

  return this.#http.get<IGeoapifyResponse>(...).pipe(
    map((response) => [...(response.results?.map(toAddressOption) || []), userInputOption]),
    catchError(() => of([userInputOption]))  // Fallback si erreur API
  );
}
```

---

## Fichiers de Traduction

### Structure

```
src/assets/i18n/
├── fr.json  # Français (langue principale)
└── en.json  # Anglais (synchronisé avec fr.json)
```

### Règles

- Ne garder que les clés utilisées dans le code
- Synchroniser structure entre fr.json et en.json
- Clés organisées par section : `nav`, `commun`, `error`, `table`, `validators`, `authentication`, `tenant`, `permissions`, `user`

### Clés tenant/permissions

```json
{
  "tenant": {
    "switched": "Centre changé avec succès",
    "switchError": "Erreur lors du changement de centre"
  },
  "permissions": {
    "noAccessToModule": "Vous n'avez pas accès à ce module dans ce centre"
  }
}
```

---

## Erreurs Courantes

| Erreur | Solution |
|--------|----------|
| `tapResponse` capture 401 | Utiliser `catchError` avec filtre 401 |
| `route.snapshot.data` hérite parents | Utiliser `route.routeConfig?.data` |
| Computed wrapper inutile sur Signal Store | Accès direct `store.field()` |
| Computed wrapper inutile sur rxResource | `rxResource.value()` est déjà un Signal |
| rxResource `request`/`loader` | Utiliser `params`/`stream` (Angular 20+) |
| `translate.instant()` pour breadcrumb | Stocker clé, traduire avec pipe `| translate` |
| Permissions dupliquées Menu + Config | Source unique APP_ROUTES |
| `APP_INITIALIZER` deprecated | `provideAppInitializer()` |
| ngx-toastr CSS manquant | Ajouter dans angular.json styles |
| Attendre `isAuthenticated` au lieu de `isSessionRestoring` | `isSessionRestoring` passe à false après `getUserOptions` |
| Header Tenant obsolète | Utiliser `x-tenant-id` (pas `Tenant`) |
| Paramètres de route en dur (`:id`) | Chercher match dans APP_ROUTES |
| Mock data dans service | Séparer dans fichier `.mock.ts` |
| ExtractDataInterceptor double extraction | Pas de `.pipe(map(r => r.data))` |
| route.children au lieu de firstChild | Utiliser `route.firstChild` (évite doublons) |
| Suffixe `*-form-group` pour composant | Utiliser `*-fields` (Signal Forms) |
| CSS class inutilisée dans template | Vérifier avec grep avant de garder |
| Fichiers orphelins après refactoring | Supprimer et nettoyer les index.ts |
| Service/model dans dossier global | Si usage unique, mettre dans dossier du composant |

---

## Checklist Nouveau Composant Signal Forms

1. [ ] Implémenter `FormValueControl<T>`
2. [ ] `value = model<T>()`
3. [ ] Inputs optionnels : touched, errors, invalid, disabled, etc.
4. [ ] `@if (!hidden())` pour affichage conditionnel
5. [ ] Afficher erreurs avec `@if (showError())`
6. [ ] JSDoc sur les méthodes uniquement
7. [ ] Validation dans le parent (via schema function), PAS dans le composant

---

## Principes de Développement

1. **MCP First** : Toujours consulter MCP AVANT de coder
2. **KISS** : Keep It Simple
3. **Type Safety** : Typage strict, pas de `any`
4. **Signals First** : Privilégier Signals vs Observables
5. **Standalone** : Pas de NgModule
6. **Performance** : Lazy loading, computed signals
7. **Sécurité** : Vérification permissions via route.data.authorizationsNeeded
8. **JSDoc** : Uniquement pour les méthodes, pas pour les classes/interfaces

---

## TODO Backend

- [x] ~~Intégration réelle `/users/options`~~ (implémenté)
- [ ] Gestion rôles utilisateur
- [ ] Menu favoris persistés côté serveur
