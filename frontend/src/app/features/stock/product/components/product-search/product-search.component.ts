import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ActionsButtonsComponent } from '@app/components';
import { ActionsButton, PermissionType } from '@app/models';
import { ProductStore } from '../../product.store';
import { ProductSearchFormComponent } from './product-search-form/product-search-form.component';
import { ProductSearchTableComponent } from './product-search-table/product-search-table.component';

@Component({
  selector: 'app-product-search',
  imports: [ProductSearchFormComponent, ProductSearchTableComponent, ActionsButtonsComponent],
  template: `
    <app-actions-buttons [actionButtons]="buttons()" (action)="handleActions($any($event))" />
    <div class="flex flex-col gap-2">
      <app-product-search-form />
      <app-product-search-table />
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class ProductSearchComponent implements OnInit {
  readonly #productStore = inject(ProductStore);
  readonly #router = inject(Router);
  readonly #route = inject(ActivatedRoute);

  readonly buttons = signal<ActionsButton[]>([
    {
      label: 'commun.exportPdf',
      direction: 'left',
      action: 'exportPdf',
      icon: 'picture_as_pdf',
      customColor: 'green',
      permissions: [PermissionType.EXPORT],
    },
    {
      label: 'stock.addProduct',
      direction: 'right',
      action: 'addProduct',
      permissions: [PermissionType.WRITE],
    },
  ]).asReadonly();

  ngOnInit(): void {
    this.#productStore.searchProducts();
  }

  /**
   * Handles action button clicks.
   * @param action The action to perform
   */
  handleActions(action: 'exportPdf' | 'addProduct'): void {
    switch (action) {
      case 'exportPdf': {
        // Utilise store.state.searchForm() pour l'export
        // TODO: Implémenter export PDF
        break;
      }
      case 'addProduct':
        void this.#router.navigate(['add'], { relativeTo: this.#route });
    }
  }
}
