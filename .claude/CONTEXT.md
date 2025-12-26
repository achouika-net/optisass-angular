# Claude Context - OPTI-SAAS Frontend

> Dernière mise à jour : 2025-12-26

## ⚠️ RÈGLES DE CONSULTATION DES SOURCES

### Ordre de priorité strict

1. **🥇 MCP (Model Context Protocol)**
   - Angular MCP : Angular, Signals, RxJS, Router, Forms, HttpClient, Animations
   - Angular Material MCP : Material Design components, CDK, theming
   - NgRx MCP : Signal Store, State Management, operators
   - Utilisation : Outil `Task` avec `subagent_type='claude-code-guide'`

2. **🥈 WebSearch** (si MCP insuffisant)
   - Seulement si le MCP n'a pas de réponse complète
   - Sources 2024-2025 uniquement

3. **🥉 Contexte/mémoire**
   - Pour code simple déjà documenté dans ce fichier
   - Patterns déjà validés

### Quand consulter MCP (obligatoire)

- ✅ Nouvelles fonctionnalités ou patterns inconnus
- ✅ Questions d'architecture ou best practices
- ✅ Dépréciations et migrations
- ✅ Performance, sécurité, scalabilité
- ✅ Quand l'utilisateur le demande

---

## Architecture

### Structure

```
src/app/
├── core/                 # Singletons (guards, interceptors, stores, services)
├── features/             # Modules métier (authentication, settings, etc.)
├── layout/               # Composants layout (sidebar, breadcrumb, header)
├── shared/               # Code partagé (components, helpers, models, types)
└── config/               # Configuration (API URLs, menu, global)
```

### Principes

- **Standalone Components** : Pas de NgModule
- **Signal-based** : Angular Signals + NgRx Signal Store
- **Lazy Loading** : Routes lazy-loadées
- **Separation of Concerns** : Core / Shared / Features

---

## Stack Technique

### Framework

- **Angular** : 21.x
- **TypeScript** : 5.x (mode strict)
- **Node.js** : v22.13.1

### State Management

- **@ngrx/signals** : Signal Store
- **@ngrx/operators** : tapResponse (⚠️ voir section Erreurs Courantes)

### UI/UX

- **@angular/material** : Composants Material Design
- **@angular/cdk** : Drag & drop, overlay
- **Tailwind CSS** : Utility-first CSS
- **ngx-toastr** : Notifications toast

### Animations

- **@angular/platform-browser/animations** : `provideAnimations()` (synchrone)
- ⚠️ **NE PAS utiliser** `provideAnimationsAsync()` (non recommandé pour Material + toastr)

### i18n

- **@ngx-translate/core** : Internationalisation

### Librairie interne

- **@optisaas/opti-saas-lib** : ResourceAuthorizations, etc.

### Backend

- **NestJS** : API REST
- **Multi-tenant** : Header `x-tenant-id` requis

---

## Best Practices Validées

### NgRx Signal Store

#### withState crée des computed signals via Proxy

```typescript
// ❌ MAUVAIS - Redondant
withComputed((store) => ({
  availableRoutes: computed(() => store.navigation())  // Inutile !
}))

// ✅ BON - Accès direct
const routes = authStore.navigation();  // Déjà un computed signal via Proxy
```

#### Créer computed UNIQUEMENT pour

- Transformation : `hasNavigation: computed(() => store.navigation().length > 0)`
- Extraction nested : `currentTenantId: computed(() => store.currentCenter()?.id ?? null)`
- Logique métier : `isAuthenticated: computed(() => isValidUser(...) && ...)`
- Combinaison : `computed(() => store.a() + store.b())`

#### Computed = fonction pure

- ❌ Pas de side effects
- ❌ Pas d'appels async
- ✅ Juste calcul/transformation

#### tapResponse vs tap + catchError

```typescript
// ❌ MAUVAIS - tapResponse capture toutes les erreurs, empêche l'interceptor JWT
getCurrentUser: rxMethod<void>(
  pipe(
    switchMap(() => authService.getCurrentUser().pipe(
      tapResponse({
        next: (user) => { ... },
        error: (error) => { ... }  // Capture 401 avant l'interceptor !
      })
    ))
  )
)

// ✅ BON - tap + catchError avec filtre 401
getCurrentUser: rxMethod<void>(
  pipe(
    switchMap(() => authService.getCurrentUser().pipe(
      tap((user) => { ... }),
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401) {
          return EMPTY;  // Laisser l'interceptor gérer le refresh token
        }
        // Gérer autres erreurs...
        return EMPTY;
      })
    ))
  )
)
```

