import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { FieldControlLabelDirective } from '@app/directives';
import { ResourceStore } from '@app/core/store';
import { IWarehouse } from '../../../../settings/warehouse/models/warehouse.model';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-stock-entry-actions',
  templateUrl: './stock-entry-actions.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FieldControlLabelDirective,
    MatButtonModule,
    MatFormFieldModule,
    MatSelectModule,
    TranslateModule,
  ],
})
export class StockEntryActionsComponent {
  readonly #resourceStore = inject(ResourceStore);

  readonly selectedCount = input.required<number>();
  readonly warehouses = input.required<readonly IWarehouse[]>();

  readonly warehouseChange = output<string>();
  readonly tvaChange = output<number>();

  readonly tvaRates = this.#resourceStore.tvaRates;

  /**
   * Applies bulk actions for warehouse and/or TVA.
   * @param warehouseId Selected warehouse ID
   * @param tvaRate Selected TVA rate value
   */
  onApply(warehouseId: string | null, tvaRate: number | null): void {
    if (warehouseId) {
      this.warehouseChange.emit(warehouseId);
    }
    if (tvaRate !== null && tvaRate !== undefined) {
      this.tvaChange.emit(tvaRate);
    }
  }
}
