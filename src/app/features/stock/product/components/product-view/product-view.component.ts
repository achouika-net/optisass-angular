import { ChangeDetectionStrategy, Component, effect, inject, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ProductFormComponent } from '../product-form/product-form.component';
import { ProductStore } from '../../product.store';

@Component({
  selector: 'app-product-view',
  imports: [TranslatePipe, MatProgressSpinnerModule, ProductFormComponent],
  template: `
    @if (productStore.state.productLoading()) {
      <div class="flex justify-center py-8">
        <mat-spinner diameter="40" />
      </div>
    } @else if (productStore.state.product()) {
      <app-product-form />
    } @else {
      <div class="text-center py-8 text-gray-500">
        {{ 'stock.productNotFound' | translate }}
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class ProductViewComponent {
  readonly productStore = inject(ProductStore);

  readonly id = input.required<string>();

  constructor() {
    effect(() => {
      this.productStore.getProduct(this.id());
    });
  }
}
