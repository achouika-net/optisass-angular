import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-product-view',
  imports: [TranslatePipe],
  template: `
    <div class="flex flex-col gap-4">
      <h2 class="text-xl font-semibold">{{ 'stock.viewProduct' | translate }}</h2>
      <p class="text-gray-500">Vue détaillée en cours de développement...</p>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class ProductViewComponent {}
