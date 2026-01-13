import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { Field, form, FormField, max, min, required } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatRadioModule } from '@angular/material/radio';
import { MatStepperModule } from '@angular/material/stepper';
import { StepperSelectionEvent } from '@angular/cdk/stepper';
import {
  FieldErrorComponent,
  PhotoUploadComponent,
  ResourceAutocompleteComponent,
} from '@app/components';
import { FieldControlLabelDirective } from '@app/directives';
import { PricingMode, ProductType } from '@app/models';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ResourceStore } from '@app/core/store';
import { ToastrService } from 'ngx-toastr';
import {
  getDefaultProductForm,
  getTypeSpecificDefaults,
  IProductForm,
  toProductCreateRequest,
  toProductForm,
  toProductUpdateRequest,
} from '../../models';
import { ProductStore } from '../../product.store';

@Component({
  selector: 'app-product-form',
  templateUrl: './product-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgTemplateOutlet,
    Field,
    FormField,
    TranslateModule,
    MatButtonModule,
    MatExpansionModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatRadioModule,
    MatIconModule,
    MatTooltipModule,
    MatStepperModule,
    FieldControlLabelDirective,
    FieldErrorComponent,
    PhotoUploadComponent,
    ResourceAutocompleteComponent,
  ],
})
export class ProductFormComponent {
  readonly #resourceStore = inject(ResourceStore);
  readonly #productStore = inject(ProductStore);
  readonly #toastr = inject(ToastrService);
  readonly #translate = inject(TranslateService);

  readonly #product = this.#productStore.state.product;

  readonly #formModel = signal<IProductForm>(getDefaultProductForm());

