import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { form, FormField, required } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { AddressFieldsComponent, FieldErrorComponent } from '@app/components';
import { FieldControlLabelDirective } from '@app/directives';
import { createEmptyAddress, createEmptySupplier, IAddress, ISupplier } from '@app/models';
import { TranslateModule } from '@ngx-translate/core';

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
    FieldControlLabelDirective,
    FieldErrorComponent,
    AddressFieldsComponent,
  ],
})
export class SupplierQuickCreateDialogComponent {
  readonly #dialogRef = inject(MatDialogRef<SupplierQuickCreateDialogComponent, ISupplier | null>);

  readonly #name = signal<string>('');
  readonly #email = signal<string>('');
  readonly #phone = signal<string>('');
  readonly #address = signal<IAddress>(createEmptyAddress());

  readonly nameForm = form(this.#name, (s) => {
    required(s);
  });

  readonly emailForm = form(this.#email);

  readonly phoneForm = form(this.#phone);

  readonly addressForm = form(this.#address, (s) => {
    required(s.street);
    required(s.city);
  });

  /**
   * Checks if the form is valid.
   * @returns True if valid
   */
  isValid(): boolean {
    const name = this.#name();
    const address = this.#address();
    return !!name.trim() && !!address.street?.trim() && !!address.city?.trim();
  }

  /**
   * Confirms and closes with result.
   */
  confirm(): void {
    if (!this.isValid()) return;

    const address = this.#address();
    const result: ISupplier = {
      ...createEmptySupplier(),
      name: this.#name().trim(),
      address: {
        ...address,
        country: address.country ?? 'Maroc',
      },
      email: this.#email().trim() || null,
      phone: this.#phone().trim() || null,
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
