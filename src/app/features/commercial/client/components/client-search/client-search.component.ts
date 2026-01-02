import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { form } from '@angular/forms/signals';
import { ActivatedRoute, Router } from '@angular/router';
import { ActionsButtonsComponent, StatisticCardComponent } from '@app/components';
import { ActionsButton, ClientSearch, IClientSearch, PermissionType } from '@app/models';
import { ClientStore } from '../../client.store';
import { ClientSearchFormComponent } from './client-search-form/client-search-form.component';
import { ClientSearchTableComponent } from './client-search-table/client-search-table.component';

@Component({
  selector: 'app-client-search',
  imports: [
    ClientSearchFormComponent,
    ClientSearchTableComponent,
    ActionsButtonsComponent,
    StatisticCardComponent,
  ],
  template: `
    <div class="flex flex-col gap-5">
      <app-actions-buttons [actionButtons]="buttons()" (action)="handleActions($any($event))" />
      <app-statistic-card [statisticsCardsData]="clientsStatistics()" />
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

  clientsStatistics = computed(() => this.#clientStore.state.clientsStatistics());

  ngOnInit(): void {
    this.#clientStore.getClientsStatistics();
    this.#clientStore.searchClients();
  }

  /**
   * Handle the given action.
   * @param {string} action - The action to handle. Possible values are 'exportPdf' and 'addClient'.
   */
  handleActions(action: 'exportPdf' | 'addClient'): void {
    switch (action) {
      case 'exportPdf': {
        // const searchFormValue: IClientSearch = this.searchFormModel();
        // this.#clientStore.exportPdfClients(searchFormValue);
        break;
      }
      case 'addClient':
        void this.#router.navigate(['add'], { relativeTo: this.#route });
    }
  }
}
