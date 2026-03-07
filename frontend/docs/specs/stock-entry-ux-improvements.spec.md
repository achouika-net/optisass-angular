# Stock Entry UX Improvements - Specification

> **Version:** 1.0
> **Date:** 2026-01-23
> **Status:** En cours d'implémentation
> **Auteur:** Claude AI + User

---

## Table des matières

1. [Objectif](#1-objectif)
2. [Décisions validées](#2-décisions-validées)
3. [Architecture Signal Forms](#3-architecture-signal-forms)
4. [Nouveaux composants](#4-nouveaux-composants)
5. [Composants à modifier](#5-composants-à-modifier)
6. [Styles CSS](#6-styles-css)
7. [Clés i18n](#7-clés-i18n)
8. [Plan d'implémentation](#8-plan-dimplémentation)
9. [Historique des modifications](#9-historique-des-modifications)

---

## 1. Objectif

Amélioration UX de la feature stock-entry existante :

- **Header sticky** avec infos document + Total HT calculé
- **Deux tabs** (Fournisseur / Produits) avec logique d'affichage conditionnelle
- **Inline editing amélioré** dans la table (désignation, qté, prix, TVA)
- **Entrepôt lecture seule** dans le header avec badge et tooltip
- **Message erreur inline** sous chaque ligne en erreur
- **Barre actions bulk** sticky bottom (pattern Gmail)
- **Bouton "Produit suivant"** pour navigation entre erreurs
- **Auto-expand première erreur**
- **Responsive** avec colonnes adaptatives selon breakpoints

**Important:** La logique métier est déjà en place. C'est principalement une amélioration UX (90% template/CSS, 10% TypeScript).

---

## 2. Décisions validées

### 2.1 Pattern Signal Forms uniforme

| Type               | Pattern                                                               |
| ------------------ | --------------------------------------------------------------------- |
| **Données métier** | FieldTree via `input.required<FieldTree<T>>()` - modification directe |
| **Actions UI**     | `output()` - événements qui déclenchent une action                    |

### 2.2 Outputs à supprimer (remplacer par FieldTree)

| Composant             | Output à supprimer | Remplacement                    |
| --------------------- | ------------------ | ------------------------------- |
| `stock-entry-form`    | `supplierChange`   | `input FieldTree<ISupplier>`    |
| `stock-entry-actions` | `warehouseChange`  | Accès direct FieldTree products |
| `stock-entry-actions` | `tvaChange`        | Accès direct FieldTree products |

### 2.3 Outputs à garder (actions UI)

| Composant           | Output             | Raison             |
| ------------------- | ------------------ | ------------------ |
| `stock-entry-form`  | `newSupplierClick` | Ouvre dialog       |
| `stock-entry-table` | `expandChange`     | Toggle UI state    |
| `stock-entry-table` | `selectionChange`  | Toggle UI state    |
| `stock-entry-table` | `editClick`        | Ouvre dialog       |
| `stock-entry-table` | `splitClick`       | Ouvre dialog       |
| `stock-entry-table` | `deleteClick`      | Action destructive |

### 2.4 Responsive - Colonnes par breakpoint

| Colonne     | Desktop ≥1280px  | Tablet 600-1279px | Mobile <600px |
| ----------- | ---------------- | ----------------- | ------------- |
| Checkbox    | ✅               | ✅                | ✅            |
| Désignation | ✅ Editable      | ✅ Readonly       | ✅ Readonly   |
| Quantité    | ✅ Editable      | ✅ Editable       | Panel         |
| Entrepôt    | ✅ Lecture seule | Panel (< 960px)   | Panel         |
| Prix        | ✅ Editable      | ✅ Editable       | Panel         |
| TVA         | ✅ Editable      | Panel (< 960px)   | Panel         |
| Status      | ✅               | ✅                | ✅            |
| Actions     | ✅               | ✅                | ✅            |

### 2.5 Breakpoints projet (existants)

```
Mobile:    < 600px       (max-width: 599.98px)
Tablet:    600px - 1279px (min-width: 600px) and (max-width: 1279.98px)
Desktop:   ≥ 1280px      (min-width: 1280px)

CSS additionnel:
- @media (width >= 768px)     - Tablet+
- @media (width >= 959.98px)  - Tablet paysage+
- @media (width >= 1280px)    - Desktop
```

### 2.6 Contraintes Touch

- Touch targets ≥ 44px (Apple HIG)
- Inputs plus grands sur tablette/mobile

---

## 3. Architecture Signal Forms

### 3.1 Pattern uniforme

```
┌─────────────────────────────────────────────────────────────────┐
│ stock-entry.component.ts (PARENT)                               │
│                                                                 │
│ readonly #formModel = signal<IStockEntryFormModel>(...);        │
│ readonly entryForm = form(this.#formModel, validators);         │
│                                                                 │
│ Expose:                                                         │
│ - entryForm.supplier         → FieldTree<ISupplier>             │
│ - entryForm.documentNumber   → FieldTree<string>                │
│ - entryForm.products[i]      → FieldTree<IStockEntryProductRow> │
└─────────────────────────────────────────────────────────────────┘
          │
          │ input.required<FieldTree<T>>()
          ▼
┌─────────────────────────────────────────────────────────────────┐
│ ENFANTS (header, tabs, table, row, actions)                     │
│                                                                 │
│ Reçoivent: FieldTree via input()                                │
│ Modifient: field().value.set(newValue)                          │
│ Pas de: output() pour données métier                            │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Exemple modification directe

```typescript
// Dans stock-entry-actions.component.ts
applyWarehouse(warehouseId: string): void {
  const selectedIds = this.selectedRowIds();
  const getter = this.getProductFields();

  for (const rowId of selectedIds) {
    const index = this.#rowIdToIndex().get(rowId);
    const fields = getter(index);
    if (!fields) continue;

    // Modification directe via Signal Forms - PAS d'emit
    fields.warehouseAllocations().value.set([{ warehouseId, quantity: totalQty }]);
  }
}
```

---

## 4. Nouveaux composants

### 4.1 `stock-entry-header/`

**Fichiers:**

- `components/stock-entry-header/stock-entry-header.component.ts`
- `components/stock-entry-header/stock-entry-header.component.html`

**Rôle:** Header sticky avec infos document + Total HT

**Mockup:**

```
┌────────────────────────────────────────────────────────────────────┐
│ Fournisseur: [Safilo ▼][+] │ N°: [FA-001] │ 📅 │ ● Facture        │
│                                            Total HT: 15,450.00 MAD │
└────────────────────────────────────────────────────────────────────┘
```

**Inputs:**

```typescript
readonly suppliers = input.required<readonly ISupplier[]>();
readonly supplierField = input.required<FieldTree<ISupplier>>();
readonly documentNumberField = input.required<FieldTree<string>>();
readonly documentDateField = input.required<FieldTree<Date>>();
readonly documentTypeField = input.required<FieldTree<DocumentType>>();
readonly totalHT = input.required<number>();
```

**Outputs:**

```typescript
readonly newSupplierClick = output<void>();  // Ouvre dialog
```

**Template:**

```html
<mat-card class="sticky top-0 z-50">
  <mat-card-content>
    <div class="flex flex-wrap items-center gap-4">
      <!-- Supplier autocomplete -->
      <div class="flex items-center gap-2 flex-1 min-w-[200px]">
        <app-resource-autocomplete
          [value]="currentSupplierId()"
          [options]="supplierOptions()"
          [placeholder]="'stock.entry.supplier'"
          (selectionChange)="onSupplierChange($event)"
        />
        <button mat-icon-button (click)="newSupplierClick.emit()">
          <mat-icon>add</mat-icon>
        </button>
      </div>

      <!-- Document number -->
      <mat-form-field class="w-32">
        <mat-label>{{ 'stock.entry.documentNumber' | translate }}</mat-label>
        <input matInput [formField]="documentNumberField()" />
      </mat-form-field>

      <!-- Document date -->
      <mat-form-field class="w-36">
        <mat-label>{{ 'stock.entry.documentDate' | translate }}</mat-label>
        <input matInput [matDatepicker]="picker" [formField]="documentDateField()" />
        <mat-datepicker-toggle matIconSuffix [for]="picker" />
        <mat-datepicker #picker />
      </mat-form-field>

      <!-- Document type -->
      <mat-radio-group [value]="documentType()" (change)="onDocumentTypeChange($event)">
        <mat-radio-button value="invoice">{{ 'stock.entry.invoice' | translate }}</mat-radio-button>
        <mat-radio-button value="delivery_note"
          >{{ 'stock.entry.deliveryNote' | translate }}</mat-radio-button
        >
      </mat-radio-group>

      <!-- Total HT -->
      <div class="ml-auto text-right">
        <span class="text-sm text-on-surface-variant">{{ 'stock.entry.totalHT' | translate }}</span>
        <p class="text-lg font-semibold">{{ totalHT() | number:'1.2-2' }} MAD</p>
      </div>
    </div>
  </mat-card-content>
</mat-card>
```

---

### 4.2 `stock-entry-tabs/`

**Fichiers:**

- `components/stock-entry-tabs/stock-entry-tabs.component.ts`
- `components/stock-entry-tabs/stock-entry-tabs.component.html`

**Rôle:** Conteneur tabs Fournisseur / Produits

**Mockup:**

```
┌────────────────────────────────────────────────────────────────────┐
│ [Tab: Fournisseur 👤]  [Tab: Produits 📦 (12) ⚠️3]                │
├────────────────────────────────────────────────────────────────────┤
│ <contenu tab actif>                                                │
└────────────────────────────────────────────────────────────────────┘
```

**Inputs:**

```typescript
readonly supplierField = input.required<FieldTree<ISupplier>>();
readonly totalProducts = input.required<number>();
readonly incompleteCount = input.required<number>();
readonly initialTabIndex = input<number>(1);  // 0=Fournisseur, 1=Produits
```

**Logique tab initial:**

```typescript
// OCR + fournisseur incomplet → Tab 0 (Fournisseur)
// OCR + fournisseur valide → Tab 1 (Produits)
// Sélection manuelle → Tab 1 (Produits)
// Nouveau fournisseur → Tab 0 (Fournisseur)
```

**Template:**

```html
<mat-card class="mt-4">
  <mat-card-content>
    <mat-tab-group [(selectedIndex)]="activeTabIndex">
      <!-- Tab Fournisseur -->
      <mat-tab>
        <ng-template mat-tab-label>
          <mat-icon class="mr-2">person</mat-icon>
          {{ 'stock.entry.tabSupplier' | translate }}
        </ng-template>
        <div class="pt-4">
          <app-supplier-info-card [supplier]="supplier()" [supplierField]="supplierField()" />
        </div>
      </mat-tab>

      <!-- Tab Produits -->
      <mat-tab>
        <ng-template mat-tab-label>
          <mat-icon class="mr-2">inventory_2</mat-icon>
          {{ 'stock.entry.tabProducts' | translate }} ({{ totalProducts() }}) @if (incompleteCount()
          > 0) {
          <span class="ml-2 px-1.5 py-0.5 text-xs bg-amber-100 text-amber-800 rounded">
            ⚠️ {{ incompleteCount() }}
          </span>
          }
        </ng-template>
        <div class="pt-4">
          <ng-content />
        </div>
      </mat-tab>
    </mat-tab-group>
  </mat-card-content>
</mat-card>
```

---

## 5. Composants à modifier

### 5.1 `stock-entry.component.ts`

**Ajouts TypeScript:**

```typescript
// Computed Total HT
readonly totalHT = computed(() => {
  return this.products().reduce((sum, p) => {
    const qty = calculateTotalQuantity(p.warehouseAllocations);
    const price = p.purchasePriceExclTax ?? 0;
    return sum + (qty * price);
  }, 0);
});

// Computed tab initial
readonly initialTabIndex = computed(() => {
  const supplier = this.supplier();
  const isOcrProcessed = this.products().some(p => p._ocrConfidence !== null);
  const hasValidSupplier = !!supplier.name?.trim();

  if (isOcrProcessed && !hasValidSupplier) return 0;
  return 1;
});

// Navigation vers prochaine erreur
goToNextError(): void {
  const products = this.products();
  const currentExpandedIdx = products.findIndex(p => p._isExpanded);

  for (let i = currentExpandedIdx + 1; i < products.length; i++) {
    if (this.entryForm.products[i]?.().invalid()) {
      if (currentExpandedIdx >= 0) {
        this.toggleExpand(products[currentExpandedIdx]._rowId);
      }
      this.toggleExpand(products[i]._rowId);
      return;
    }
  }
}

// Suppression produits sélectionnés
deleteSelectedProducts(): void {
  const selectedIds = this.#selectedRowIds();
  this.#formModel.update((m) => ({
    ...m,
    products: m.products.filter((p) => !selectedIds.has(p._rowId)),
  }));
  this.#selectedRowIds.set(new Set());
}

// Auto-expand première erreur (effect dans constructor)
effect(() => {
  const products = this.products();
  const hasExpanded = products.some(p => p._isExpanded);
  if (hasExpanded) return;

  untracked(() => {
    for (let i = 0; i < products.length; i++) {
      if (this.entryForm.products[i]?.().invalid()) {
        this.toggleExpand(products[i]._rowId);
        break;
      }
    }
  });
});
```

**Suppressions:**

```typescript
// Supprimer ces méthodes (remplacées par modification directe FieldTree)
-setSupplier() - // Le header modifie directement
  applyBulkWarehouse() - // stock-entry-actions modifie directement
  applyBulkTva(); // stock-entry-actions modifie directement
```

**Nouveau template:** Voir section 5.1.1

---

### 5.1.1 `stock-entry.component.html` (nouveau)

```html
<!-- Actions Buttons (OCR, Camera, Search) -->
<app-actions-buttons [actionButtons]="actionButtons()" (action)="onAction($event)" />

<!-- Header sticky -->
<app-stock-entry-header
  class="block"
  [suppliers]="suppliers()"
  [supplierField]="entryForm.supplier"
  [documentNumberField]="entryForm.documentNumber"
  [documentDateField]="entryForm.documentDate"
  [documentTypeField]="entryForm.documentType"
  [totalHT]="totalHT()"
  (newSupplierClick)="openNewSupplierDialog()"
/>

<!-- Tabs (si fournisseur sélectionné ou OCR) -->
@if (showSupplierInfoCard()) {
<app-stock-entry-tabs
  class="block"
  [supplierField]="entryForm.supplier"
  [totalProducts]="totalProducts()"
  [incompleteCount]="incompleteProducts().length"
  [initialTabIndex]="initialTabIndex()"
>
  <!-- Contenu Tab Produits -->

  <!-- Bannière erreurs -->
  @if (incompleteProducts().length > 0) {
  <div class="warning-banner mb-4">
    <mat-icon>warning</mat-icon>
    <span
      >{{ 'stock.entry.validation.incompleteProducts' | translate: { count:
      incompleteProducts().length } }}</span
    >
  </div>
  }

  <!-- Bouton Nouveau produit -->
  <div class="flex justify-end mb-4">
    <button mat-stroked-button (click)="addProduct()">
      <mat-icon>add</mat-icon>
      {{ 'stock.entry.newProduct' | translate }}
    </button>
  </div>

  <!-- Table produits -->
  <app-stock-entry-table
    [products]="products()"
    [selectedRowIds]="selectedRowIds()"
    [warehouses]="warehouses()"
    [getProductFields]="getProductFieldsFn"
    (selectionChange)="toggleSelection($event)"
    (selectAllChange)="selectAll($event)"
    (expandChange)="toggleExpand($event)"
    (splitClick)="openSplitDialog($event)"
    (deleteClick)="removeProduct($event)"
    (nextErrorClick)="goToNextError()"
  />

  <!-- Actions finales -->
  <div class="flex justify-center gap-4 mt-6">
    <button matButton type="button" (click)="onCancel()">{{ 'commun.cancel' | translate }}</button>
    <button
      matButton="filled"
      class="tertiary"
      type="button"
      [disabled]="!isFormValid() || store.isSubmitting()"
      (click)="onSubmit()"
    >
      @if (store.isSubmitting()) {
      <mat-spinner diameter="20" />
      } {{ 'stock.entry.validate' | translate }}
    </button>
  </div>
</app-stock-entry-tabs>
}

<!-- Barre bulk actions (sticky bottom) -->
@if (selectedCount() > 0) {
<app-stock-entry-actions
  [selectedCount]="selectedCount()"
  [selectedRowIds]="selectedRowIds()"
  [products]="products()"
  [warehouses]="warehouses()"
  [getProductFields]="getProductFieldsFn"
  (deleteSelected)="deleteSelectedProducts()"
/>
}
```

---

### 5.2 `stock-entry-form/` - SUPPRIMER

Ce composant sera **supprimé** et fusionné dans `stock-entry-header`.

---

### 5.3 `stock-entry-table.component.ts`

**Ajouts TypeScript:**

```typescript
// Nouveau output pour navigation erreurs
readonly nextErrorClick = output<void>();

// Méthode pour message d'erreur
getErrorMessage(rowId: string): string {
  const fields = this.getRowFields(rowId);
  if (!fields) return '';

  const errors: string[] = [];

  if (fields.warehouseAllocations().invalid()) {
    errors.push(this.#translate.instant('stock.entry.validation.warehouseRequired'));
  }
  if (fields.purchasePriceExclTax().invalid()) {
    errors.push(this.#translate.instant('stock.entry.validation.priceRequired'));
  }
  if (fields.productType().invalid()) {
    errors.push(this.#translate.instant('stock.entry.validation.productTypeRequired'));
  }

  return errors.join(', ');
}
```

**Modifications Template:** Voir section 5.3.1

---

### 5.3.1 `stock-entry-table.component.html` (modifications)

**Désignation éditable inline (desktop only):**

```html
<ng-container matColumnDef="designation">
  <th mat-header-cell *matHeaderCellDef>{{ 'stock.entry.designation' | translate }}</th>
  <td mat-cell *matCellDef="let row">
    <div class="flex items-center gap-2">
      <!-- Badges existants (OCR, match, etc.) -->
      @if (isNewProduct(row)) {
      <span class="badge-new">{{ 'stock.entry.new' | translate }}</span>
      } @if (row._ocrConfidence !== null) { ... } @if (row._matchResult) { ... }

      <!-- Desktop: editable -->
      @let fields = getRowFields(row._rowId); @if (fields) {
      <input
        class="inline-input inline-input-wide hidden xl:block"
        [formField]="fields.designation"
      />
      <!-- Tablet/Mobile: readonly -->
      <span class="xl:hidden truncate max-w-xs" [matTooltip]="row.designation">
        {{ row.designation || '-' }}
      </span>
      }
    </div>
  </td>
</ng-container>
```

**Entrepôt lecture seule avec badge:**

```html
<ng-container matColumnDef="warehouse">
  <th mat-header-cell *matHeaderCellDef class="hidden-below-960">
    {{ 'stock.entry.warehouse' | translate }}
  </th>
  <td mat-cell *matCellDef="let row" class="hidden-below-960">
    <div class="warehouse-display" [matTooltip]="getWarehouseTooltip(row.warehouseAllocations)">
      <span>{{ getWarehouseName(getFirstWarehouseId(row._rowId)) || '—' }}</span>
      @if (row.warehouseAllocations.length > 1) {
      <span class="badge-count">{{ row.warehouseAllocations.length }}</span>
      } @let qty = getTotalQuantity(row._rowId); @if (qty > 0) {
      <span class="badge-qty">{{ qty }}</span>
      }
    </div>
  </td>
</ng-container>
```

**Message erreur inline sous la ligne:**

```html
<!-- Row principale -->
<tr
  mat-row
  *matRowDef="let row; columns: displayedColumns"
  [ngClass]="getRowClasses(row)"
  (click)="isNewProduct(row) ? toggleExpand(row._rowId) : null"
></tr>

<!-- Row erreur inline (si erreur et pas expanded) -->
<ng-container *matRowDef="let row; columns: ['errorMessage']">
  @if (!isComplete(row._rowId) && !row._isExpanded) {
  <tr class="error-message-row">
    <td [attr.colspan]="displayedColumns.length" class="!p-0 !border-0">
      <div class="row-error-message">
        <mat-icon>warning</mat-icon>
        <span>↳ {{ getErrorMessage(row._rowId) }}</span>
      </div>
    </td>
  </tr>
  }
</ng-container>

<!-- Row détail expandable -->
<tr
  mat-row
  *matRowDef="let row; columns: ['expandedDetail']"
  [ngClass]="getDetailRowClasses(row)"
></tr>
```

---

### 5.4 `stock-entry-row.component.ts`

**Ajouts TypeScript:**

```typescript
// Nouveaux inputs
readonly warehouses = input.required<readonly IWarehouse[]>();

// Nouveaux outputs
readonly splitClick = output<void>();
readonly nextErrorClick = output<void>();

// Computed pour champs
readonly designationField = computed(() => this.rowFields().designation);
readonly warehouseAllocationsField = computed(() => this.rowFields().warehouseAllocations);
readonly warehouseAllocations = computed(() => this.warehouseAllocationsField()().value());

// Méthode pour changer entrepôt
onWarehouseChange(warehouseId: string): void {
  const allocations = this.warehouseAllocations();
  const qty = allocations[0]?.quantity ?? 1;
  this.warehouseAllocationsField()().value.set([{ warehouseId, quantity: qty }]);
}
```

**Modifications Template:** Voir section 5.4.1

---

### 5.4.1 `stock-entry-row.component.html` (modifications)

```html
<div class="grid grid-cols-1 gap-3 p-4 bg-gray-50 border-t md:grid-cols-2 lg:grid-cols-3">
  <!-- Désignation (contexte) - NOUVEAU -->
  <mat-form-field appFieldControlLabel class="col-span-full">
    <mat-label>{{ 'stock.entry.designation' | translate }}</mat-label>
    <input matInput [formField]="designationField()" />
  </mat-form-field>

  <!-- Entrepôt (éditable ici) - NOUVEAU -->
  <mat-form-field appFieldControlLabel>
    <mat-label>{{ 'stock.entry.warehouse' | translate }}</mat-label>
    @if (warehouseAllocations().length > 1) {
    <mat-select disabled [value]="'split'">
      <mat-option value="split">
        {{ 'stock.entry.splitAcross' | translate: { count: warehouseAllocations().length } }}
      </mat-option>
    </mat-select>
    <button matSuffix mat-icon-button (click)="splitClick.emit(); $event.stopPropagation()">
      <mat-icon>edit</mat-icon>
    </button>
    } @else {
    <mat-select
      [value]="warehouseAllocations()[0]?.warehouseId"
      (selectionChange)="onWarehouseChange($event.value)"
    >
      @for (wh of warehouses(); track wh.id) {
      <mat-option [value]="wh.id">{{ wh.name }}</mat-option>
      }
    </mat-select>
    }
  </mat-form-field>

  <!-- Type de produit (existant) -->
  <mat-form-field appFieldControlLabel>
    <mat-label>{{ 'stock.entry.productType' | translate }}</mat-label>
    <mat-select [value]="productType()" (selectionChange)="onProductTypeChange($event.value)">
      @for (type of productTypes(); track type.code) {
      <mat-option [value]="type.code">{{ type.label | translate }}</mat-option>
      }
    </mat-select>
    @if (productTypeField()().touched() && productTypeField()().invalid()) {
    <mat-error app-field-error [errors]="productTypeField()().errors()" fieldname="productType" />
    }
  </mat-form-field>

  <!-- ... autres champs existants (frame, lens, etc.) ... -->

  <!-- Bouton Produit suivant - NOUVEAU -->
  <div class="col-span-full flex justify-end mt-4 pt-4 border-t">
    <button mat-stroked-button (click)="nextErrorClick.emit()">
      {{ 'stock.entry.nextProduct' | translate }}
      <mat-icon iconPositionEnd>arrow_forward</mat-icon>
    </button>
  </div>
</div>
```

---

### 5.5 `stock-entry-actions.component.ts` (refonte)

**Nouveau TypeScript:**

```typescript
import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { FieldTree } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { ResourceStore } from '@app/core/store';
import { TranslateModule } from '@ngx-translate/core';
import { IWarehouse } from '../../../../settings/warehouse/models/warehouse.model';
import { IStockEntryProductFormRow } from '../../models';

@Component({
  selector: 'app-stock-entry-actions',
  templateUrl: './stock-entry-actions.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatFormFieldModule, MatIconModule, MatSelectModule, TranslateModule],
})
export class StockEntryActionsComponent {
  readonly #resourceStore = inject(ResourceStore);

  // Inputs
  readonly selectedCount = input.required<number>();
  readonly selectedRowIds = input.required<ReadonlySet<string>>();
  readonly products = input.required<readonly IStockEntryProductFormRow[]>();
  readonly warehouses = input.required<readonly IWarehouse[]>();
  readonly getProductFields =
    input.required<(index: number) => FieldTree<IStockEntryProductFormRow> | undefined>();

  // Outputs (actions seulement)
  readonly deleteSelected = output<void>();

  readonly tvaRates = this.#resourceStore.tvaRates;

  // Map rowId → index
  readonly #rowIdToIndex = computed(() => {
    const map = new Map<string, number>();
    this.products().forEach((p, i) => map.set(p._rowId, i));
    return map;
  });

  /**
   * Applique l'entrepôt à tous les produits sélectionnés via FieldTree.
   * @param warehouseId ID de l'entrepôt cible
   */
  applyWarehouse(warehouseId: string): void {
    const selectedIds = this.selectedRowIds();
    const getter = this.getProductFields();

    for (const rowId of selectedIds) {
      const index = this.#rowIdToIndex().get(rowId);
      if (index === undefined) continue;

      const fields = getter(index);
      if (!fields) continue;

      const allocations = fields.warehouseAllocations().value();
      const totalQty = allocations.reduce((sum, a) => sum + a.quantity, 0) || 1;

      // Modification directe via Signal Forms
      fields.warehouseAllocations().value.set([{ warehouseId, quantity: totalQty }]);
    }
  }

  /**
   * Applique le taux TVA à tous les produits sélectionnés via FieldTree.
   * @param tvaRate Taux TVA (ex: 0.20 pour 20%)
   */
  applyTva(tvaRate: number): void {
    const selectedIds = this.selectedRowIds();
    const getter = this.getProductFields();

    for (const rowId of selectedIds) {
      const index = this.#rowIdToIndex().get(rowId);
      if (index === undefined) continue;

      const fields = getter(index);
      if (!fields) continue;

      // Modification directe via Signal Forms
      fields.tvaRate().value.set(tvaRate);
    }
  }

  /**
   * Applique les valeurs sélectionnées.
   * @param warehouseId ID entrepôt ou null
   * @param tvaRate Taux TVA ou null
   */
  onApply(warehouseId: string | null, tvaRate: number | null): void {
    if (warehouseId) {
      this.applyWarehouse(warehouseId);
    }
    if (tvaRate !== null) {
      this.applyTva(tvaRate);
    }
  }
}
```

---

### 5.5.1 `stock-entry-actions.component.html` (nouveau)

```html
<div class="bulk-actions-bar">
  <!-- Compteur sélection -->
  <div class="flex items-center gap-2">
    <mat-icon class="text-primary">check_box</mat-icon>
    <span class="font-medium">
      {{ 'stock.entry.selectedCount' | translate: { count: selectedCount() } }}
    </span>
  </div>

  <!-- Actions -->
  <div class="flex items-center gap-3">
    <!-- Entrepôt -->
    <mat-form-field class="bulk-select">
      <mat-label>{{ 'stock.entry.warehouse' | translate }}</mat-label>
      <mat-select #warehouseSelect>
        @for (wh of warehouses(); track wh.id) {
        <mat-option [value]="wh.id">{{ wh.name }}</mat-option>
        }
      </mat-select>
    </mat-form-field>

    <!-- TVA -->
    <mat-form-field class="bulk-select">
      <mat-label>{{ 'stock.entry.tvaRate' | translate }}</mat-label>
      <mat-select #tvaSelect>
        @for (rate of tvaRates(); track rate.code) {
        <mat-option [value]="+rate.code">{{ rate.label }}</mat-option>
        }
      </mat-select>
    </mat-form-field>

    <!-- Bouton Appliquer -->
    <button
      mat-flat-button
      color="primary"
      [disabled]="!warehouseSelect.value && tvaSelect.value === undefined"
      (click)="onApply(warehouseSelect.value, tvaSelect.value)"
    >
      {{ 'stock.entry.apply' | translate }}
    </button>

    <!-- Bouton Supprimer -->
    <button
      mat-icon-button
      color="warn"
      (click)="deleteSelected.emit()"
      [matTooltip]="'commun.delete' | translate"
    >
      <mat-icon>delete</mat-icon>
    </button>
  </div>
</div>
```

---

### 5.6 `supplier-info-card.component.ts`

**Modification:** Recevoir `FieldTree<ISupplier>` au lieu de `ISupplier` + emit

```typescript
// AVANT
readonly supplier = input.required<ISupplier>();
readonly supplierChange = output<ISupplier>();

// APRÈS
readonly supplierField = input.required<FieldTree<ISupplier>>();
readonly supplier = computed(() => this.supplierField()().value());

// Les méthodes onFieldBlur modifient directement via FieldTree
onFieldBlur(field: keyof ISupplierInfoForm): void {
  // La modification est déjà faite via [formField]
  // Pas besoin d'emit
}
```

---

## 6. Styles CSS

### 6.1 `_mat-table.scss` (ajouts)

```scss
/* ===========================================
   STOCK ENTRY UX IMPROVEMENTS
   =========================================== */

/* Barre actions bulk - sticky bottom */
.bulk-actions-bar {
  position: fixed;
  bottom: 0;
  left: var(--sidebar-width, 240px);
  right: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1.5rem;
  background-color: var(--mat-sys-surface-container);
  border-top: 1px solid var(--mat-sys-outline-variant);
  box-shadow: 0 -4px 12px rgb(0 0 0 / 10%);
  z-index: 100;

  .bulk-select {
    width: 140px;

    .mat-mdc-form-field-infix {
      min-height: 40px !important;
    }
  }

  @media (width < 600px) {
    left: 0;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1rem;

    .bulk-select {
      width: 100%;
    }
  }
}

/* Warning banner */
.warning-banner {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background-color: rgb(254 243 199 / 80%);
  border: 1px solid rgb(251 191 36);
  border-radius: 0.5rem;
  color: rgb(146 64 14);
  font-weight: 500;

  mat-icon {
    color: rgb(217 119 6);
    flex-shrink: 0;
  }
}

/* Warehouse display (lecture seule) */
.warehouse-display {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem 0.5rem;
  background-color: var(--mat-sys-surface-container);
  border-radius: 4px;
  font-size: 0.875rem;

  .badge-qty {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 1.5rem;
    height: 1.25rem;
    padding: 0 0.25rem;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--mat-sys-on-secondary-container);
    background-color: var(--mat-sys-secondary-container);
    border-radius: 4px;
  }
}

/* Error message row */
.error-message-row {
  background-color: transparent !important;

  &:hover {
    background-color: transparent !important;
  }
}

/* Badge new product */
.badge-new {
  padding: 0.125rem 0.5rem;
  font-size: 0.75rem;
  font-weight: 500;
  background-color: rgb(254 243 199);
  color: rgb(146 64 14);
  border-radius: 4px;
}

/* Responsive columns */
.expandable-table {
  /* Hidden below 960px (tablet portrait + mobile) */
  .hidden-below-960 {
    @media (width < 959.98px) {
      display: none !important;
    }
  }

  /* Hidden below 600px (mobile only) */
  .hidden-below-600 {
    @media (width < 599.98px) {
      display: none !important;
    }
  }

  /* Entrepôt: hidden < 960px */
  .mat-column-warehouse {
    @media (width < 959.98px) {
      display: none !important;
    }
  }

  /* TVA: hidden < 960px */
  .mat-column-tva {
    @media (width < 959.98px) {
      display: none !important;
    }
  }

  /* Quantité: hidden < 600px (mobile) */
  .mat-column-quantity {
    @media (width < 599.98px) {
      display: none !important;
    }
  }

  /* Prix: hidden < 600px (mobile) */
  .mat-column-price {
    @media (width < 599.98px) {
      display: none !important;
    }
  }
}

/* Touch targets pour tablette/mobile */
@media (width < 1280px) {
  .expandable-table {
    .inline-input {
      min-height: 44px;
      padding: 0.625rem 0.75rem;
      font-size: 1rem;
    }

    .mat-mdc-icon-button {
      width: 44px;
      height: 44px;
    }

    .mat-mdc-checkbox .mdc-checkbox {
      width: 44px;
      height: 44px;
    }
  }

  .bulk-actions-bar {
    .mat-mdc-button {
      min-height: 44px;
      padding: 0 1rem;
    }
  }
}

/* Header sticky */
.stock-entry-header {
  position: sticky;
  top: 0;
  z-index: 50;

  @media (width < 768px) {
    position: relative; /* Pas sticky sur mobile */
  }
}
```

---

## 7. Clés i18n

### 7.1 `fr.json` (ajouts)

```json
{
  "stock": {
    "entry": {
      "newProduct": "Nouveau produit",
      "nextProduct": "Produit suivant",
      "totalHT": "Total HT",
      "splitAcross": "Réparti sur {{ count }} entrepôts",
      "tabSupplier": "Fournisseur",
      "tabProducts": "Produits",
      "validation": {
        "warehouseRequired": "Entrepôt requis",
        "priceRequired": "Prix requis",
        "productTypeRequired": "Type de produit requis"
      }
    }
  }
}
```

### 7.2 `en.json` (ajouts)

```json
{
  "stock": {
    "entry": {
      "newProduct": "New product",
      "nextProduct": "Next product",
      "totalHT": "Total excl. tax",
      "splitAcross": "Split across {{ count }} warehouses",
      "tabSupplier": "Supplier",
      "tabProducts": "Products",
      "validation": {
        "warehouseRequired": "Warehouse required",
        "priceRequired": "Price required",
        "productTypeRequired": "Product type required"
      }
    }
  }
}
```

---

## 8. Plan d'implémentation

### Ordre d'exécution

| #   | Étape                                        | Fichiers                              | Status  |
| --- | -------------------------------------------- | ------------------------------------- | ------- |
| 1   | CSS - Styles responsive et nouveaux éléments | `_mat-table.scss`                     | ⬜ TODO |
| 2   | Créer `stock-entry-header`                   | Nouveau composant                     | ⬜ TODO |
| 3   | Créer `stock-entry-tabs`                     | Nouveau composant                     | ⬜ TODO |
| 4   | Modifier `stock-entry-actions`               | Refonte avec Signal Forms             | ⬜ TODO |
| 5   | Modifier `stock-entry-table`                 | Inline editing, responsive, erreurs   | ⬜ TODO |
| 6   | Modifier `stock-entry-row`                   | Désignation, entrepôt, bouton suivant | ⬜ TODO |
| 7   | Modifier `supplier-info-card`                | Adapter pour FieldTree                | ⬜ TODO |
| 8   | Modifier `stock-entry.component`             | Orchestration, nouveaux computed      | ⬜ TODO |
| 9   | Supprimer `stock-entry-form`                 | Fusionné dans header                  | ⬜ TODO |
| 10  | i18n                                         | Ajouter clés fr.json et en.json       | ⬜ TODO |
| 11  | Build & Test                                 | `npm run build`                       | ⬜ TODO |

---

## 9. Historique des modifications

| Date       | Version | Modifications             |
| ---------- | ------- | ------------------------- |
| 2026-01-23 | 1.0     | Création du document spec |

---

## Notes

- **À supprimer** ce fichier une fois l'implémentation terminée et validée
- **Mettre à jour** le status de chaque étape au fur et à mesure
- **Documenter** tout problème rencontré dans la section Historique
