import {
  ChangeDetectionStrategy,
  Component,
  effect,
  input,
  signal,
  untracked,
} from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-stock-entry-tabs',
  templateUrl: './stock-entry-tabs.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatCardModule, MatIconModule, MatTabsModule, TranslateModule],
})
export class StockEntryTabsComponent {
  readonly totalProducts = input.required<number>();
  readonly incompleteCount = input.required<number>();
  readonly initialTabIndex = input<number>(1);

  readonly activeTabIndex = signal<number>(1);

  constructor() {
    effect(() => {
      const idx = this.initialTabIndex();
      untracked(() => this.activeTabIndex.set(idx));
    });
  }

  /**
   * Switches to the products tab.
   */
  goToProductsTab(): void {
    this.activeTabIndex.set(1);
  }

  /**
   * Switches to the supplier tab.
   */
  goToSupplierTab(): void {
    this.activeTabIndex.set(0);
  }
}
