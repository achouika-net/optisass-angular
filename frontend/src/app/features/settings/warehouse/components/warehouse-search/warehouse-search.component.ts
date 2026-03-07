import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { form } from '@angular/forms/signals';
import { ActivatedRoute, Router } from '@angular/router';
import { ActionsButtonsComponent } from '@app/components';
import { ActionsButton, PermissionType } from '@app/models';
import { IWarehouseSearch, WarehouseSearch } from '../../models';
import { WarehouseStore } from '../../warehouse.store';
import { WarehouseSearchFormComponent } from './warehouse-search-form/warehouse-search-form.component';
import { WarehouseSearchTableComponent } from './warehouse-search-table/warehouse-search-table.component';

@Component({
  selector: 'app-warehouse-search',
  imports: [WarehouseSearchFormComponent, WarehouseSearchTableComponent, ActionsButtonsComponent],
  template: `
    <app-actions-buttons [actionButtons]="buttons()" (action)="handleActions($any($event))" />
    <div class="flex flex-col gap-2">
      <app-warehouse-search-form [searchForm]="searchForm" />
      <app-warehouse-search-table />
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class WarehouseSearchComponent implements OnInit {
  #warehouseStore = inject(WarehouseStore);
  #router = inject(Router);
  #route = inject(ActivatedRoute);

  buttons = signal<ActionsButton[]>([
    {
      label: 'warehouse.add',
      direction: 'right',
      action: 'addWarehouse',
      permissions: [PermissionType.WRITE],
    },
  ]).asReadonly();

  searchFormModel = signal<IWarehouseSearch>(new WarehouseSearch());
  searchForm = form(this.searchFormModel);

  ngOnInit(): void {
    this.#warehouseStore.searchWarehouses();
  }

  handleActions(action: 'addWarehouse'): void {
    if (action === 'addWarehouse') {
      void this.#router.navigate(['add'], { relativeTo: this.#route });
    }
  }
}
