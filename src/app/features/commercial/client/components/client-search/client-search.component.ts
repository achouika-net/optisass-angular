import { Component, inject, OnInit, signal } from '@angular/core';
import { form } from '@angular/forms/signals';
import { ActivatedRoute, Router } from '@angular/router';
import { ActionsButtonsComponent } from '@app/components';
import { ActionsButton, PermissionType } from '@app/models';
import { ClientStore } from '../../client.store';
import { ClientSearchFormComponent } from './client-search-form/client-search-form.component';
import { ClientSearchTableComponent } from './client-search-table/client-search-table.component';
import { IClientSearch, ClientSearch } from '../../models';

@Component({
  selector: 'app-client-search',
  imports: [ClientSearchFormComponent, ClientSearchTableComponent, ActionsButtonsComponent],
  template: `
    <app-actions-buttons [actionButtons]="buttons()" (action)="handleActions($any($event))" />
    <div class="flex flex-col gap-2">
      <app-client-search-form [searchForm]="searchForm" />
      <app-client-search-table />
    </div>
  `,
})
export default class ClientSearchComponent implements OnInit {
  #clientStore = inject(ClientStore);
  #router = inject(Router);
  #route = inject(ActivatedRoute);

  buttons = signal<ActionsButton[]>([
    {
      label: 'commun.exportPdf',
      direction: 'left',
      action: 'exportPdf',
      icon: 'picture_as_pdf',
      customColor: 'green',
      permissions: [PermissionType.EXPORT],
    },
    {
      label: 'client.add',
      direction: 'right',
      action: 'addClient',
      permissions: [PermissionType.WRITE],
    },
  ]).asReadonly();

  searchFormModel = signal<IClientSearch>(new ClientSearch());

  searchForm = form(this.searchFormModel);

  ngOnInit(): void {
    this.#clientStore.searchClients();
  }

  /**
   * Handle the given action.
   * @param {string} action - The action to handle. Possible values are 'exportPdf' and 'addClient'.
   */
  handleActions(action: 'exportPdf' | 'addClient'): void {
    switch (action) {
      case 'exportPdf': {
        const searchFormValue: IClientSearch = this.searchFormModel();
        // this.#clientStore.exportPdfClients(searchFormValue);
        break;
      }
      case 'addClient':
        void this.#router.navigate(['add'], { relativeTo: this.#route });
    }
  }
}
