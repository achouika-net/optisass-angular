# OPTI-SAAS Frontend - Development Guide

> Ce fichier est la source unique de vérité pour toutes les règles, conventions et best practices du projet.
> Il est lu automatiquement à chaque session Claude.

---

## RÈGLES OBLIGATOIRES

### Ordre de priorité pour les sources

1. **🥇 MCP (Model Context Protocol)** - TOUJOURS consulter en premier
   - Angular MCP : Angular, Signals, RxJS, Router, Forms, HttpClient, Animations
   - Angular Material MCP : Material Design components, CDK, theming
   - NgRx MCP : Signal Store, State Management, operators

2. **🥈 WebSearch** (si MCP insuffisant)
   - Sources 2024-2025 uniquement

3. **🥉 Ce fichier** - Pour patterns déjà validés

### Quand consulter MCP (obligatoire)

- ✅ Nouvelles fonctionnalités ou patterns inconnus
- ✅ Signal Forms, rxResource, Signals
- ✅ Questions d'architecture ou best practices
- ✅ APIs deprecated et migrations
- ✅ Quand l'utilisateur le demande

### Règles CRITIQUES

1. **API deprecated** : Chercher IMMÉDIATEMENT le remplacement dans MCP. Ne pas inventer de solutions manuelles.
2. **Pas de solutions manuelles** : Si une API officielle existe, l'utiliser.
3. **Git** : Ne JAMAIS commit/push sans permission explicite
4. **JSDoc obligatoire** sur toutes les méthodes publiques
5. **Toujours `npm run build`** après modifications pour vérifier TypeScript

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

### JSDoc pour les méthodes

```typescript
/**
 * Description de la méthode
 * @param query - Texte de recherche
 * @param countryCode - Code pays pour filtrer
 * @returns Observable des résultats
 */
searchAddresses(query: string, countryCode = 'ma'): Observable<IAddressOption[]> {
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
export const PermissionGuard: CanActivateFn = ...

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

### Import aliases

```typescript
import { AuthStore } from '@app/core/store';
import { IUserOptions } from '@app/models';
import { TypedRoute } from '@app/types';
```

---

## Angular 21 Signals & rxResource

### Utiliser les Signals

```typescript
// ✅ BON
signal(), computed(), effect()
rxResource() pour HTTP avec isLoading/error/value automatiques
toSignal() / toObservable() pour interop RxJS

// ❌ MAUVAIS
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

**Erreurs courantes rxResource** :
```typescript
// ❌ MAUVAIS - API obsolète Angular < 20
rxResource({ request: ..., loader: ... })

// ❌ MAUVAIS - computed wrapper inutile
readonly isLoading = computed(() => this.addressResource.isLoading());
readonly options = computed(() => this.addressResource.value() ?? []);

// ✅ BON - utilisation directe + defaultValue
readonly addressResource = rxResource({ ..., defaultValue: [] });
// Dans template: addressResource.isLoading(), addressResource.value()
```

---

## Signal Forms (`@angular/forms/signals`)

### FormValueControl (remplace ControlValueAccessor)

```typescript
import { FormValueControl, ValidationError } from '@angular/forms/signals';

export class MyComponent implements FormValueControl<string | null> {
  // REQUIS
  value = model<string | null>(null);

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

### Utilisation avec [field]

```html
<!-- Parent - validation définie ici -->
<app-address-autocomplete
  [field]="warehouseForm.address"
  [label]="'warehouse.address' | translate"
/>
```

### Affichage des erreurs

```html
@if (showError()) {
  <mat-error>
    @for (error of errors(); track $index) {
      {{ error.message || ('validators.' + error.kind | translate) }}
    }
  </mat-error>
}
```

---

## NgRx Signal Store

### withState crée des computed signals via Proxy

```typescript
// ❌ MAUVAIS - Redondant
withComputed((store) => ({
  availableRoutes: computed(() => store.navigation())  // Inutile !
}))

