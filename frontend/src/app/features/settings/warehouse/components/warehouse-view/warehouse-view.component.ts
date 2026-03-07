import { ChangeDetectionStrategy, Component, effect, inject, input } from '@angular/core';
import { WarehouseStore } from '../../warehouse.store';
import { WarehouseFormComponent } from '../warehouse-form/warehouse-form.component';

@Component({
  selector: 'app-warehouse-view',
  imports: [WarehouseFormComponent],
  template: `<app-warehouse-form [warehouseId]="id()" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class WarehouseViewComponent {
  readonly #warehouseStore = inject(WarehouseStore);

  readonly id = input.required<number, string>({ transform: (value) => Number(value) });

  constructor() {
    effect(() => {
      this.#warehouseStore.getWarehouse(this.id());
    });
  }
}
