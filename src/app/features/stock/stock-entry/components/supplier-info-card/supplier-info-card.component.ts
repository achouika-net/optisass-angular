import {
  ChangeDetectionStrategy,
  Component,
  effect,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { disabled, form, FormField, required } from '@angular/forms/signals';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { AddressFieldsComponent } from '@app/components';
import { FieldControlLabelDirective } from '@app/directives';
import { createEmptyAddress, IAddress, ISupplier } from '@app/models';
import { TranslateModule } from '@ngx-translate/core';

interface ISupplierInfoForm {
  name: string;
  address: IAddress;
  phone: string | null;
  email: string | null;
  ice: string | null;
  taxId: string | null;
  tradeRegister: string | null;
  siret: string | null;
}

/**
 * Maps ISupplier to form model.
 * @param supplier Supplier to convert
 * @returns Form model
 */
function toSupplierInfoForm(supplier: ISupplier): ISupplierInfoForm {
  return {
    name: supplier.name,
    address: supplier.address ?? createEmptyAddress(),
    phone: supplier.phone,
    email: supplier.email,
    ice: supplier.ice,
    taxId: supplier.taxId,
    tradeRegister: supplier.tradeRegister,
    siret: supplier.siret,
  };
}

/**
 * Creates default form model.
 * @returns Default form model with empty values
 */
function getDefaultSupplierInfoForm(): ISupplierInfoForm {
  return {
    name: '',
    address: createEmptyAddress(),
    phone: null,
    email: null,
    ice: null,
    taxId: null,
    tradeRegister: null,
    siret: null,
  };
}

@Component({
  selector: 'app-supplier-info-card',
  templateUrl: './supplier-info-card.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AddressFieldsComponent,
    FieldControlLabelDirective,
    FormField,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    TranslateModule,
  ],
})
export class SupplierInfoCardComponent {
  readonly supplier = input.required<ISupplier>();
  readonly disabled = input<boolean>(false);
  readonly supplierChange = output<ISupplier>();

  readonly #formModel = signal<ISupplierInfoForm>(getDefaultSupplierInfoForm());

  readonly form = form(this.#formModel, (f) => {
    required(f.name);
    disabled(f.name, () => this.disabled());
    disabled(f.address, () => this.disabled());
    disabled(f.phone, () => this.disabled());
    disabled(f.email, () => this.disabled());
    disabled(f.ice, () => this.disabled());
    disabled(f.taxId, () => this.disabled());
    disabled(f.tradeRegister, () => this.disabled());
    disabled(f.siret, () => this.disabled());
  });

  constructor() {
    effect(() => {
      const supplier = this.supplier();
      untracked(() => {
        this.#formModel.set(toSupplierInfoForm(supplier));
      });
    });
  }

  /**
   * Emits supplier changes when a form field loses focus.
   * @param field The field that changed
   */
  onFieldBlur(field: keyof Omit<ISupplierInfoForm, 'address'>): void {
    if (this.disabled()) return;

    const formValue = this.#formModel();
    const updatedSupplier: ISupplier = {
      ...this.supplier(),
      [field]: formValue[field] || null,
    };
    this.supplierChange.emit(updatedSupplier);
  }

  /**
   * Emits supplier changes when address changes.
   */
  onAddressChange(): void {
    if (this.disabled()) return;

    const formValue = this.#formModel();
    const updatedSupplier: ISupplier = {
      ...this.supplier(),
      address: formValue.address,
    };
    this.supplierChange.emit(updatedSupplier);
  }
}
