import { Component, inject, OnInit, signal } from '@angular/core';
import { form } from '@angular/forms/signals';
import { ActivatedRoute, Router } from '@angular/router';
import { ActionsButtonsComponent } from '@app/components';
import { ActionsButton, DirectionType, PermissionType } from '@app/models';
import { UserStore } from '../../user.store';
import { UserSearchFormComponent } from './user-search-form/user-search-form.component';
import { UserSearchTableComponent } from './user-search-table/user-search-table.component';
import { IUserSearch, UserSearch } from '../../models';

@Component({
  selector: 'app-user-search',
  imports: [UserSearchFormComponent, UserSearchTableComponent, ActionsButtonsComponent],
  template: `
    <app-actions-buttons [actionButtons]="buttons()" (action)="handleActions($any($event))" />
    <div class="flex flex-col gap-2">
      <app-user-search-form [searchForm]="searchForm" />
      <app-user-search-table />
    </div>
  `,
})
export default class UserSearchComponent implements OnInit {
  #userStore = inject(UserStore);
  #router = inject(Router);
  #route = inject(ActivatedRoute);

  buttons = signal<ActionsButton[]>([
    {
      libelle: 'commun.exportPdf',
      direction: DirectionType.LEFT,
      action: 'exportPdf',
      icon: 'picture_as_pdf',
      customColor: 'green',
      permissions: [PermissionType.EXPORT],
    },
    {
      libelle: 'users.addUser',
      direction: DirectionType.RIGHT,
      action: 'addUser',
      permissions: [PermissionType.WRITE],
    },
  ]).asReadonly();

  searchFormModel = signal<IUserSearch>(new UserSearch());

  searchForm = form(this.searchFormModel);

  ngOnInit(): void {
    this.#userStore.searchUsers();
  }

  /**
   * Handle the given action.
   * @param {string} action - The action to handle. Possible values are 'exportPdf' and 'addUser'.
   */
  handleActions(action: 'exportPdf' | 'addUser'): void {
    switch (action) {
      case 'exportPdf': {
        const searchFormValue: IUserSearch = this.searchFormModel();
        // this.#userStore.exportPdfUsers(searchFormValue);
        break;
      }
      case 'addUser':
        void this.#router.navigate(['add'], { relativeTo: this.#route });
    }
  }
}
