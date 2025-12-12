import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  Signal,
} from '@angular/core';
import { MIN_PAGE_SIZE_OPTIONS } from '@app/config';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatSort, MatSortHeader, Sort } from '@angular/material/sort';
import { UserStore } from '../../../user.store';
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
import { NoDataSearchComponent, StatusIllustrationComponent } from '@app/components';
import { MatDialog } from '@angular/material/dialog';
import { filter, tap } from 'rxjs/operators';
import { ConfirmationPopupComponent } from '../../../../../../shared/components/confirmation-popup/confirmation-popup.component';
import { GetElementFromResourcePipe } from '../../../../../../shared/pipes/get-element-from-resource.pipe';
import { ResponsiveTableDirective } from '@app/directives';
import { ICenter, IRole } from '@app/models';
import { WrapFnPipe } from '@app/pipes';

@Component({
  selector: 'app-user-search-table',
  templateUrl: './user-search-table.component.html',
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
    WrapFnPipe,
  ],
})
export class UserSearchTableComponent {
  #userStore = inject(UserStore);
  route = inject(ActivatedRoute);
  #dialog = inject(MatDialog);
  #translate = inject(TranslateService);
  roles = this.#userStore.state.roles;
  users = this.#userStore.state.users;
  sort = this.#userStore.state.sort;
  page = this.#userStore.state.pageEvent;
  displayedColumns = signal([
    'first_name',
    'last_name',
    'email',
    'mobile',
    'role_id',
    'actif',
    'action',
  ]).asReadonly();
  showPaginator = computed<boolean>(() => this.users()?.meta.total > MIN_PAGE_SIZE_OPTIONS);
  // TO DO: replace with current center of the store when multi-center management is implemented
  currentCenter = signal<ICenter>({ id: 5905 } as ICenter);

  /**
   * pagination
   * @param {PageEvent} event
   */
  changePage(event: PageEvent): void {
    this.#userStore.setPageEvent(event);
    this.#userStore.searchUsers();
  }

  /**
   * Trier les données
   * @param {Sort} sort
   */
  sortChange(sort: Sort): void {
    this.#userStore.setSort(sort);
    this.#userStore.searchUsers();
  }

  /**
   * supprimer un utilisateur
   * @param {number} id
   */
  deleteUser(id: number): void {
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
        tap(() => this.#userStore.deleteUser(id))
      )
      .subscribe();
  }

  getUserRoleOfCurrentCenter(
    roles: IRole[],
    centers: { id: number; role_id: number }[],
    currentCenterId: number
  ): string {
    const roleId = centers.find(({ id }) => id === currentCenterId)?.role_id;
    return roles.find(({ id }) => id === roleId)?.name || '';
  }
}
