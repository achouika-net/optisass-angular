import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { Field, FormField, form, maxLength, min, required } from '@angular/forms/signals';
import { AddressSchema } from '@app/validators';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { AddressFieldsComponent, FieldErrorComponent } from '@app/components';
import { ControlLabelDirective } from '@app/directives';
import { createEmptyAddress, IAddress } from '@app/models';
import { TranslateModule } from '@ngx-translate/core';
import { IWarehouse, WAREHOUSE_TYPES, WarehouseType } from '../../models';
import { WarehouseStore } from '../../warehouse.store';

interface IWarehouseForm {
  name: string;
  capacity: number | null;
  address: IAddress;
  type: WarehouseType | null;
  active: boolean;
}

@Component({
  selector: 'app-warehouse-form',
  templateUrl: './warehouse-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslateModule,

    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatRadioModule,
    ControlLabelDirective,
    FieldErrorComponent,
    AddressFieldsComponent,
    FormField,
  ],
})
export class WarehouseFormComponent {
  #warehouseStore = inject(WarehouseStore);

  readonly warehouseId = input<number | null>(null);
  warehouseTypes = signal(WAREHOUSE_TYPES).asReadonly();

  warehouseFormModel = signal<IWarehouseForm>({
    name: '',
    capacity: null,
    address: createEmptyAddress(),
    type: null,
    active: true,
  });

  warehouseForm = form(this.warehouseFormModel, (fieldPath) => {
    required(fieldPath.name);
    maxLength(fieldPath.name, 100);
    required(fieldPath.type);
    min(fieldPath.capacity, 0);
    // Apply address validation schema (required by default)
    AddressSchema(fieldPath.address);
  });

  isEditMode = computed(() => this.warehouseId() !== null);

  constructor() {
    effect(() => {
      const warehouse = this.#warehouseStore.state.warehouse();
      if (warehouse && this.isEditMode()) {
        this.warehouseFormModel.set({
          name: warehouse.name,
          capacity: warehouse.capacity,
          address: warehouse.address ?? createEmptyAddress(),
          type: warehouse.type,
          active: warehouse.active,
        });
      }
    });
  }

  /**
   * Saves the warehouse form data
   */
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

  /**
   * Cancels form editing and navigates back to search
   */
  cancel(): void {
    this.#warehouseStore.goToSearchPage();
  }
}

