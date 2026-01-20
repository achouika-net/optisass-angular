import { animate, state, style, transition, trigger } from '@angular/animations';
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslateModule } from '@ngx-translate/core';
import { IWarehouse } from '../../../../settings/warehouse/models/warehouse.model';
import {
  calculateTotalQuantity,
  isProductRowComplete,
  IStockEntryProductFormRow,
} from '../../models';
import { StockEntryRowComponent } from '../stock-entry-row/stock-entry-row.component';

@Component({
  selector: 'app-stock-entry-table',
  templateUrl: './stock-entry-table.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    MatTableModule,
    MatCheckboxModule,
    MatDividerModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatSelectModule,
    MatTooltipModule,
    TranslateModule,
    StockEntryRowComponent,
  ],
  animations: [
    trigger('detailExpand', [
      state('collapsed,void', style({ height: '0px', minHeight: '0' })),
      state('expanded', style({ height: '*' })),
      transition('expanded <=> collapsed', animate('225ms cubic-bezier(0.4, 0.0, 0.2, 1)')),
    ]),
  ],
})
export class StockEntryTableComponent {
  readonly products = input.required<readonly IStockEntryProductFormRow[]>();
  readonly selectedRowIds = input.required<ReadonlySet<string>>();
  readonly warehouses = input.required<readonly IWarehouse[]>();

  readonly selectionChange = output<string>();
  readonly selectAllChange = output<boolean>();
  readonly productChange = output<{ rowId: string; updates: Partial<IStockEntryProductFormRow> }>();
  readonly expandChange = output<string>();
  readonly editClick = output<string>();
  readonly splitClick = output<string>();
  readonly deleteClick = output<string>();

  readonly displayedColumns = [
    'select',
    'expand',
    'designation',
    'quantity',
    'warehouse',
    'price',
    'status',
    'actions',
  ];
  readonly displayedColumnsWithExpand = [...this.displayedColumns, 'expandedDetail'];

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
   * Handles designation change.
   * @param rowId Row ID
   * @param event Input event
   */
  onDesignationChange(rowId: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    this.productChange.emit({ rowId, updates: { designation: input.value || null } });
  }

  /**
   * Handles quantity change.
   * @param rowId Row ID
   * @param warehouseId Warehouse ID to update
   * @param event Input event
   */
  onQuantityChange(rowId: string, warehouseId: string | null, event: Event): void {
    const input = event.target as HTMLInputElement;
    const quantity = parseInt(input.value, 10) || 1;
    const product = this.products().find((p) => p._rowId === rowId);
    if (!product) return;

    if (product.warehouseAllocations.length <= 1) {
      const wId = warehouseId ?? product.warehouseAllocations[0]?.warehouseId ?? '';
      this.productChange.emit({
        rowId,
        updates: { warehouseAllocations: [{ warehouseId: wId, quantity }] },
      });
    }
  }

  /**
   * Handles price change.
   * @param rowId Row ID
   * @param event Input event
   */
  onPriceChange(rowId: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    const price = parseFloat(input.value) || null;
    this.productChange.emit({ rowId, updates: { purchasePriceExclTax: price } });
  }

  /**
   * Handles warehouse change for a single allocation.
   * @param rowId Row ID
   * @param warehouseId New warehouse ID
   */
  onWarehouseChange(rowId: string, warehouseId: number): void {
    const product = this.products().find((p) => p._rowId === rowId);
    if (!product) return;

    const quantity =
      product.warehouseAllocations[0]?.quantity ??
      (calculateTotalQuantity(product.warehouseAllocations) || 1);
    this.productChange.emit({
      rowId,
      updates: {
        warehouseAllocations: [{ warehouseId: String(warehouseId), quantity }],
      },
    });
  }

  /**
   * Toggles expansion of a row.
   * @param rowId Row ID to toggle
   */
  toggleExpand(rowId: string): void {
    this.expandChange.emit(rowId);
  }

  /**
   * Checks if a row is a new product (needs expandable form).
   * @param row Product row
   * @returns True if new product
   */
  isNewProduct(row: IStockEntryProductFormRow): boolean {
    return row.id === null;
  }

  /**
   * Checks if a row is complete.
   * @param row Product row
   * @returns True if complete
   */
  isComplete(row: IStockEntryProductFormRow): boolean {
    return isProductRowComplete(row);
  }

  /**
   * Gets total quantity for a row.
   * @param row Product row
   * @returns Total quantity
   */
  getTotalQuantity(row: IStockEntryProductFormRow): number {
    return calculateTotalQuantity(row.warehouseAllocations);
  }

  /**
   * Handles changes from the expandable row form.
   * @param rowId Row ID
   * @param updates Partial updates
   */
  onRowFormChange(rowId: string, updates: Partial<IStockEntryProductFormRow>): void {
    this.productChange.emit({ rowId, updates });
  }
}
