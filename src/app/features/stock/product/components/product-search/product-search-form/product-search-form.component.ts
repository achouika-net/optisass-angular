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
import { Field, form } from '@angular/forms/signals';
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
import { ProductType } from '@app/models';
import { SupplierService } from '@app/services';
import { TranslateModule } from '@ngx-translate/core';
import { map } from 'rxjs';
import { IProductSearch, ProductSearch } from '../../../models';
import { ProductStore } from '../../../product.store';
import { WarehouseService } from '../../../../../settings/warehouse/services/warehouse.service';

@Component({
  selector: 'app-product-search-form',
  templateUrl: './product-search-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    Field,
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
  readonly #warehouseService = inject(WarehouseService);
  readonly #supplierService = inject(SupplierService);

  readonly #searchFormModel = signal<IProductSearch>(new ProductSearch());
  readonly searchForm = form(this.#searchFormModel);

  readonly #searchValue = this.#productStore.state.searchForm;
  readonly showAdvancedFilters = signal(false);
  readonly booleanOptions = FILTER_ALL_YES_NO_OPTIONS;

  readonly warehousesResource = rxResource({
    stream: () =>
      this.#warehouseService
        .searchWarehouses({ name: null, type: null }, 1, 100, null)
        .pipe(map((res) => res.data)),
  });

  readonly suppliersResource = rxResource({
    stream: () => this.#supplierService.getActiveSuppliers(),
  });

  readonly activeWarehouses = computed(() => {
    const warehouses = this.warehousesResource.value() ?? [];
    return warehouses.filter((w) => w.active);
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
    return types.length === 0 || types.includes('monture');
  });

  readonly showLensFilters = computed(() => {
    const types = this.selectedProductTypes();
    return types.length === 0 || types.includes('verre');
  });

  readonly showContactLensFilters = computed(() => {
    const types = this.selectedProductTypes();
    return types.length === 0 || types.includes('lentille');
  });

  readonly showAccessoryFilters = computed(() => {
    const types = this.selectedProductTypes();
    return types.length === 0 || types.includes('accessoire');
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
   * Affiche/masque les filtres avancés.
   */
  toggleAdvancedFilters(): void {
    this.showAdvancedFilters.update((v) => !v);
  }

  /**
   * Lance la recherche de produits avec les critères du formulaire.
   */
  search(): void {
    this.#productStore.setSearchForm(this.#searchFormModel());
    this.#productStore.searchProducts();
  }

  /**
   * Réinitialise le formulaire de recherche.
   */
  resetSearchForm(): void {
    this.#searchFormModel.set(new ProductSearch());
  }

  /**
   * Réinitialise les filtres spécifiques aux types de produit non sélectionnés.
   * @param selectedTypes Types de produit sélectionnés
   */
  #resetTypeSpecificFilters(selectedTypes: ProductType[]): void {
    if (!selectedTypes.includes('monture')) {
      this.searchForm.frameShape().value.set(null);
      this.searchForm.frameMaterial().value.set(null);
      this.searchForm.frameColor().value.set(null);
      this.searchForm.frameGender().value.set(null);
    }

    if (!selectedTypes.includes('verre')) {
      this.searchForm.lensIndex().value.set(null);
      this.searchForm.lensTreatment().value.set(null);
      this.searchForm.lensPhotochromic().value.set(null);
    }

    if (!selectedTypes.includes('lentille')) {
      this.searchForm.contactLensUsage().value.set(null);
      this.searchForm.contactLensType().value.set(null);
    }

    if (!selectedTypes.includes('accessoire')) {
      this.searchForm.accessoryCategory().value.set(null);
    }
  }
}