**Sources MCP** :
- [NgRx Signal Store Guide](https://ngrx.io/guide/signals/signal-store)
- [Angular Signals Documentation](https://angular.dev/guide/signals)

### Angular Guards

- **Functional Guards** : `CanActivateFn` et `CanActivateChildFn`
- Injection : `inject(Service)` dans le guard

```typescript
const checkPermission = (route: ActivatedRouteSnapshot): boolean => {
  const router = inject(Router);
  const authStore = inject(AuthStore);
  // ...
};
```

### TypedRoute pour route.data typé

```typescript
// src/app/shared/types/route-data.type.ts
export interface RouteData {
  breadcrumb?: string;
  authorizationsNeeded?: ResourceAuthorizations[];
}

export type TypedRoute = Omit<Route, 'data' | 'children'> & {
  data?: RouteData;
  children?: TypedRoute[];
};

// Usage dans fichiers de routes
export default [
  {
    path: 'users',
    data: {
      breadcrumb: 'breadcrumb.users',
      authorizationsNeeded: ['USERS_READ'],
    },
    loadChildren: () => import('./user/user.routes'),
  },
] satisfies TypedRoute[];  // ← Force le typage
```

---

## Patterns et Conventions

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

### Import aliases

```typescript
import { AuthStore } from '@app/core/store';
import { IUserOptions, BreadcrumbItem } from '@app/models';
import { TypedRoute, RouteData } from '@app/types';
```

### JSDoc pour méthodes

```typescript
/**
 * Description de la méthode.
 * @param label - Le libellé de l'item à vérifier
 * @returns true si l'item est dans les favoris, false sinon
 */
isFavorite(label: string): boolean {
  return this.favorisItems().some((f) => f.label === label);
}
```

### TypeScript

- Mode strict activé
- Typage explicite requis
- Pas de `any` implicite
- Null safety activé

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

**Points clés** :
- `inject(AuthStore)` déclenche `onInit` → tokens restaurés
- `firstValueFrom` bloque le bootstrap jusqu'à Promise résolue
- Guards s'exécutent APRÈS restauration complète

### AuthStore

**État** :
```typescript
interface AuthState {
  jwtTokens: IJwtTokens | null;
  user: ICurrentUser | null;
  currentCenter: ICenter | null;
  userAuthorizations: ResourceAuthorizations[];
  error: WsErrorState | null;
  refreshTokenInProgress: boolean;
  isSessionRestoring: boolean;  // Flag pour bloquer bootstrap
}
```

**Computed** :
```typescript
// isAuthenticated vérifie AUSSI userAuthorizations pour s'assurer session complète
isAuthenticated: computed(() =>
  isValidUser(store.user()) &&
  store.userAuthorizations().length > 0 &&
  !!store.jwtTokens()?.accessToken
)
```

**Méthodes avec SessionOptions** :
```typescript
interface SessionOptions {
  isRestoreSession?: boolean;
}

// getCurrentUser appelle getUserOptions en chaîne
getCurrentUser: rxMethod<SessionOptions>
getUserOptions: rxMethod<SessionOptions>

// isRestoreSession = true → pas de redirect vers /p, met isSessionRestoring = false
// isRestoreSession = false → redirect vers /p après getUserOptions
```

**Persistance** :
- Persisté : `jwtTokens` uniquement (localStorage)
- `user`, `currentCenter`, `userAuthorizations` : rechargés via API à chaque session

---

## Permissions

### Modèle

```typescript
// Format: RESOURCE_ACTION
type ResourceAuthorizations =
  | 'USERS_CREATE'
  | 'USERS_READ'
  | 'USERS_UPDATE'
  | 'USERS_DELETE'
  | 'CLIENTS_READ'
  // ...
```

### IUserOptions

```typescript
interface IUserOptions {
  authorizations: ResourceAuthorizations[];
}
```

### Permission Guard (via route.data)

```typescript
const checkPermission = (route: ActivatedRouteSnapshot): boolean => {
  const authStore = inject(AuthStore);
  const userAuthorizations = authStore.userAuthorizations();

  const routeData = route.data as RouteData;
  const authorizationsNeeded = routeData.authorizationsNeeded ?? [];

  if (authorizationsNeeded.length === 0) {
    return true;
  }

  return authorizationsNeeded.every((auth) =>
    userAuthorizations.includes(auth)
  );
};
```

---

## Breadcrumb

### Configuration via route.data

```typescript
{
  path: 'users',
  data: { breadcrumb: 'breadcrumb.users' },  // Clé i18n
  loadChildren: () => import('./user/user.routes'),
}
```

### BreadcrumbComponent

```typescript
readonly breadcrumbItems = computed<BreadcrumbItem[]>(() => {
  this.navigationEnd();
  const breadcrumbs: BreadcrumbItem[] = [];
  const seenKeys = new Set<string>();
  let url = '';
  let route: ActivatedRoute | null = this.#activatedRoute.root;

  while (route) {
    const segments = route.snapshot.url.map((s) => s.path);
    if (segments.length > 0) {
      url = `${url}/${segments.join('/')}`;
    }

    // routeConfig.data évite l'héritage des données parentes
    const breadcrumbKey = route.routeConfig?.data?.['breadcrumb'] as string | undefined;

    if (breadcrumbKey && !seenKeys.has(breadcrumbKey)) {
      seenKeys.add(breadcrumbKey);
      const label = this.#translate.instant(breadcrumbKey);
      breadcrumbs.push({ label, url });
    }

    route = route.firstChild;  // Suivre uniquement la chaîne active
  }
  return breadcrumbs;
});
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
    label: 'Dashboard',
    icon: 'dashboard',
    type: 'link',
    route: 'dashboard',
  },
  {
    label: 'Paramétrage',
    icon: 'settings',
    type: 'sub',
    children: [
      { label: 'Utilisateurs', icon: 'people', type: 'link', route: 'settings/users' },
    ],
  },
];
```

### MenuItem

```typescript
export interface MenuItem {
  label: string;
  icon: string;
  type: MenuItemType;  // 'link' | 'sub' | 'subchild' | 'extLink' | 'footer'
  route?: string;
  externalUrl?: string;
  children?: MenuItem[];
  disabled?: boolean;
}
```

---

## Configuration Globale

```typescript
// src/app/config/global.config.ts
export const APP_NAME = 'OPTIC SAAS';
export const PASSWORD_MIN_LENGTH = 12;
export const MAX_HISTORY = 50;
```

---

## Erreurs Courantes

### ❌ tapResponse capture 401 avant l'interceptor

```typescript
// ❌ MAUVAIS
tapResponse({ error: (error) => { ... } })

// ✅ BON
catchError((error: HttpErrorResponse) => {
  if (error.status === 401) return EMPTY;
  // ...
})
```

### ❌ route.snapshot.data hérite des parents

```typescript
// ❌ MAUVAIS
const breadcrumbKey = route.snapshot.data['breadcrumb'];

// ✅ BON
const breadcrumbKey = route.routeConfig?.data?.['breadcrumb'];
```

### ❌ route.children au lieu de firstChild

```typescript
// ❌ MAUVAIS
for (const child of route.children) { ... }

// ✅ BON
route = route.firstChild;
```

### ❌ Computed wrapper inutile

```typescript
// ❌ MAUVAIS
withComputed((store) => ({
  availableRoutes: computed(() => store.navigation())
}))

// ✅ BON
authStore.navigation()
```

### ❌ Header Tenant obsolète

```typescript
// ❌ MAUVAIS
headers.set('Tenant', tenant)

// ✅ BON
headers.set('x-tenant-id', tenant)
```

### ❌ APP_INITIALIZER deprecated (Angular 19+)

```typescript
// ❌ MAUVAIS
import { APP_INITIALIZER } from '@angular/core';
{ provide: APP_INITIALIZER, useFactory: ..., multi: true }

// ✅ BON
import { provideAppInitializer } from '@angular/core';
provideAppInitializer(() => { ... })
```

### ❌ Attendre isAuthenticated au lieu de isSessionRestoring

```typescript
// ❌ MAUVAIS - isAuthenticated devient true avant getUserOptions
filter(() => authStore.isAuthenticated())

// ✅ BON - isSessionRestoring passe à false après getUserOptions
filter((isRestoring) => !isRestoring)
```

---

## TODO Backend

- [ ] Intégration réelle `/users/options` (remplacer mock dans auth.service.ts)
- [ ] Gestion rôles utilisateur
- [ ] Menu favoris persistés côté serveur

---

## Librairies Internes

**@optisaas/opti-saas-lib** : `node_modules/@optisaas/opti-saas-lib/src/shared/`
- `types.ts` : ResourceAuthorizations, Resource, Authorisation

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
- Clés organisées par section : `breadcrumb`, `commun`, `error`, `table`, `validators`, `authentication`, `user`

---

## Principes de Développement

1. **MCP First** : Toujours consulter MCP AVANT de coder
2. **KISS** : Keep It Simple
3. **Type Safety** : Typage strict, pas de `any`
4. **Signals First** : Privilégier Signals vs Observables
5. **Standalone** : Pas de NgModule
6. **Performance** : Lazy loading, computed signals
7. **Sécurité** : Vérification permissions via route.data.authorizationsNeeded