  readonly form = form(this.#formModel, (fieldPath) => {
    interface FieldContext {
      valueOf: (path: typeof fieldPath.productType) => ProductType | null;
    }
    interface PricingContext {
      valueOf: (path: typeof fieldPath.pricingMode) => PricingMode | null;
    }
    const isLens = (ctx: FieldContext) => ctx.valueOf(fieldPath.productType) === 'lens';
    const isNotLens = (ctx: FieldContext) => {
      const type = ctx.valueOf(fieldPath.productType);
      return type !== null && type !== 'lens';
    };
    const isCoefficient = (ctx: PricingContext) =>
      ctx.valueOf(fieldPath.pricingMode) === 'coefficient';
    const isFixedAmount = (ctx: PricingContext) =>
      ctx.valueOf(fieldPath.pricingMode) === 'fixedAmount';
    const isFixedPrice = (ctx: PricingContext) =>
      ctx.valueOf(fieldPath.pricingMode) === 'fixedPrice';
    // Common required fields for all product types
    required(fieldPath.productType);
    required(fieldPath.supplierIds);
    required(fieldPath.purchasePriceExclTax);
    required(fieldPath.pricingMode);
    required(fieldPath.tvaRate);
    min(fieldPath.tvaRate, 0);
    max(fieldPath.tvaRate, 1);
    required(fieldPath.alertThreshold);
    min(fieldPath.alertThreshold, 0);
    // Conditional pricing fields based on mode
    required(fieldPath.coefficient, { when: isCoefficient });
    min(fieldPath.coefficient, 0);
    required(fieldPath.fixedAmount, { when: isFixedAmount });
    min(fieldPath.fixedAmount, 0);
    required(fieldPath.fixedPrice, { when: isFixedPrice });
    min(fieldPath.fixedPrice, 0);
    // Required fields for all except lenses (frames + accessories + contact lenses)
    required(fieldPath.brandId, { when: isNotLens });
    required(fieldPath.modelId, { when: isNotLens });
    // Required fields for lenses only
    required(fieldPath.lensType, { when: isLens });
    required(fieldPath.lensMaterial, { when: isLens });
    required(fieldPath.lensRefractiveIndex, { when: isLens });
  });

  readonly productTypes = this.#resourceStore.productTypes;
  readonly brands = this.#resourceStore.brands;
  readonly models = this.#resourceStore.models;
  readonly families = this.#resourceStore.families;
  readonly subFamilies = this.#resourceStore.subFamilies;
  readonly colors = this.#resourceStore.colors;
  readonly genders = this.#resourceStore.genders;
  readonly frameShapes = this.#resourceStore.frameShapes;
  readonly frameMaterials = this.#resourceStore.frameMaterials;
  readonly frameTypes = this.#resourceStore.frameTypes;
  readonly hingeTypes = this.#resourceStore.hingeTypes;
  readonly lensTypes = this.#resourceStore.lensTypes;
  readonly lensMaterials = this.#resourceStore.lensMaterials;
  readonly lensTints = this.#resourceStore.lensTints;
  readonly lensFilters = this.#resourceStore.lensFilters;
  readonly lensTreatments = this.#resourceStore.lensTreatments;
  readonly lensIndices = this.#resourceStore.lensIndices;
  readonly contactLensTypes = this.#resourceStore.contactLensTypes;
  readonly contactLensUsages = this.#resourceStore.contactLensUsages;
  readonly accessoryCategories = this.#resourceStore.accessoryCategories;
  readonly manufacturers = this.#resourceStore.manufacturers;
  readonly laboratories = this.#resourceStore.laboratories;
  readonly suppliers = this.#resourceStore.suppliers;
  readonly tvaRates = this.#resourceStore.tvaRates;
  readonly pricingModes = this.#resourceStore.pricingModes;

  readonly selectedProductType = computed(
    () => this.form.productType().value() as ProductType | null,
  );
  readonly selectedPricingMode = computed(() => this.form.pricingMode().value() as PricingMode);

  readonly isEditMode = this.#productStore.isEditMode;
  readonly isCreateMode = computed(() => !this.isEditMode());

  readonly showFrameFields = computed(() => {
    const type = this.selectedProductType();
    return type === 'optical_frame' || type === 'sun_frame';
  });
  readonly showLensFields = computed(() => this.selectedProductType() === 'lens');
  readonly showContactLensFields = computed(() => this.selectedProductType() === 'contact_lens');
  readonly showAccessoryFields = computed(() => this.selectedProductType() === 'accessory');

  readonly showBrandModelDesignation = computed(() => this.selectedProductType() !== 'lens');
  readonly showMainPhoto = computed(() => this.selectedProductType() !== 'lens');

  readonly showCoefficient = computed(() => this.selectedPricingMode() === 'coefficient');
  readonly showFixedAmount = computed(() => this.selectedPricingMode() === 'fixedAmount');
  readonly showFixedPrice = computed(() => this.selectedPricingMode() === 'fixedPrice');

  readonly filteredModels = computed(() => {
    const brandId = this.form.brandId().value();
    if (!brandId) return [];
    return this.models().filter((m) => m.brandId === brandId);
  });

  readonly filteredSubFamilies = computed(() => {
    const familyId = this.form.familyId().value();
    if (!familyId) return [];
    return this.subFamilies().filter((sf) => sf.familyId === familyId);
  });

  readonly fixedPriceWarning = computed(() => {
    const fixedPrice = Number(this.form.fixedPrice().value());
    const purchasePrice = Number(this.form.purchasePriceExclTax().value());
    if (!isNaN(fixedPrice) && !isNaN(purchasePrice) && fixedPrice > 0 && purchasePrice > 0) {
      return fixedPrice < purchasePrice;
    }
    return false;
  });

  readonly currentStep = signal(0);
  readonly isStep1Valid = computed(() => {
    if (!this.selectedProductType()) return false;
    if (this.form.supplierIds().invalid()) return false;
    if (this.showBrandModelDesignation()) {
      if (this.form.brandId().invalid() || this.form.modelId().invalid()) return false;
    }
    return true;
  });
  readonly isStep2Valid = computed(() => {
    const productType = this.selectedProductType();
    if (!productType) return false;

    if (this.showLensFields()) {
      return (
        !this.form.lensType().invalid() &&
        !this.form.lensMaterial().invalid() &&
        !this.form.lensRefractiveIndex().invalid()
      );
    }
    return true;
  });

  constructor() {
    // Populates the form with product data in edit mode
    effect(() => {
      const productData = this.#product();
      console.log('Product data changed:', productData);
      untracked(() => {
        if (productData) {
          this.#formModel.set(toProductForm(productData));
        }
      });
    });

    // Resets model when brand changes
    effect(() => {
      this.form.brandId().value();
      untracked(() => this.form.modelId().value.set(null));
    });

    // Resets sub-family when family changes
    effect(() => {
      this.form.familyId().value();
      untracked(() => this.form.subFamilyId().value.set(null));
    });

    // Resets type-specific fields when product type changes (create mode only)
    effect(() => {
      this.form.productType().value();
      untracked(() => {
        if (this.isCreateMode()) {
          this.#resetTypeSpecificFields();
        }
      });
    });

    // Shows warning if fixed price is lower than purchase price
    effect(() => {
      const showWarning = this.fixedPriceWarning();
      untracked(() => {
        if (showWarning) {
          this.#toastr.warning(this.#translate.instant('stock.form.fixedPriceWarning'));
        }
      });
    });
  }

  /**
   * Handles stepper step change.
   * @param event Stepper selection event
   */
  setStep(event: StepperSelectionEvent): void {
    this.currentStep.set(event.selectedIndex);
  }

  /**
   * Submits the form if valid.
   */
  submit(): void {
    if (this.form().invalid()) {
      return;
    }

    const formData = this.#formModel();
    const product = this.#product();

    if (product?.id) {
      const request = toProductUpdateRequest(product.id, formData);
      this.#productStore.updateProduct({ id: product.id, request });
    } else {
      const request = toProductCreateRequest(formData);
      this.#productStore.addProduct(request);
    }
  }

  /**
   * Cancels editing and returns to the list.
   */
  onCancel(): void {
    this.#productStore.goToSearchPage();
  }

  /**
   * Resets type-specific fields to their defaults.
   */
  #resetTypeSpecificFields(): void {
    this.#formModel.update((current) => ({
      ...current,
      ...getTypeSpecificDefaults(),
    }));
  }
}