// ✅ BON - Accès direct
const routes = authStore.navigation();  // Déjà un computed signal
```

### Computed = fonction pure uniquement pour

- Transformation : `hasItems: computed(() => store.items().length > 0)`
- Extraction nested : `currentId: computed(() => store.current()?.id ?? null)`
- Combinaison : `computed(() => store.a() + store.b())`

### tapResponse vs catchError

```typescript
// ❌ MAUVAIS - tapResponse capture 401 avant l'interceptor JWT
tapResponse({ error: (error) => { ... } })

// ✅ BON - Laisser 401 passer à l'interceptor
catchError((error: HttpErrorResponse) => {
  if (error.status === 401) return EMPTY;  // Interceptor gère le refresh
  // Gérer autres erreurs...
  return EMPTY;
})
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
// ❌ MAUVAIS - APP_INITIALIZER deprecated
{ provide: APP_INITIALIZER, useFactory: ... }

// ✅ BON - provideAppInitializer
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

### Routes files

```typescript
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

// ❌ MAUVAIS - Double extraction
authService.refreshToken().pipe(map(r => r.data))

// ✅ BON - Pas de mapping
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
// ❌ MAUVAIS - translate.instant() peut ne pas être chargé
const label = this.#translate.instant(breadcrumbKey);

// ✅ BON - Stocker la clé, traduire dans template
breadcrumbs.push({ label: breadcrumbKey, url });
// Template: {{ item.label | translate }}
```

**Points clés** :
- `route.routeConfig?.data` au lieu de `route.snapshot.data` (évite héritage)
- `route.firstChild` au lieu de `route.children` (évite doublons)

---

## Erreurs Courantes

| Erreur | Solution |
|--------|----------|
| `tapResponse` capture 401 | Utiliser `catchError` avec filtre 401 |
| `route.snapshot.data` hérite parents | Utiliser `route.routeConfig?.data` |
| Computed wrapper inutile sur Signal Store | Accès direct `store.field()` |
| `translate.instant()` pour breadcrumb | Stocker clé, traduire avec pipe `\| translate` |
| Permissions dupliquées Menu + Config | Source unique APP_ROUTES |
| `APP_INITIALIZER` deprecated | `provideAppInitializer()` |
| ngx-toastr CSS manquant | Ajouter dans angular.json styles |
| Attendre `isAuthenticated` au lieu de `isSessionRestoring` | `isSessionRestoring` passe à false après `getUserOptions` |
| Header Tenant obsolète | Utiliser `x-tenant-id` (pas `Tenant`) |
| Paramètres de route en dur (`:id`) | Chercher match dans APP_ROUTES |
| rxResource computed wrapper | `rxResource.value()` est déjà un Signal |
| rxResource `request`/`loader` | Utiliser `params`/`stream` (Angular 20+) |
| Mock data dans service | Séparer dans fichier `.mock.ts` ou utiliser fallback |

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
// Fonctionne pour tous les pays (pas seulement Maroc)
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

## Checklist Nouveau Composant Signal Forms

1. [ ] Implémenter `FormValueControl<T>`
2. [ ] `value = model<T>()`
3. [ ] Inputs optionnels : touched, errors, invalid, disabled, etc.
4. [ ] `@if (!hidden())` pour affichage conditionnel
5. [ ] Afficher erreurs avec `@if (showError())`
6. [ ] JSDoc sur toutes les méthodes publiques
7. [ ] Validation dans le parent, PAS dans le composant

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

---

## Librairies Internes

**@optisaas/opti-saas-lib** : `node_modules/@optisaas/opti-saas-lib/src/shared/`
- `types.ts` : ResourceAuthorizations, Resource, Authorisation

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

## Principes de Développement

1. **MCP First** : Toujours consulter MCP AVANT de coder
2. **KISS** : Keep It Simple
3. **Type Safety** : Typage strict, pas de `any`
4. **Signals First** : Privilégier Signals vs Observables
5. **Standalone** : Pas de NgModule
6. **Performance** : Lazy loading, computed signals
7. **Sécurité** : Vérification permissions via route.data.authorizationsNeeded
