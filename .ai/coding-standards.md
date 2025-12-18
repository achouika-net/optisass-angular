# Préférences de Développement - OptisaaS

> 📌 Ce fichier contient les standards de codage et préférences pour le développement avec Claude AI sur le projet OptisaaS.

## 🎯 Stack Technique

- **Framework** : Angular (version moderne avec standalone components)
- **UI Framework** : Material Design
- **CSS Framework** : Tailwind CSS
- **Forms** : Signal Forms (`@angular/forms/signals`)
- **State Management** : NgRx Store

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
- Typage strict avec `FormGroup<ModelType>`
- Getters typés retournant `FieldState<Type>`
- Modèle séparé dans un fichier dédié

### Styling
- ❌ **NE JAMAIS utiliser** : `ngStyle`, `ngClass`
- ✅ **Utiliser** : Classes Tailwind CSS
- ✅ **Utiliser** : Bindings de style individuels `[style.property]`
- ✅ **Utiliser** : Bindings de classe conditionnels `[class.my-class]`

### Templates
- Utiliser le control flow moderne : `@if`, `@for`, `@switch`
- ❌ Éviter : `*ngIf`, `*ngFor`, `*ngSwitch`

## 🔧 Conventions de Code

### TypeScript
- Type de retour explicite sur toutes les méthodes
- Typage strict, éviter `any`
- Préférer `unknown` quand le type est incertain

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

## 🚀 Workflow de Développement

1. Valider la compilation à chaque étape avec `npm run build` ou `ng build`
2. Tester sur différents breakpoints (desktop, tablet, mobile)
3. Commits Git réguliers avec messages descriptifs
4. Vérifier les erreurs TypeScript avant de commit

## 📱 Design Responsive

- Approche Mobile-First
- Utiliser les classes Tailwind responsive (`sm:`, `md:`, `lg:`)
- Tester sur 3 tailles : mobile (< 768px), tablet (768-1024px), desktop (> 1024px)

## 🎨 UI/UX

- Suivre Material Design guidelines
- Intégrer les composants Material correctement
- Assurer l'accessibilité (WCAG AA)
- Bonnes pratiques de focus management

---

**Dernière mise à jour** : 18 décembre 2024
**Projet** : OptisaaS Frontend
**Développeur** : Ahmed
