import { ChangeDetectionStrategy, Component } from '@angular/core';
import { WarehouseFormComponent } from '../warehouse-form/warehouse-form.component';

@Component({
  selector: 'app-warehouse-add',
  imports: [WarehouseFormComponent],
  template: `<app-warehouse-form />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class WarehouseAddComponent {}
