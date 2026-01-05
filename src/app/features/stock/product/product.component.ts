import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ProductStore } from './product.store';

@Component({
  selector: 'app-product',
  imports: [RouterOutlet],
  providers: [ProductStore],
  template: `<router-outlet />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class ProductComponent {}
