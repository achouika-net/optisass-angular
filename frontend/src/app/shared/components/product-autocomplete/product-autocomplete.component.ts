import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import {
  debounce,
  disabled,
  form,
  FormField,
  FormValueControl,
  required,
} from '@angular/forms/signals';
import {
  MatAutocomplete,
  MatAutocompleteModule,
  MatAutocompleteSelectedEvent,
} from '@angular/material/autocomplete';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslateModule } from '@ngx-translate/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { PaginatedApiResponse, Product, ProductSearch, ProductType } from '@app/models';
import { FieldErrorComponent } from '@app/components';
import { of } from 'rxjs';
import { ProductService } from '@app/services';

type ProductValue = Product | null;
type InternalFormValue = string | Product | null;

@Component({
  selector: 'app-product-autocomplete',
  templateUrl: './product-autocomplete.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormField,
    MatFormFieldModule,
    MatInputModule,
    MatAutocompleteModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    TranslateModule,
    FieldErrorComponent,
  ],
})
export class ProductAutocompleteComponent implements FormValueControl<ProductValue> {
  readonly #productService = inject(ProductService);

  private readonly autocomplete = viewChild.required<MatAutocomplete>('auto');
  readonly value = model<ProductValue>(null);
  readonly disabled = input<boolean>(false);
  readonly required = input<boolean>(false);

  /** Field placeholder */
  readonly placeholder = input<string>('stock.productAutocomplete.placeholder');

  /** Show total stock quantity */
  readonly showStockTotal = input<boolean>(true);

  /** Show stock breakdown by warehouse */
  readonly showStockByWarehouse = input<boolean>(false);

  /** Maximum number of suppliers to display before showing +N */
  readonly maxSuppliersDisplay = input<number>(1);

  /** Filter by product types */
  readonly productTypes = input<ProductType[]>([]);

  /** Filter by supplier ID */
  readonly supplierId = input<string | null>(null);

  /** Emits when user selects a product */
  readonly selectionChange = output<ProductValue>();

  /** Emits when user clicks the search popup button */
  readonly openSearchPopup = output<void>();

  /** Internal signal for the form - stores string (typing) or object (selected) */
  readonly #formValue = signal<InternalFormValue>(null);

  /** Debounced search term for API calls */
  readonly #searchTerm = signal<string>('');

  /** Signal Form for mat-form-field invalid state */
  readonly internalForm = form(this.#formValue, (s) => {
    required(s, { when: () => this.required() && this.value() === null });
    disabled(s, this.disabled);
    debounce(s, 300);
  });

  /** Whether input is focused */
  readonly isFocused = signal<boolean>(false);

  /** rxResource for product search */
  readonly productsResource = rxResource({
    params: () => {
      const term = this.#searchTerm();
      if (!term || term.length < 2) return null;
      return {
        search: term,
        productTypes: this.productTypes(),
        supplierId: this.supplierId(),
      };
    },
    stream: ({ params }) => {
      if (!params) {
        return of({
          data: [],
          meta: null,
          links: null,
        } as unknown as PaginatedApiResponse<Product>);
      }
      return this.#searchProducts(params.search, params.productTypes, params.supplierId);
    },
  });

  /** Filtered products from API */
  readonly filteredProducts = computed(() => {
    const result = this.productsResource.value() as PaginatedApiResponse<Product> | undefined;
    return result?.data ?? [];
  });

  /** Whether loading products */
  readonly isLoading = computed(() => this.productsResource.isLoading());

  constructor() {
    // Update search term when user types (only when focused and value is string)
    effect(() => {
      const val = this.internalForm().value();
      untracked(() => {
        if (this.isFocused() && typeof val === 'string') {
          this.#searchTerm.set(val);
        }
      });
    });

    // Sync parent value → internalForm when not focused
    effect(() => {
      const product = this.value();
      untracked(() => {
        if (!this.isFocused()) {
          this.internalForm().value.set(product);
        }
      });
    });
  }

  /**
   * Searches products using the ProductService.
   * @param search Search term
   * @param productTypes Product type filters
   * @param supplierId Supplier ID filter
   * @returns Observable of paginated products
   */
  #searchProducts(search: string, productTypes: ProductType[], supplierId: string | null) {
    const searchForm = new ProductSearch();
    searchForm.search = search;
    if (productTypes.length > 0) {
      searchForm.productTypes = productTypes;
    }
    if (supplierId) {
      searchForm.supplierId = supplierId;
    }
    return this.#productService.search(searchForm, 1, 10, {
      active: 'designation',
      direction: 'asc',
    });
  }

  /**
   * Handles field focus.
   */
  onFocus(): void {
    this.isFocused.set(true);
  }

  /**
   * Handles autocomplete panel opened event.
   */
  onPanelOpened(): void {
    const currentProduct = this.value();
    if (currentProduct) {
      this.#selectMatchingOption(currentProduct.id);
    }
  }

  /**
   * Handles option selection.
   * @param event Autocomplete selection event
   */
  onOptionSelected(event: MatAutocompleteSelectedEvent): void {
    const selectedProduct = event.option.value as Product | null;
    this.value.set(selectedProduct);
    this.internalForm().value.set(selectedProduct);
    this.selectionChange.emit(selectedProduct);
    this.isFocused.set(false);
  }

  /**
   * Handles autocomplete panel closed event.
   * Restores previous value if user typed without selecting.
   */
  onPanelClosed(): void {
    const current = this.internalForm().value();

    if (typeof current === 'string') {
      const previousProduct = this.value();
      this.internalForm().value.set(previousProduct);
    }

    this.isFocused.set(false);
    this.#searchTerm.set('');
  }

  /**
   * Clears the selected product.
   * @param event Mouse event
   */
  clearSelection(event: MouseEvent): void {
    event.stopPropagation();
    this.value.set(null);
    this.internalForm().value.set(null);
    this.selectionChange.emit(null);
  }

  /**
   * Opens the advanced search popup.
   * @param event Mouse event
   */
  onOpenSearchPopup(event: MouseEvent): void {
    event.stopPropagation();
    this.openSearchPopup.emit();
  }

  /**
   * Display function for autocomplete.
   * @param option Option to display
   * @returns Product designation
   */
  displayFn = (option: Product | string | null): string => {
    if (!option) return '';
    if (typeof option === 'string') return option;
    return option.designation;
  };

  /**
   * Gets the suppliers display text.
   * @param product The product
   * @returns Supplier names with overflow badge if needed
   */
  getSuppliersDisplay(product: Product): string {
    const suppliers = product.suppliers;
    const max = this.maxSuppliersDisplay();
    if (suppliers.length <= max) {
      return suppliers.map((s) => s.name).join(', ');
    }
    const visible = suppliers
      .slice(0, max)
      .map((s) => s.name)
      .join(', ');
    return visible;
  }

  /**
   * Gets the overflow count for suppliers.
   * @param product The product
   * @returns Number of hidden suppliers or 0
   */
  getSuppliersOverflowCount(product: Product): number {
    const suppliers = product.suppliers;
    const max = this.maxSuppliersDisplay();
    return Math.max(0, suppliers.length - max);
  }

  /**
   * Manually selects the matching option in the autocomplete panel.
   * @param productId Product ID to match
   */
  #selectMatchingOption(productId: string): void {
    const autocomplete = this.autocomplete();
    if (!autocomplete?.options) return;

    autocomplete.options.forEach((opt) => {
      const product = opt.value as Product | null;
      if (product && product.id === productId) {
        opt.select();
      } else {
        opt.deselect();
      }
    });
  }
}
