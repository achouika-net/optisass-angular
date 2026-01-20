import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { debounce, Field, form } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { A11yModule } from '@angular/cdk/a11y';
import { FieldControlLabelDirective } from '@app/directives';
import { ResourceStore } from '@app/core/store';
import { IProductSearch, Product, ProductType } from '@app/models';
import { ProductService } from '@app/services';
import { TranslateModule } from '@ngx-translate/core';
import { map, of } from 'rxjs';

interface ISearchForm {
  readonly search: string;
  readonly productType: ProductType | null;
}

@Component({
  selector: 'app-product-search-dialog',
  templateUrl: './product-search-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    A11yModule,
    Field,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatProgressSpinnerModule,
    TranslateModule,
    FieldControlLabelDirective,
  ],
})
export class ProductSearchDialogComponent {
  readonly #dialogRef = inject(MatDialogRef<ProductSearchDialogComponent>);
  readonly #productService = inject(ProductService);
  readonly #resourceStore = inject(ResourceStore);

  readonly #searchModel = signal<ISearchForm>({ search: '', productType: null });

  readonly searchForm = form(this.#searchModel, (s) => {
    debounce(s, 300);
  });

  readonly productTypes = this.#resourceStore.productTypes;

  readonly searchParams = computed(() => {
    const search = this.searchForm.search().value();
    const productType = this.searchForm.productType().value();
    if (!search || search.length < 2) return null;
    return {
      designation: search,
      productType,
    };
  });

  readonly productsResource = rxResource({
    params: this.searchParams,
    stream: ({ params }) => {
      if (!params) return of([] as readonly Product[]);
      const searchForm: Partial<IProductSearch> = {
        search: params.designation,
        productTypes: params.productType ? [params.productType] : [],
      };
      return this.#productService
        .search(searchForm as IProductSearch, 1, 20, { active: '', direction: '' })
        .pipe(map((response) => response.data));
    },
  });

  readonly products = computed(() => this.productsResource.value() ?? []);
  readonly isLoading = computed(() => this.productsResource.isLoading());
  readonly hasSearched = computed(() => this.searchParams() !== null);
  readonly noResults = computed(
    () => this.hasSearched() && !this.isLoading() && this.products().length === 0,
  );

  readonly displayedColumns = ['designation', 'productType', 'brand', 'quantity', 'actions'];

  /**
   * Selects a product and closes the dialog.
   * @param product Selected product
   */
  selectProduct(product: Product): void {
    this.#dialogRef.close({ type: 'existing', product });
  }

  /**
   * Creates a new product with current search term.
   */
  createNew(): void {
    const search = this.searchForm.search().value() ?? '';
    const productType = this.searchForm.productType().value();
    this.#dialogRef.close({ type: 'new', designation: search, productType });
  }

  /**
   * Closes the dialog without selection.
   */
  cancel(): void {
    this.#dialogRef.close(null);
  }

  /**
   * Gets brand label for a product.
   * @param product Product
   * @returns Brand label or '-'
   */
  getBrandLabel(product: Product): string {
    if (!product.brandId) return '-';
    const brand = this.#resourceStore.brands().find((b) => b.id === product.brandId);
    return brand?.label ?? '-';
  }

  /**
   * Gets product type label.
   * @param productType Product type code
   * @returns Product type label
   */
  getProductTypeLabel(productType: ProductType): string {
    const type = this.productTypes().find((t) => t.code === productType);
    return type?.label ?? productType;
  }
}
