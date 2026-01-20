import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatRadioChange, MatRadioModule } from '@angular/material/radio';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ResourceAutocompleteComponent } from '@app/components';
import { FieldControlLabelDirective } from '@app/directives';
import { ISupplier } from '@app/models';
import { TranslateModule } from '@ngx-translate/core';
import { DocumentType } from '../../models';

interface IStockEntryFormModel {
  supplierId: string | null;
  documentNumber: string;
  documentDate: Date;
}

function getDefaultFormModel(): IStockEntryFormModel {
  return {
    supplierId: null,
    documentNumber: '',
    documentDate: new Date(),
  };
}

@Component({
  selector: 'app-stock-entry-form',
  templateUrl: './stock-entry-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FieldControlLabelDirective,
    FormField,
    MatFormFieldModule,
    MatInputModule,
    MatRadioModule,
    MatDatepickerModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    ResourceAutocompleteComponent,
    TranslateModule,
  ],
})
export class StockEntryFormComponent {
  readonly suppliers = input.required<readonly ISupplier[]>();
  readonly selectedSupplierId = input<string | null>(null);
  readonly documentNumber = input<string>('');
  readonly documentDate = input<Date>(new Date());
  readonly documentType = input<DocumentType>('invoice');

  readonly supplierChange = output<ISupplier | null>();
  readonly documentNumberChange = output<string>();
  readonly documentDateChange = output<Date>();
  readonly documentTypeChange = output<DocumentType>();
  readonly newSupplierClick = output<void>();

  readonly #formModel = signal<IStockEntryFormModel>(getDefaultFormModel());

  readonly form = form(this.#formModel);

  readonly supplierOptions = computed(() =>
    this.suppliers().map((s) => ({
      id: s.id,
      code: s.code,
      name: s.name,
      label: s.name,
    })),
  );

  constructor() {
    // Sync external inputs → internal form model (like product-form edit mode)
    effect(() => {
      const supplierId = this.selectedSupplierId();
      const docNumber = this.documentNumber();
      const docDate = this.documentDate();

      untracked(() => {
        this.#formModel.set({
          supplierId,
          documentNumber: docNumber,
          documentDate: docDate,
        });
      });
    });
  }

  /**
   * Handles supplier selection from autocomplete.
   * @param supplierId Selected supplier ID
   */
  onSupplierChange(supplierId: string | null): void {
    if (supplierId === null) {
      this.supplierChange.emit(null);
      return;
    }
    const supplier = this.suppliers().find((s) => s.id === supplierId) ?? null;
    this.supplierChange.emit(supplier);
  }

  /**
   * Opens new supplier dialog.
   */
  openNewSupplierDialog(): void {
    this.newSupplierClick.emit();
  }

  /**
   * Emits document number change.
   */
  onDocumentNumberChange(): void {
    this.documentNumberChange.emit(this.form.documentNumber().value());
  }

  /**
   * Emits document date change.
   */
  onDocumentDateChange(): void {
    this.documentDateChange.emit(this.form.documentDate().value());
  }

  /**
   * Emits document type change.
   * @param event Radio change event
   */
  onDocumentTypeChange(event: MatRadioChange): void {
    const type = event.value as DocumentType;
    this.documentTypeChange.emit(type);
  }
}
