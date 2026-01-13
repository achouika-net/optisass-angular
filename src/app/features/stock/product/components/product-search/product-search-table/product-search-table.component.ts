import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatSort, MatSortHeader, Sort } from '@angular/material/sort';
import { MatCard, MatCardContent } from '@angular/material/card';
import {
  MatCell,
  MatCellDef,
  MatColumnDef,
  MatHeaderCell,
  MatHeaderCellDef,
  MatHeaderRow,
  MatHeaderRowDef,
  MatRow,
  MatRowDef,
  MatTable,
} from '@angular/material/table';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { MatIconButton } from '@angular/material/button';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatIcon } from '@angular/material/icon';
import { NoDataSearchComponent, ConfirmationPopupComponent } from '@app/components';
import { MatDialog } from '@angular/material/dialog';
import { filter, tap } from 'rxjs/operators';
import { ResponsiveTableDirective } from '@app/directives';
import { MIN_PAGE_SIZE_OPTIONS } from '@app/config';
import { ProductStore } from '../../../product.store';
import { Product } from '@app/models';
import { MatTooltip } from '@angular/material/tooltip';
import { GetElementFromResourcePipe, WrapFnPipe } from '@app/pipes';
import { ResourceStore } from '@app/core/store';

@Component({
  selector: 'app-product-search-table',
  templateUrl: './product-search-table.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatCard,
    MatCardContent,
    MatTable,
    MatSort,
    MatColumnDef,
    MatHeaderCellDef,
    MatHeaderCell,
    MatCell,
    MatCellDef,
    TranslatePipe,
    MatIconButton,
    MatIcon,
    MatHeaderRow,
    MatHeaderRowDef,
    MatRow,
    MatRowDef,
    RouterLink,
    MatPaginator,
    MatSortHeader,
    NoDataSearchComponent,
    ResponsiveTableDirective,
    MatTooltip,
    WrapFnPipe,
    GetElementFromResourcePipe,
  ],
})
export class ProductSearchTableComponent {
  readonly #productStore = inject(ProductStore);
  readonly #resourceStore = inject(ResourceStore);
  readonly #dialog = inject(MatDialog);
  readonly #translate = inject(TranslateService);
  readonly route = inject(ActivatedRoute);

  readonly products = this.#productStore.state.products;
  readonly sort = this.#productStore.state.sort;
  readonly page = this.#productStore.state.pageEvent;
  readonly brands = this.#resourceStore.brands;
  readonly productStatuses = this.#resourceStore.productStatuses;

  readonly displayedColumns = signal([
    'internalCode',
    'designation',
    'productType',
    'brand',
    'currentQuantity',
    'status',
    'action',
  ]).asReadonly();

  readonly showPaginator = computed<boolean>(() => {
    const total = this.products()?.meta?.total;
    return total !== undefined && total > MIN_PAGE_SIZE_OPTIONS;
  });

  /**
   * Gère le changement de page du tableau.
   * @param event Événement de pagination
   */
  changePage(event: PageEvent): void {
    this.#productStore.setPageEvent(event);
    this.#productStore.searchProducts();
  }

  /**
   * Gère le changement de tri du tableau.
   * @param sort Configuration du tri
   */
  sortChange(sort: Sort): void {
    this.#productStore.setSort(sort);
    this.#productStore.searchProducts();
  }

  /**
   * Supprime un produit après confirmation.
   * @param id Identifiant du produit à supprimer
   */
  deleteProduct(id: string): void {
    this.#dialog
      .open(ConfirmationPopupComponent, {
        data: {
          message: this.#translate.instant('commun.deleteConfirmation'),
          deny: this.#translate.instant('commun.no'),
          confirm: this.#translate.instant('commun.yes'),
        },
        disableClose: true,
      })
      .afterClosed()
      .pipe(
        filter((result: boolean) => !!result),
        tap(() => this.#productStore.deleteProduct(id)),
      )
      .subscribe();
  }

  /**
   * Retourne la clé de traduction pour le type de produit.
   * @param productType Code du type de produit
   * @returns Clé de traduction
   */
  getProductTypeLabel = (productType: string): string => `stock.productTypes.${productType}`;

  /**
   * Retourne la clé de traduction pour le statut.
   * @param status Code du statut
   * @returns Clé de traduction
   */
  getStatusLabel = (status: string): string => `stock.statuses.${status}`;

  /**
   * Vérifie si le produit est en stock bas.
   * @param product Produit à vérifier
   * @returns true si quantité <= seuil d'alerte et > 0
   */
  isLowStock = (product: Product): boolean =>
    product.currentQuantity <= product.alertThreshold && product.currentQuantity > 0;

  /**
   * Vérifie si le produit est en rupture de stock.
   * @param product Produit à vérifier
   * @returns true si quantité === 0
   */
  isOutOfStock = (product: Product): boolean => product.currentQuantity === 0;
}
