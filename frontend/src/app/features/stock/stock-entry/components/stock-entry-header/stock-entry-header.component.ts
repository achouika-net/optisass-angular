import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FieldTree, FormField } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatRadioChange, MatRadioModule } from '@angular/material/radio';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FieldErrorComponent, ResourceAutocompleteComponent } from '@app/components';
import { FieldControlLabelDirective } from '@app/directives';
import { createEmptySupplier, ISupplier } from '@app/models';
import { TranslateModule } from '@ngx-translate/core';
import { DocumentType } from '../../models';

@Component({
  selector: 'app-stock-entry-header',
  templateUrl: './stock-entry-header.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DecimalPipe,
    FieldControlLabelDirective,
    FieldErrorComponent,
    FormField,
    MatButtonModule,
    MatCardModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatRadioModule,
    MatTooltipModule,
    ResourceAutocompleteComponent,
    TranslateModule,
  ],
})
export class StockEntryHeaderComponent {
  readonly suppliers = input.required<readonly ISupplier[]>();
  readonly supplierField = input.required<FieldTree<ISupplier>>();
  readonly documentNumberField = input.required<FieldTree<string>>();
  readonly documentDateField = input.required<FieldTree<Date>>();
  readonly documentTypeField = input.required<FieldTree<DocumentType>>();
  readonly totalHT = input.required<number>();

  readonly newSupplierClick = output<void>();

  readonly supplierOptions = computed(() =>
    this.suppliers().map((s) => ({
      id: s.id,
      code: s.code,
      name: s.name,
      label: s.name,
    })),
  );

  readonly currentSupplierId = computed(() => this.supplierField()().value().id);
  readonly documentType = computed(() => this.documentTypeField()().value());

  /**
   * Handles supplier selection from autocomplete.
   * Updates the supplier FieldTree directly.
   * @param supplierId Selected supplier ID or null
   */
  onSupplierChange(supplierId: string | null): void {
    if (supplierId === null) {
      this.supplierField()().value.set(createEmptySupplier());
      return;
    }
    const supplier = this.suppliers().find((s) => s.id === supplierId);
    if (supplier) {
      this.supplierField()().value.set(supplier);
    }
  }

  /**
   * Handles document type change.
   * Updates the documentType FieldTree directly.
   * @param event Radio change event
   */
  onDocumentTypeChange(event: MatRadioChange): void {
    const type = event.value as DocumentType;
    this.documentTypeField()().value.set(type);
  }
}
