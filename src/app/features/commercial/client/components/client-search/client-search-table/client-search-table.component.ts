import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MIN_PAGE_SIZE_OPTIONS } from '@app/config';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatSort, MatSortHeader, Sort } from '@angular/material/sort';
import { ClientStore } from '../../../client.store';
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
import {
  NoDataSearchComponent,
  StatusIllustrationComponent,
  ConfirmationPopupComponent,
} from '@app/components';
import { MatDialog } from '@angular/material/dialog';
import { filter, tap } from 'rxjs/operators';
import { ResponsiveTableDirective } from '@app/directives';

@Component({
  selector: 'app-client-search-table',
  templateUrl: './client-search-table.component.html',
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
    StatusIllustrationComponent,
    ResponsiveTableDirective,
  ],
})
export class ClientSearchTableComponent {
  #clientStore = inject(ClientStore);
  route = inject(ActivatedRoute);
  #dialog = inject(MatDialog);
  #translate = inject(TranslateService);

  clients = this.#clientStore.state.clients;
  sort = this.#clientStore.state.sort;
  page = this.#clientStore.state.pageEvent;
  displayedColumns = signal([
    'clientTypeId',
    'title',
    'lastName',
    'firstName',
    'phone',
    'idDocument',
    'city',
    'active',
    'action',
  ]).asReadonly();
  showPaginator = computed<boolean>(() => this.clients()?.meta.total > MIN_PAGE_SIZE_OPTIONS);

  /**
   * pagination
   * @param {PageEvent} event
   */
  changePage(event: PageEvent): void {
    this.#clientStore.setPageEvent(event);
    this.#clientStore.searchClients();
  }

  /**
   * Trier les données
   * @param {Sort} sort
   */
  sortChange(sort: Sort): void {
    this.#clientStore.setSort(sort);
    this.#clientStore.searchClients();
  }

  /**
   * supprimer un client
   * @param {number} id
   */
  deleteClient(id: number): void {
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
        tap(() => this.#clientStore.deleteClient(id))
      )
      .subscribe();
  }
}
