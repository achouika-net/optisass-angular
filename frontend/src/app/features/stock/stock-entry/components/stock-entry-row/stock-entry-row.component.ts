import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { FieldTree, FormField } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { FieldControlLabelDirective } from '@app/directives';
import { FieldErrorComponent } from '@app/components';
import { FrameSubType, PricingMode, ProductType } from '@app/models';
import { ResourceStore } from '@app/core/store';
import { TranslateModule } from '@ngx-translate/core';
import { IWarehouse } from '../../../../settings/warehouse/models/warehouse.model';
import { IStockEntryProductFormRow } from '../../models';

@Component({
  selector: 'app-stock-entry-row',
  templateUrl: './stock-entry-row.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormField,
    FieldControlLabelDirective,
    FieldErrorComponent,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatIconModule,
    TranslateModule,
  ],
})
export class StockEntryRowComponent {
  readonly #resourceStore = inject(ResourceStore);

  readonly rowFields = input.required<FieldTree<IStockEntryProductFormRow>>();
  readonly warehouses = input.required<readonly IWarehouse[]>();

  readonly splitClick = output<void>();
  readonly nextErrorClick = output<void>();

  readonly productTypes = this.#resourceStore.productTypes;
  readonly brands = this.#resourceStore.brands;
  readonly models = this.#resourceStore.models;
  readonly pricingModes = this.#resourceStore.pricingModes;
  readonly tvaRates = this.#resourceStore.tvaRates;
  readonly lensTypes = this.#resourceStore.lensTypes;
  readonly lensMaterials = this.#resourceStore.lensMaterials;
  readonly lensIndices = this.#resourceStore.lensIndices;
  readonly frameSubTypes = this.#resourceStore.frameSubTypes;
  readonly clipOnTypes = this.#resourceStore.clipOnTypes;
  readonly safetyStandards = this.#resourceStore.safetyStandards;
  readonly safetyRatings = this.#resourceStore.safetyRatings;
  readonly protectionTypes = this.#resourceStore.protectionTypes;
  readonly contactLensTypes = this.#resourceStore.contactLensTypes;
  readonly contactLensUsages = this.#resourceStore.contactLensUsages;
  readonly laboratories = this.#resourceStore.laboratories;
  readonly accessoryCategories = this.#resourceStore.accessoryCategories;

  readonly warehouseAllocations = computed(() => this.rowFields().warehouseAllocations().value());

  readonly productType = computed(() => this.rowFields().productType().value());
  readonly brandId = computed(() => this.rowFields().brandId().value());
  readonly pricingMode = computed(() => this.rowFields().pricingMode().value());
  readonly frameSubType = computed(() => this.rowFields().frameSubType().value());

  readonly isFrame = computed(() => this.productType() === 'frame');
  readonly isLens = computed(() => this.productType() === 'lens');
  readonly isContactLens = computed(() => this.productType() === 'contact_lens');
  readonly isClipOn = computed(() => this.productType() === 'clip_on');
  readonly isAccessory = computed(() => this.productType() === 'accessory');
  readonly isSafetyFrame = computed(() => this.isFrame() && this.frameSubType() === 'safety');

  readonly filteredModels = computed(() => {
    const brandId = this.brandId();
    if (!brandId) return [];
    return this.models().filter((m) => m.brandId === brandId);
  });

  readonly showCoefficientField = computed(() => this.pricingMode() === 'coefficient');
  readonly showFixedAmountField = computed(() => this.pricingMode() === 'fixedAmount');
  readonly showFixedPriceField = computed(() => this.pricingMode() === 'fixedPrice');

  /**
   * Handles product type change and resets related fields.
   * @param value New product type
   */
  onProductTypeChange(value: ProductType): void {
    const fields = this.rowFields();
    fields.productType().value.set(value);
    fields.brandId().value.set(null);
    fields.modelId().value.set(null);

    // Reset frame fields
    fields.frameSubType().value.set(null);
    fields.safetySafetyStandard().value.set(null);
    fields.safetySafetyRating().value.set(null);
    fields.safetyProtectionType().value.set(null);
    fields.safetyLensIncluded().value.set(false);
    fields.safetyPrescriptionCapable().value.set(false);

    // Reset lens fields
    fields.lensType().value.set(null);
    fields.lensMaterial().value.set(null);
    fields.lensRefractiveIndex().value.set(null);

    // Reset contact lens fields
    fields.contactLensType().value.set(null);
    fields.contactLensLaboratoryId().value.set(null);

    // Reset clip-on fields
    fields.clipOnClipType().value.set(null);
    fields.clipOnPolarized().value.set(false);
    fields.clipOnMirrorCoating().value.set(false);
    fields.clipOnTint().value.set(null);

    // Reset accessory fields
    fields.accessoryCategory().value.set(null);
  }

  /**
   * Handles frame sub-type change and resets safety fields if needed.
   * @param value New frame sub-type
   */
  onFrameSubTypeChange(value: FrameSubType): void {
    const fields = this.rowFields();
    fields.frameSubType().value.set(value);

    if (value !== 'safety') {
      fields.safetySafetyStandard().value.set(null);
      fields.safetySafetyRating().value.set(null);
      fields.safetyProtectionType().value.set(null);
      fields.safetyLensIncluded().value.set(false);
      fields.safetyPrescriptionCapable().value.set(false);
    }
  }

  /**
   * Handles brand change and resets model.
   * @param value New brand ID
   */
  onBrandChange(value: string): void {
    const fields = this.rowFields();
    fields.brandId().value.set(value);
    fields.modelId().value.set(null);
  }

  /**
   * Handles pricing mode change and resets related fields.
   * @param value New pricing mode
   */
  onPricingModeChange(value: PricingMode): void {
    const fields = this.rowFields();
    fields.pricingMode().value.set(value);
    fields.coefficient().value.set(value === 'coefficient' ? 2.5 : null);
    fields.fixedAmount().value.set(null);
    fields.fixedPrice().value.set(null);
  }

  /**
   * Handles warehouse change via Signal Forms.
   * @param warehouseId New warehouse ID
   */
  onWarehouseChange(warehouseId: string): void {
    const allocations = this.warehouseAllocations();
    const qty = allocations[0]?.quantity ?? 1;
    this.rowFields()
      .warehouseAllocations()
      .value.set([{ warehouseId, quantity: qty }]);
  }
}
