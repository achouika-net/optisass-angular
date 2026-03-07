import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ConfirmationPopupComponent, NoDataSearchComponent, StatusIllustrationComponent } from '@app/components';
import { MIN_PAGE_SIZE_OPTIONS } from '@app/config';
import { ResponsiveTableDirective } from '@app/directives';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { filter, tap } from 'rxjs/operators';
import { WarehouseStore } from '../../../warehouse.store';

@Component({
  selector: 'app-warehouse-search-table',
  templateUrl: './warehouse-search-table.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatCardModule,
    MatTableModule,
    MatSortModule,
    MatPaginatorModule,
    MatButtonModule,
    MatIconModule,
    TranslateModule,
    RouterLink,
    NoDataSearchComponent,
    StatusIllustrationComponent,
    ResponsiveTableDirective,
  ],
})
export class WarehouseSearchTableComponent {
  #warehouseStore = inject(WarehouseStore);
  #dialog = inject(MatDialog);
  #translate = inject(TranslateService);
  route = inject(ActivatedRoute);

  warehouses = this.#warehouseStore.state.warehouses;
  sort = this.#warehouseStore.state.sort;
  page = this.#warehouseStore.state.pageEvent;

  displayedColumns = signal([
    'name',
    'capacity',
    'address',
    'type',
    'active',
    'action',
  ]).asReadonly();

  showPaginator = computed<boolean>(() => (this.warehouses()?.meta?.total ?? 0) > MIN_PAGE_SIZE_OPTIONS);

  changePage(event: PageEvent): void {
    this.#warehouseStore.setPageEvent(event);
    this.#warehouseStore.searchWarehouses();
  }

  sortChange(sort: Sort): void {
    this.#warehouseStore.setSort(sort);
    this.#warehouseStore.searchWarehouses();
  }

  deleteWarehouse(id: number): void {
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
        tap(() => this.#warehouseStore.deleteWarehouse(id))
      )
      .subscribe();
  }
}
