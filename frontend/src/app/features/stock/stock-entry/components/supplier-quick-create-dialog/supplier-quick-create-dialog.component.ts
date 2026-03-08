import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { form, FormField, required } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { AddressFieldsComponent, FieldErrorComponent } from '@app/components';
import { ControlLabelDirective } from '@app/directives';
import { createEmptyAddress, createEmptySupplier, IAddress, ISupplier } from '@app/models';
import { TranslateModule } from '@ngx-translate/core';

interface ISupplierQuickCreateForm {
  readonly name: string;
  readonly email: string;
  readonly phone: string;
  readonly address: IAddress;
}

function getDefaultForm(): ISupplierQuickCreateForm {
  return {
    name: '',
    email: '',
    phone: '',
    address: createEmptyAddress(),
  };
}

@Component({
  selector: 'app-supplier-quick-create-dialog',
  templateUrl: './supplier-quick-create-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormField,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    TranslateModule,
    ControlLabelDirective,
    FieldErrorComponent,
    AddressFieldsComponent,
  ],
})
export class SupplierQuickCreateDialogComponent {
  readonly #dialogRef = inject(MatDialogRef<SupplierQuickCreateDialogComponent, ISupplier | null>);

  readonly #formModel = signal<ISupplierQuickCreateForm>(getDefaultForm());

  readonly formState = form(this.#formModel, (fp: any) => {
    required(fp.name);
    required(fp.address.street);
    required(fp.address.city);
  });

  readonly isValid = computed(() => !this.formState().invalid());

  /**
   * Confirms and closes with result.
   */
  confirm(): void {
    if (!this.isValid()) return;

    const model = this.#formModel();
    const result: ISupplier = {
      ...createEmptySupplier(),
      name: model.name.trim(),
      address: {
        ...model.address,
        country: model.address.country ?? 'Maroc',
      },
      email: model.email.trim() || null,
      phone: model.phone.trim() || null,
    };

    this.#dialogRef.close(result);
  }

  /**
   * Cancels and closes without result.
   */
  cancel(): void {
    this.#dialogRef.close(null);
  }
}
