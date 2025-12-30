import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { Field, form, maxLength, min, required } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { AddressAutocompleteComponent, FieldErrorComponent } from '@app/components';
import { FieldControlLabelDirective } from '@app/directives';
import { TranslateModule } from '@ngx-translate/core';
import { IWarehouse, WAREHOUSE_TYPES, WarehouseType } from '../../models';
import { WarehouseStore } from '../../warehouse.store';

interface IWarehouseForm {
  name: string;
  capacity: number | null;
  address: string | null;
  type: WarehouseType | null;
  active: boolean;
}

@Component({
  selector: 'app-warehouse-form',
  templateUrl: './warehouse-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslateModule,
    Field,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatRadioModule,
    FieldControlLabelDirective,
    FieldErrorComponent,
    AddressAutocompleteComponent,
  ],
})
export class WarehouseFormComponent {
  #warehouseStore = inject(WarehouseStore);

  readonly warehouseId = input<number | null>(null);
  warehouseTypes = signal(WAREHOUSE_TYPES).asReadonly();

  warehouseFormModel = signal<IWarehouseForm>({
    name: '',
    capacity: null,
    address: null,
    type: null,
    active: true,
  });

  warehouseForm = form(this.warehouseFormModel, (fieldPath) => {
    required(fieldPath.name);
    maxLength(fieldPath.name, 100);
    required(fieldPath.type);
    min(fieldPath.capacity, 0);
  });

  isEditMode = computed(() => this.warehouseId() !== null);

  constructor() {
    effect(() => {
      const warehouse = this.#warehouseStore.state.warehouse();
      if (warehouse && this.isEditMode()) {
        this.warehouseFormModel.set({
          name: warehouse.name,
          capacity: warehouse.capacity,
          address: warehouse.address,
          type: warehouse.type,
          active: warehouse.active,
        });
      }
    });
  }

  save(): void {
    if (this.warehouseForm().invalid()) {
      return;
    }

    const formValue = this.warehouseFormModel();
    const warehouseData: Omit<IWarehouse, 'id'> = {
      name: formValue.name,
      capacity: formValue.capacity,
      address: formValue.address,
      type: formValue.type!,
      active: formValue.active,
    };

    if (this.isEditMode()) {
      this.#warehouseStore.updateWarehouse({
        id: this.warehouseId()!,
        warehouse: warehouseData,
      });
    } else {
      this.#warehouseStore.addWarehouse(warehouseData);
    }
  }

  cancel(): void {
    this.#warehouseStore.goToSearchPage();
  }
}
