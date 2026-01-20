import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { FieldControlLabelDirective } from '@app/directives';
import { PricingMode, ProductType } from '@app/models';
import { ResourceStore } from '@app/core/store';
import { TranslateModule } from '@ngx-translate/core';
import { IStockEntryProductFormRow } from '../../models';

@Component({
  selector: 'app-stock-entry-row',
  templateUrl: './stock-entry-row.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FieldControlLabelDirective,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatIconModule,
    TranslateModule,
  ],
})
export class StockEntryRowComponent {
  readonly #resourceStore = inject(ResourceStore);

  readonly row = input.required<IStockEntryProductFormRow>();

  readonly rowChange = output<Partial<IStockEntryProductFormRow>>();

  readonly productTypes = this.#resourceStore.productTypes;
  readonly brands = this.#resourceStore.brands;
  readonly models = this.#resourceStore.models;
  readonly pricingModes = this.#resourceStore.pricingModes;
  readonly tvaRates = this.#resourceStore.tvaRates;
  readonly lensTypes = this.#resourceStore.lensTypes;
  readonly lensMaterials = this.#resourceStore.lensMaterials;
  readonly lensIndices = this.#resourceStore.lensIndices;

  readonly isLens = computed(() => this.row().productType === 'lens');

  readonly filteredModels = computed(() => {
    const brandId = this.row().brandId;
    if (!brandId) return [];
    return this.models().filter((m) => m.brandId === brandId);
  });

  readonly showCoefficientField = computed(() => this.row().pricingMode === 'coefficient');
  readonly showFixedAmountField = computed(() => this.row().pricingMode === 'fixedAmount');
  readonly showFixedPriceField = computed(() => this.row().pricingMode === 'fixedPrice');

  /**
   * Handles product type change.
   * @param value New product type
   */
  onProductTypeChange(value: ProductType): void {
    this.rowChange.emit({
      productType: value,
      brandId: null,
      modelId: null,
      lensType: null,
      lensMaterial: null,
      lensRefractiveIndex: null,
    });
  }

  /**
   * Handles brand change.
   * @param value New brand ID
   */
  onBrandChange(value: string): void {
    this.rowChange.emit({ brandId: value, modelId: null });
  }

  /**
   * Handles model change.
   * @param value New model ID
   */
  onModelChange(value: string): void {
    this.rowChange.emit({ modelId: value });
  }

  /**
   * Handles pricing mode change.
   * @param value New pricing mode
   */
  onPricingModeChange(value: PricingMode): void {
    this.rowChange.emit({
      pricingMode: value,
      coefficient: value === 'coefficient' ? 2.5 : null,
      fixedAmount: null,
      fixedPrice: null,
    });
  }

  /**
   * Handles coefficient change.
   * @param event Input event
   */
  onCoefficientChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.rowChange.emit({ coefficient: parseFloat(input.value) || null });
  }

  /**
   * Handles fixed amount change.
   * @param event Input event
   */
  onFixedAmountChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.rowChange.emit({ fixedAmount: parseFloat(input.value) || null });
  }

  /**
   * Handles fixed price change.
   * @param event Input event
   */
  onFixedPriceChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.rowChange.emit({ fixedPrice: parseFloat(input.value) || null });
  }

  /**
   * Handles TVA rate change.
   * @param value New TVA rate
   */
  onTvaRateChange(value: number): void {
    this.rowChange.emit({ tvaRate: value });
  }

  /**
   * Handles alert threshold change.
   * @param event Input event
   */
  onAlertThresholdChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.rowChange.emit({ alertThreshold: parseInt(input.value, 10) || 2 });
  }

  /**
   * Handles lens type change.
   * @param value New lens type
   */
  onLensTypeChange(value: string): void {
    this.rowChange.emit({ lensType: value });
  }

  /**
   * Handles lens material change.
   * @param value New lens material
   */
  onLensMaterialChange(value: string): void {
    this.rowChange.emit({ lensMaterial: value });
  }

  /**
   * Handles lens refractive index change.
   * @param value New refractive index
   */
  onLensRefractiveIndexChange(value: string): void {
    this.rowChange.emit({ lensRefractiveIndex: value });
  }
}
