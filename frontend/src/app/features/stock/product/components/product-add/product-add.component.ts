import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ProductFormComponent } from '../product-form/product-form.component';

@Component({
  selector: 'app-product-add',
  imports: [ProductFormComponent],
  template: `<app-product-form />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class ProductAddComponent {}
