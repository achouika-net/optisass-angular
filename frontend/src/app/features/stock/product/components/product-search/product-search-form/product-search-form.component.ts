import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Field, form, FormField } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FILTER_ALL_YES_NO_OPTIONS } from '@app/config';
import { ResourceStore } from '@app/core/store';
import { ResourceAutocompleteComponent } from '@app/components';
import { FieldControlLabelDirective } from '@app/directives';
import { IProductSearch, ProductSearch, ProductType } from '@app/models';
import { SupplierService } from '@app/services';
import { TranslateModule } from '@ngx-translate/core';
import { ProductStore } from '../../../product.store';

@Component({
  selector: 'app-product-search-form',
  templateUrl: './product-search-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    Field,
    FormField,
    TranslateModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    FieldControlLabelDirective,
    ResourceAutocompleteComponent,
  ],
})
export class ProductSearchFormComponent {
  readonly #productStore = inject(ProductStore);
  readonly #resourceStore = inject(ResourceStore);
  readonly #supplierService = inject(SupplierService);

  readonly #searchFormModel = signal<IProductSearch>(new ProductSearch());
  readonly searchForm = form(this.#searchFormModel);

  readonly #searchValue = this.#productStore.state.searchForm;
  readonly showAdvancedFilters = signal(false);
  readonly booleanOptions = FILTER_ALL_YES_NO_OPTIONS;

  readonly suppliersResource = rxResource({
    stream: () => this.#supplierService.getActiveSuppliers(),
  });

  readonly suppliers = computed(() => this.suppliersResource.value() ?? []);

  readonly productTypes = this.#resourceStore.productTypes;
  readonly productStatuses = this.#resourceStore.productStatuses;
  readonly brands = this.#resourceStore.brands;
  readonly models = this.#resourceStore.models;
  readonly families = this.#resourceStore.families;
  readonly subFamilies = this.#resourceStore.subFamilies;
  readonly colors = this.#resourceStore.colors;
  readonly genders = this.#resourceStore.genders;
  readonly frameShapes = this.#resourceStore.frameShapes;
  readonly frameMaterials = this.#resourceStore.frameMaterials;
  readonly lensIndices = this.#resourceStore.lensIndices;
  readonly lensTreatments = this.#resourceStore.lensTreatments;
  readonly contactLensUsages = this.#resourceStore.contactLensUsages;
  readonly contactLensTypes = this.#resourceStore.contactLensTypes;
  readonly accessoryCategories = this.#resourceStore.accessoryCategories;

  readonly selectedProductTypes = computed(() => this.searchForm.productTypes().value() ?? []);

  readonly showFrameFilters = computed(() => {
    const types = this.selectedProductTypes();
    return types.length === 0 || types.includes('frame');
  });

  readonly showLensFilters = computed(() => {
    const types = this.selectedProductTypes();
    return types.length === 0 || types.includes('lens');
  });

  readonly showContactLensFilters = computed(() => {
    const types = this.selectedProductTypes();
    return types.length === 0 || types.includes('contact_lens');
  });

  readonly showAccessoryFilters = computed(() => {
    const types = this.selectedProductTypes();
    return types.length === 0 || types.includes('accessory');
  });

  readonly filteredModels = computed(() => {
    const brandId = this.searchForm.brandId().value();
    if (!brandId) return [];
    return this.models().filter((m) => m.brandId === brandId);
  });

  readonly filteredSubFamilies = computed(() => {
    const familyId = this.searchForm.familyId().value();
    if (!familyId) return [];
    return this.subFamilies().filter((sf) => sf.familyId === familyId);
  });

  constructor() {
    effect(() => {
      const searchValue = this.#searchValue();
      untracked(() => {
        if (searchValue) {
          this.#searchFormModel.set(searchValue);
        }
      });
    });

    effect(() => {
      this.searchForm.brandId().value();
      untracked(() => this.searchForm.modelId().value.set(null));
    });

    effect(() => {
      this.searchForm.familyId().value();
      untracked(() => this.searchForm.subFamilyId().value.set(null));
    });

    effect(() => {
      const types = this.selectedProductTypes();
      untracked(() => {
        if (types.length > 0) {
          this.#resetTypeSpecificFilters(types);
        }
      });
    });
  }

  /**
   * Toggles advanced filters visibility.
   */
  toggleAdvancedFilters(): void {
    this.showAdvancedFilters.update((v) => !v);
  }

  /**
   * Searches products with current form criteria.
   */
  search(): void {
    this.#productStore.setSearchForm(this.#searchFormModel());
    this.#productStore.searchProducts();
  }

  /**
   * Resets the search form to default values.
   */
  resetSearchForm(): void {
    this.#productStore.resetSearchForm();
  }

  /**
   * Resets type-specific filters for unselected product types.
   * @param selectedTypes Selected product types
   */
  #resetTypeSpecificFilters(selectedTypes: ProductType[]): void {
    const hasFrame = selectedTypes.includes('frame');

    if (!hasFrame) {
      this.searchForm.frameShape().value.set(null);
      this.searchForm.frameMaterial().value.set(null);
      this.searchForm.frameColor().value.set(null);
      this.searchForm.frameGender().value.set(null);
    }

    if (!selectedTypes.includes('lens')) {
      this.searchForm.lensIndex().value.set(null);
      this.searchForm.lensTreatment().value.set(null);
      this.searchForm.lensPhotochromic().value.set(null);
    }

    if (!selectedTypes.includes('contact_lens')) {
      this.searchForm.contactLensUsage().value.set(null);
      this.searchForm.contactLensType().value.set(null);
    }

    if (!selectedTypes.includes('accessory')) {
      this.searchForm.accessoryCategory().value.set(null);
    }
  }
}
