# Préférences de Développement - OptisaaS

> 📌 Ce fichier contient les standards de codage et préférences pour le développement avec Claude AI sur le projet OptisaaS.

## 🎯 Stack Technique

- **Framework** : Angular 21 (standalone components)
- **UI Framework** : Material Design
- **CSS Framework** : Tailwind CSS
- **Forms** : Signal Forms (`@angular/forms/signals`)
- **State Management** : NgRx Signal Store (migration en cours depuis NgRx Store)
- **Version NgRx** : 20.1.0 (compatible Angular 21)

## 📝 Standards de Documentation

### JSDoc
- ✅ **À utiliser** : Uniquement pour les **méthodes**
- ❌ **À éviter** : Sur les propriétés, classes, interfaces, getters/setters

### Exemple correct :
```typescript
export class MyComponent {
  // Pas de JSDoc ici
  private readonly service = inject(MyService);
  
  // Pas de JSDoc sur les getters
  protected get data(): string {
    return this.#data;
  }
  
  /**
   * Charge les données depuis l'API
   */
  loadData(): void {
    // Implémentation
  }
}
```

## 🏗️ Architecture & Patterns

### Composants
- Toujours utiliser des **standalone components**
- Ne PAS définir `standalone: true` (défaut en Angular v20+)
- Utiliser `ChangeDetectionStrategy.OnPush`
- Injection via `inject()` au lieu du constructeur
- Propriétés privées avec `#` (private fields)
- Propriétés readonly avec `readonly`

### Forms
- Utiliser **Signal Forms** exclusivement
- Typage strict avec interface de modèle
- Modèle séparé dans un fichier dédié

### Styling
- ❌ **NE JAMAIS utiliser** : `ngStyle`, `ngClass`
- ✅ **Utiliser** : Classes Tailwind CSS
- ✅ **Utiliser** : Bindings de style individuels `[style.property]`
- ✅ **Utiliser** : Bindings de classe conditionnels `[class.my-class]`

### Templates
- Utiliser le control flow moderne : `@if`, `@for`, `@switch`
- ❌ Éviter : `*ngIf`, `*ngFor`, `*ngSwitch`

## 🔒 Typage Strict (CRITIQUE)

### Règles Absolues

#### ❌ **INTERDIT : `any`**
```typescript
// ❌ MAUVAIS
function getData(data: any): any { ... }
const request: HttpRequest<any> = ...;

// ✅ BON
function getData<T>(data: T): T { ... }
const request: HttpRequest<MyDataType> = ...;
```

#### ✅ **Utiliser les Génériques**
```typescript
// Pour les fonctions réutilisables
function addAuthHeader<T>(
  request: HttpRequest<T>,
  token: string
): HttpRequest<T> { ... }
```

#### ✅ **Utiliser `unknown` au lieu de `any`**
```typescript
// Quand le type est vraiment inconnu
catchError((error: unknown) => {
  if (error instanceof HttpErrorResponse) { ... }
})
```

#### ✅ **Type Guards**
```typescript
// Pour valider les types à runtime
export function isValidTokens(tokens: JwtTokensState): tokens is IJwtTokens {
  return tokens !== null && 
         typeof tokens.token === 'string' &&
         tokens.token.length > 0;
}

// Utilisation
if (isValidTokens(tokens)) {
  // TypeScript sait que tokens est IJwtTokens ici
  console.log(tokens.token); // ✅ Pas d'erreur
}
```

#### ✅ **Types Union pour États Nullables**
```typescript
// Au lieu de classes avec valeurs null
export type JwtTokensState = IJwtTokens | null;
export type UserState = IUser | null;

// Constantes typées
export const INITIAL_JWT_TOKENS: JwtTokensState = null;
```

#### ✅ **Constantes `as const`**
```typescript
// Pour les tableaux de constantes
const PUBLIC_URLS = [
  '/login',
  '/refresh_token',
] as const;

// Type dérivé automatiquement
type PublicUrl = (typeof PUBLIC_URLS)[number];
```

### Types de Retour Explicites

```typescript
// ✅ TOUJOURS spécifier le type de retour
login(): void { ... }
getData(): Observable<User> { ... }
isValid(): boolean { ... }

// ❌ Ne pas laisser TypeScript inférer
login() { ... }  // Mauvais
```

### Interfaces vs Types

```typescript
// ✅ Interfaces pour les objets
export interface IJwtTokens {
  token: string;
  refresh_token: string;
}

// ✅ Types pour les unions, tuples, etc.
export type JwtTokensState = IJwtTokens | null;
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';
```

### Éviter les Classes pour les Modèles

```typescript
// ❌ MAUVAIS - Classe avec constructeur
export class JwtTokens {
  constructor() {
    this.token = null;
    this.refresh_token = null;
  }
}

// ✅ BON - Interface + constante
export interface IJwtTokens {
  token: string;
  refresh_token: string;
}
export const INITIAL_JWT_TOKENS: JwtTokensState = null;
```

## 🔧 Conventions de Code

### TypeScript
- **Type de retour explicite** sur toutes les méthodes
- **Typage strict**, **ZÉRO `any`**
- Utiliser `unknown` quand le type est incertain
- Type guards pour les validations runtime
- Interfaces pour les objets, types pour les unions

### Structure des fichiers
```
feature/
  ├── components/
  │   └── my-component/
  │       ├── models/
  │       │   └── my-form.model.ts
  │       ├── my-component.component.ts
  │       ├── my-component.component.html
  │       └── my-component.component.scss (si nécessaire)
  └── services/
```

### State Management (Signal Store)

```typescript
// Structure d'un Signal Store
export const MyStore = signalStore(
  { providedIn: 'root' },
  
  // 1. État
  withState<MyState>({ ... }),
  
  // 2. Valeurs calculées
  withComputed((store) => ({ ... })),
  
  // 3. Méthodes
  withMethods((store) => ({ ... })),
  
  // 4. Hooks (lifecycle)
  withHooks({ onInit, onDestroy })
);
```

## 🚀 Workflow de Développement

1. Valider la compilation à chaque étape avec `npm run build`
2. Vérifier **ZÉRO erreur TypeScript**
3. Tester sur différents breakpoints (desktop, tablet, mobile)
4. Commits Git réguliers avec messages descriptifs (Conventional Commits)

## 📱 Design Responsive

- Approche Mobile-First
- Utiliser les classes Tailwind responsive (`sm:`, `md:`, `lg:`)
- Tester sur 3 tailles : mobile (< 768px), tablet (768-1024px), desktop (> 1024px)

## 🎨 UI/UX

- Suivre Material Design guidelines
- Intégrer les composants Material correctement
- Assurer l'accessibilité (WCAG AA)
- Bonnes pratiques de focus management

## 📚 Documentation Technique

Documents de référence dans `.ai/` :
- `coding-standards.md` (ce fichier)
- `state-management-analysis.md` - Analyse du store global
- `jwt-interceptor-optimization.md` - Interceptor JWT optimisé

---

**Dernière mise à jour** : 18 décembre 2024  
**Projet** : OptisaaS Frontend  
**Développeur** : Ahmed  
**Version Angular** : 21.0.1  
**Version NgRx** : 20.1.0
