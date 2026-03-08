import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { FieldTree, FormField } from '@angular/forms/signals';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ResourceStore } from '@app/core/store';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { IWarehouse } from '../../../../settings/warehouse/models/warehouse.model';
import {
  calculateTotalQuantity,
  IStockEntryProductFormRow,
  IWarehouseAllocation,
} from '../../models';
import { MatchConfidenceIndicatorComponent } from '../match-confidence-indicator/match-confidence-indicator.component';
import { StockEntryRowComponent } from '../stock-entry-row/stock-entry-row.component';

@Component({
  selector: 'app-stock-entry-table',
  templateUrl: './stock-entry-table.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DecimalPipe,
    FormField,
    MatTableModule,
    MatBadgeModule,
    MatCheckboxModule,
    MatChipsModule,
    MatDividerModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatSelectModule,
    MatTooltipModule,
    TranslateModule,
    MatchConfidenceIndicatorComponent,
    StockEntryRowComponent,
  ],
})
export class StockEntryTableComponent {
  readonly #resourceStore = inject(ResourceStore);
  readonly #translate = inject(TranslateService);

  readonly products = input.required<readonly IStockEntryProductFormRow[]>();
  readonly selectedRowIds = input.required<ReadonlySet<string>>();
  readonly warehouses = input.required<readonly IWarehouse[]>();
  readonly getProductFields =
    input.required<(index: number) => any>();

  readonly tvaRates = this.#resourceStore.tvaRates;

