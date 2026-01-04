# OPTI-SAAS Frontend - Instructions IA

> Document destiné UNIQUEMENT à Claude AI. Dernière mise à jour : 2026-01-02

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
4. **Build** : Toujours `npm run build` après modifications
5. **Type Safety** : Pas de `any` - utiliser `as unknown as { prop?: Type }`
6. **JSDoc** : Uniquement pour les méthodes, pas classes/interfaces
7. **Lire avant modifier** : Toujours lire un fichier avant de le modifier

---

## 2. FICHIERS RÉFÉRENCE

| Besoin                   | Fichier                                                        |
| ------------------------ | -------------------------------------------------------------- |
| Signal Forms + FieldTree | `shared/components/address-fields/address-fields.component.ts` |
| Feature CRUD complète    | `features/settings/warehouse/`                                 |
| Signal Store             | `features/settings/user/user.store.ts`                         |
| Routes + Permissions     | `config/app-routes.config.ts`                                  |
| Menu typé                | `config/menu.config.ts`                                        |
| Guards                   | `core/guards/permission.guard.ts`                              |
| Auth Flow                | `core/store/auth.store.ts`                                     |
| Validation errors        | `shared/components/field-error/field-error.component.ts`       |
| Service HTTP             | `features/authentication/services/auth.service.ts`             |
| Interceptors             | `core/interceptors/`                                           |

---

## 3. DÉCISIONS DE DESIGN

| Décision             | Choix                                   | Raison                                     |
| -------------------- | --------------------------------------- | ------------------------------------------ |
| Child Forms          | FieldTree + `[(input)]`                 | Accès sous-champs, propagation erreurs     |
| Permissions          | APP_ROUTES source unique                | Évite duplication menu/routes              |
| Mocking              | `*.mock.ts` séparé                      | Facilite suppression quand backend prêt    |
| ValidationError      | `as unknown as { prop?: Type }`         | Typage explicite sans `any`                |
| State Management     | NgRx Signal Store (pas Redux classique) | Plus simple, signals natifs                |
| Error Handling Store | `catchError` (pas `tapResponse`)        | Laisser 401 passer à l'interceptor JWT     |
| Animations           | `provideAnimations()` sync              | Pas async pour éviter problèmes chargement |

---

## 4. PATTERNS (Checklists)

### Contrôle Simple

- [ ] `FormValueControl<T>` + `value = model<T>()`
- [ ] Erreurs : `@if (field().touched() && field().invalid())`

### Composant Composite

- [ ] `model.required<FieldTree<T>>()`
- [ ] Importer `Field` directive
- [ ] Computed pour sous-champs
- [ ] Parent : `[(input)]="form.field"` (pas `[field]`)
- [ ] Model parent : initialiser avec objet complet (pas null)

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

| Erreur                            | Cause                         | Solution                         |
| --------------------------------- | ----------------------------- | -------------------------------- |
| `tapResponse` capture 401         | Empêche JWT interceptor       | `catchError` avec filtre 401     |
| Computed wrapper sur store        | `withState` déjà proxy        | Accès direct `store.field()`     |
| rxResource `request`/`loader`     | API deprecated                | `params`/`stream`                |
| `translate.instant()` breadcrumb  | Traductions pas chargées      | Pipe `\| translate`              |
| `[field]` sur composant composite | Pas accès sous-champs         | `[(input)]` + FieldTree          |
| `ValidationError` avec `any`      | Propriétés dynamiques         | `as unknown as { prop?: Type }`  |
| Node v14 dans husky hooks         | nvm pas chargé                | `nvm use 22` dans hooks          |
| `route.snapshot.data` hérite      | Données parents incluses      | `route.routeConfig?.data`        |
| `route.children` doublons         | Parcours récursif             | `route.firstChild`               |
| Double extraction data            | ExtractDataInterceptor existe | Pas de `.pipe(map(r => r.data))` |
| `appearance="outline"` répété     | Config globale existe         | `MAT_FORM_FIELD_DEFAULT_OPTIONS` |
| `APP_INITIALIZER` deprecated      | Angular 19+                   | `provideAppInitializer()`        |

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
