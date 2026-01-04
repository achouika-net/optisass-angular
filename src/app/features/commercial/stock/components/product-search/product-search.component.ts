import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-product-search',
  imports: [TranslatePipe],
  template: `
    <div class="flex flex-col gap-4">
      <h2 class="text-xl font-semibold">{{ 'stock.title' | translate }}</h2>
      <p class="text-gray-500">{{ 'stock.noProducts' | translate }}</p>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class ProductSearchComponent {}