  readonly #warehouseMap = computed(() => {
    const map = new Map<string, string>();
    for (const w of this.warehouses()) {
      map.set(String(w.id), w.name);
    }
    return map;
  });

  readonly #rowIdToIndex = computed(() => {
    const products = this.products();
    const map = new Map<string, number>();
    products.forEach((p, i) => map.set(p._rowId, i));
    return map;
  });

  readonly selectionChange = output<string>();
  readonly selectAllChange = output<boolean>();
  readonly expandChange = output<string>();
  readonly splitClick = output<string>();
  readonly deleteClick = output<string>();
  readonly matchSuggestionSelect = output<{ rowId: string; productId: string }>();
  readonly matchClear = output<string>();
  readonly matchRetry = output<string>();
  readonly nextErrorClick = output<void>();

  readonly displayedColumns = [
    'select',
    'expand',
    'designation',
    'quantity',
    'warehouse',
    'price',
    'tva',
    'status',
    'actions',
  ];

  readonly isAllSelected = computed(() => {
    const products = this.products();
    const selected = this.selectedRowIds();
    return products.length > 0 && products.every((p) => selected.has(p._rowId));
  });

  readonly isSomeSelected = computed(() => {
    const products = this.products();
    const selected = this.selectedRowIds();
    const selectedCount = products.filter((p) => selected.has(p._rowId)).length;
    return selectedCount > 0 && selectedCount < products.length;
  });

  /**
   * Checks if a row is selected.
   * @param rowId Row ID to check
   * @returns True if selected
   */
  isSelected(rowId: string): boolean {
    return this.selectedRowIds().has(rowId);
  }

  /**
   * Toggles selection of a single row.
   * @param rowId Row ID to toggle
   */
  toggleRow(rowId: string): void {
    this.selectionChange.emit(rowId);
  }

  /**
   * Toggles selection of all rows.
   * @param selected Whether to select all
   */
  toggleAll(selected: boolean): void {
    this.selectAllChange.emit(selected);
  }

  /**
   * Toggles expansion of a row.
   * @param rowId Row ID to toggle
   */
  toggleExpand(rowId: string): void {
    this.expandChange.emit(rowId);
  }

  /**
   * Gets the FieldTree for a product row by its rowId.
   * @param rowId Row ID
   * @returns FieldTree or undefined
   */
  getRowFields(rowId: string): any {
    const getter = this.getProductFields();
    const index = this.#rowIdToIndex().get(rowId);
    if (index === undefined) return undefined;
    return getter(index);
  }

  /**
   * Gets total quantity for a row from its FieldTree.
   * @param rowId Row ID
   * @returns Total quantity
   */
  getTotalQuantity(rowId: string): number {
    const fields = this.getRowFields(rowId);
    if (!fields) return 0;
    const allocations = fields.warehouseAllocations().value();
    return calculateTotalQuantity(allocations);
  }

  /**
   * Gets the first warehouse ID for a row.
   * @param rowId Row ID
   * @returns First warehouse ID or null
   */
  getFirstWarehouseId(rowId: string): string | null {
    const fields = this.getRowFields(rowId);
    if (!fields) return null;
    const allocations = fields.warehouseAllocations().value();
    return allocations[0]?.warehouseId ?? null;
  }

  /**
   * Gets the warehouse name by ID.
   * @param warehouseId Warehouse ID
   * @returns Warehouse name or empty string
   */
  getWarehouseName(warehouseId: string | null | undefined): string {
    if (!warehouseId) return '';
    return this.#warehouseMap().get(String(warehouseId)) ?? '';
  }

  /**
   * Gets a tooltip text listing all warehouse allocations.
   * @param allocations Warehouse allocations
   * @returns Tooltip text
   */
  getWarehouseTooltip(allocations: readonly IWarehouseAllocation[]): string {
    if (allocations.length <= 1) return '';
    return allocations
      .map((a) => `${this.getWarehouseName(a.warehouseId)}: ${a.quantity}`)
      .join('\n');
  }

  /**
   * Checks if a row has basic required fields for UI status display.
   * @param rowId Row ID
   * @returns True if has required fields
   */
  isComplete(rowId: string): boolean {
    const fields = this.getRowFields(rowId);
    if (!fields) return false;
    return !fields().invalid();
  }

  /**
   * Handles quantity change via Signal Forms.
   * @param rowId Row ID
   * @param event Input event
   */
  onQuantityChange(rowId: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    const quantity = parseInt(input.value, 10) || 1;
    const fields = this.getRowFields(rowId);
    if (!fields) return;

    const allocations = fields.warehouseAllocations().value();
    if (allocations.length <= 1) {
      const warehouseId = allocations[0]?.warehouseId ?? '';
      fields.warehouseAllocations().value.set([{ warehouseId, quantity }]);
    }
  }

  /**
   * Handles warehouse change via Signal Forms.
   * @param rowId Row ID
   * @param warehouseId New warehouse ID
   */
  onWarehouseChange(rowId: string, warehouseId: number): void {
    const fields = this.getRowFields(rowId);
    if (!fields) return;

    const allocations = fields.warehouseAllocations().value();
    const quantity = allocations[0]?.quantity ?? calculateTotalQuantity(allocations);
    fields.warehouseAllocations().value.set([{ warehouseId: String(warehouseId), quantity }]);
  }

  /**
   * Handles TVA rate change via Signal Forms.
   * @param rowId Row ID
   * @param tvaRate New TVA rate
   */
  onTvaChange(rowId: string, tvaRate: number): void {
    const fields = this.getRowFields(rowId);
    if (!fields) return;
    fields.tvaRate().value.set(tvaRate);
  }

  /**
   * Handles match suggestion selection.
   * @param rowId Row ID
   * @param productId Selected product ID
   */
  onMatchSuggestionSelect(rowId: string, productId: string): void {
    this.matchSuggestionSelect.emit({ rowId, productId });
  }

  /**
   * Handles match clear action.
   * @param rowId Row ID
   */
  onMatchClear(rowId: string): void {
    this.matchClear.emit(rowId);
  }

  /**
   * Handles match retry action.
   * @param rowId Row ID
   */
  onMatchRetry(rowId: string): void {
    this.matchRetry.emit(rowId);
  }

  /**
   * Gets error message for a row with validation errors.
   * @param rowId Row ID
   * @returns Concatenated error messages
   */
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
}
