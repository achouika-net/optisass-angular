import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { Field, FieldTree } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FieldControlLabelDirective } from '@app/directives';
import { TranslateModule } from '@ngx-translate/core';
import { IWarehouseSearch, WAREHOUSE_TYPES } from '../../../models';
import { WarehouseStore } from '../../../warehouse.store';

@Component({
  selector: 'app-warehouse-search-form',
  templateUrl: './warehouse-search-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    Field,
    TranslateModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    FieldControlLabelDirective,
  ],
})
export class WarehouseSearchFormComponent {
  #warehouseStore = inject(WarehouseStore);

  readonly searchForm = input.required<FieldTree<IWarehouseSearch>>();
  #searchValue = this.#warehouseStore.state.searchForm;
  warehouseTypes = signal(WAREHOUSE_TYPES).asReadonly();

  constructor() {
    effect(() => {
      const searchValue = this.#searchValue();
      untracked(() => {
        if (searchValue && this.searchForm()().value()) {
          this.searchForm()().value.set(searchValue);
        }
      });
    });
  }

  search(): void {
    this.#warehouseStore.setSearchForm(this.searchForm()().value());
    this.#warehouseStore.searchWarehouses();
  }

  resetSearchForm(): void {
    this.#warehouseStore.resetSearchForm();
  }
}
