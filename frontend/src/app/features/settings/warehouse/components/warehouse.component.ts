import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { WarehouseService } from '../services/warehouse.service';
import { WarehouseStore } from '../warehouse.store';

@Component({
  selector: 'app-warehouse',
  imports: [RouterOutlet],
  template: `<router-outlet />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [WarehouseService, WarehouseStore],
})
export default class WarehouseComponent {}
