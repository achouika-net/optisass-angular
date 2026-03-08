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
import { Field, form, FormField, max, required, disabled } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatRadioModule } from '@angular/material/radio';
import { MatStepperModule } from '@angular/material/stepper';
import { MatTableModule } from '@angular/material/table';
import { StepperSelectionEvent } from '@angular/cdk/stepper';
import {
  FieldErrorComponent,
  PhotoUploadComponent,
  ResourceAutocompleteComponent,
} from '@app/components';
import { ControlLabelDirective } from '@app/directives';
import { FrameSubType, PricingMode, ProductType, resetTypeSpecificFields } from '@app/models';
import { createProductSchemaHelpers, productSchema } from '@app/validators';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ResourceStore } from '@app/core/store';
import { ToastrService } from 'ngx-toastr';
import {
  getDefaultProductForm,
  IProductForm,
  ISupplierProductCodeForm,
  toProductCreateRequest,
  toProductForm,
  toProductUpdateRequest,
} from '@app/models';
import { ProductStore } from '../../product.store';

@Component({
  selector: 'app-product-form',
  templateUrl: './product-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgTemplateOutlet,

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
    MatTableModule,
    ControlLabelDirective,
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

  readonly form: any = form(this.#formModel, (fp) => {
    const fieldPath = fp as any;
    // Use shared product schema
    const helpers = createProductSchemaHelpers(fieldPath);
    productSchema(fieldPath, helpers);

    // Product-form specific validators
    required(fieldPath.supplierIds);
    required(fieldPath.purchasePriceExclTax);
    max(fieldPath.tvaRate, 1);

    // Disable productType field in edit mode
    disabled(fieldPath.productType, () => this.isEditMode());
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
  readonly clipOnTypes = this.#resourceStore.clipOnTypes;
  readonly safetyStandards = this.#resourceStore.safetyStandards;
  readonly safetyRatings = this.#resourceStore.safetyRatings;
  readonly protectionTypes = this.#resourceStore.protectionTypes;
  readonly accessoryCategories = this.#resourceStore.accessoryCategories;
  readonly frameSubTypes = this.#resourceStore.frameSubTypes;
  readonly manufacturers = this.#resourceStore.manufacturers;
  readonly laboratories = this.#resourceStore.laboratories;
  readonly suppliers = this.#resourceStore.suppliers;
  readonly tvaRates = this.#resourceStore.tvaRates;
  readonly pricingModes = this.#resourceStore.pricingModes;

  readonly selectedProductType = computed(
    () => this.form.productType().value() as ProductType | null,
  );
  readonly selectedFrameSubType = computed(
    () => this.form.frameSubType().value() as FrameSubType | null,
  );
  readonly selectedPricingMode = computed(() => this.form.pricingMode().value() as PricingMode);

  readonly isEditMode = this.#productStore.isEditMode;

  readonly showFrameFields = computed(() => {
    const type = this.selectedProductType();
    return type === 'frame';
  });
  readonly showSafetyFields = computed(() => {
    return this.showFrameFields() && this.selectedFrameSubType() === 'safety';
  });
  readonly showLensFields = computed(() => this.selectedProductType() === 'lens');
  readonly showContactLensFields = computed(() => this.selectedProductType() === 'contact_lens');
  readonly showClipOnFields = computed(() => this.selectedProductType() === 'clip_on');
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

  readonly supplierCodes = computed(() => this.#formModel().supplierCodes);
  readonly supplierCodesColumns: string[] = [
    'supplier',
    'code',
    'lastPrice',
    'lastDate',
    'actions',
  ];

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

    if (this.showFrameFields()) {
      return !this.form.frameSubType().invalid();
    }
    if (this.showLensFields()) {
      return !this.form.lensType().invalid();
    }
    if (this.showContactLensFields()) {
      return (
        !this.form.contactLensType().invalid() && !this.form.contactLensLaboratoryId().invalid()
      );
    }
    if (this.showClipOnFields()) {
      return !this.form.clipOnClipType().invalid();
    }
    if (this.showAccessoryFields()) {
      return !this.form.accessoryCategory().invalid();
    }
    return true;
  });

  constructor() {
    // Populates the form with product data in edit mode only
    effect(() => {
      const productData = this.#product();
      untracked(() => {
        if (productData && this.isEditMode()) {
          this.#formModel.set(toProductForm(productData));
        }
      });
    });

    // Resets type-specific fields when product type changes (create mode only)
    effect(() => {
      this.form.productType().value();
      untracked(() => {
        if (!this.isEditMode()) {
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
   * Resets model when brand changes.
   */
  onBrandChange(): void {
    this.form.modelId().value.set(null);
  }

  /**
   * Resets sub-family when family changes.
   */
  onFamilyChange(): void {
    this.form.subFamilyId().value.set(null);
  }

  /**
   * Resets type-specific fields to their defaults.
   */
  #resetTypeSpecificFields(): void {
    this.#formModel.update((current) => resetTypeSpecificFields(current));
  }

  /**
   * Adds a new empty supplier code to the list.
   */
  addSupplierCode(): void {
    const newCode: ISupplierProductCodeForm = {
      supplierId: null,
      code: '',
    };
    this.#formModel.update((current) => ({
      ...current,
      supplierCodes: [...current.supplierCodes, newCode],
    }));
  }

  /**
   * Removes a supplier code at the given index.
   * @param index The index of the supplier code to remove
   */
  removeSupplierCode(index: number): void {
    this.#formModel.update((current) => ({
      ...current,
      supplierCodes: current.supplierCodes.filter((_: any, i: number) => i !== index),
    }));
  }

  /**
   * Updates a supplier code at the given index.
   * @param index The index of the supplier code to update
   * @param field The field to update
   * @param value The new value
   */
  updateSupplierCode(
    index: number,
    field: keyof ISupplierProductCodeForm,
    value: string | null,
  ): void {
    this.#formModel.update((current) => ({
      ...current,
      supplierCodes: current.supplierCodes.map((sc: any, i: number) =>
        i === index ? { ...sc, [field]: value } : sc,
      ),
    }));
  }

  /**
   * Gets the supplier name for a given supplier ID.
   * @param supplierId The supplier ID
   * @returns The supplier name or empty string
   */
  getSupplierName(supplierId: string | null): string {
    if (!supplierId) return '';
    const supplier = this.suppliers().find((s) => s.code === supplierId);
    return supplier?.name ?? '';
  }
}

