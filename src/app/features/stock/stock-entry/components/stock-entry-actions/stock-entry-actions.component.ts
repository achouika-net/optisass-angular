import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { FieldTree } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ResourceStore } from '@app/core/store';
import { TranslateModule } from '@ngx-translate/core';
import { IWarehouse } from '../../../../settings/warehouse/models/warehouse.model';
import { IStockEntryProductFormRow } from '../../models';

@Component({
  selector: 'app-stock-entry-actions',
  templateUrl: './stock-entry-actions.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatSelectModule,
    MatTooltipModule,
    TranslateModule,
  ],
})
export class StockEntryActionsComponent {
  readonly #resourceStore = inject(ResourceStore);

  readonly selectedCount = input.required<number>();
  readonly selectedRowIds = input.required<ReadonlySet<string>>();
  readonly products = input.required<readonly IStockEntryProductFormRow[]>();
  readonly warehouses = input.required<readonly IWarehouse[]>();
  readonly getProductFields =
    input.required<(index: number) => FieldTree<IStockEntryProductFormRow> | undefined>();

  readonly deleteSelected = output<void>();

  readonly tvaRates = this.#resourceStore.tvaRates;

  readonly #rowIdToIndex = computed(() => {
    const map = new Map<string, number>();
    this.products().forEach((p, i) => map.set(p._rowId, i));
    return map;
  });

  /**
   * Applies warehouse to all selected products via FieldTree.
   * @param warehouseId Target warehouse ID
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
      const totalQty = allocations.reduce((sum, a) => sum + a.quantity, 0);

      fields.warehouseAllocations().value.set([{ warehouseId, quantity: totalQty }]);
    }
  }

  /**
   * Applies TVA rate to all selected products via FieldTree.
   * @param tvaRate TVA rate (e.g., 0.20 for 20%)
   */
  applyTva(tvaRate: number): void {
    const selectedIds = this.selectedRowIds();
    const getter = this.getProductFields();

    for (const rowId of selectedIds) {
      const index = this.#rowIdToIndex().get(rowId);
      if (index === undefined) continue;

      const fields = getter(index);
      if (!fields) continue;

      fields.tvaRate().value.set(tvaRate);
    }
  }

  /**
   * Applies selected bulk values.
   * @param warehouseId Warehouse ID or null
   * @param tvaRate TVA rate or null
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
