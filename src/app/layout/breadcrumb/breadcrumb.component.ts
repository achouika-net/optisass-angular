import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';

import { Store } from '@ngrx/store';
import { MatIconModule } from '@angular/material/icon';
import { MenuItem } from '@app/models';
import {
  selectCurrentUrl,
  selectRouteData,
} from '../../core/store/router/router.selector';
import { MatButton } from '@angular/material/button';
import { MENU } from '../../config/menu.config';
import { NavigationHistoryService } from '../../core/navigation-history/navigation-history.service';
import { RouterLink } from '@angular/router';
import { MatDivider } from '@angular/material/divider';
import { findMenuItemByUrl } from '@app/helpers';
import { Title } from '@angular/platform-browser';

@Component({
  selector: 'app-breadcrumb',
  imports: [MatIconModule, RouterLink, MatDivider, MatButton],
  templateUrl: './breadcrumb.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BreadcrumbComponent {
  #store = inject(Store);
  #history = inject(NavigationHistoryService);
  #titleService = inject(Title);
  readonly isMobile = input.required<boolean>();
  private readonly menuItems = signal<MenuItem[]>(MENU);
  private readonly currentUrl = computed(() => {
    const url = this.#store.selectSignal(selectCurrentUrl);
    return url().replace(/^\/p\//, '');
  });
  readonly routeData = this.#store.selectSignal(selectRouteData);
  readonly previousUrl = computed(() => {
    this.currentUrl();
    return this.#history.getPreviousUrl();
  });
  readonly breadcrumbItems = computed(() => {
    const url = this.currentUrl();
    const dataTitle: string = this.routeData()?.['title'];
    const trail: Partial<MenuItem>[] = [];
    const segments = url.split('/');
    let currentPath = '';
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      currentPath = currentPath ? `${currentPath}/${segment}` : segment;
      const menuItem = findMenuItemByUrl(this.menuItems(), currentPath);
      if (menuItem) {
        trail.push(menuItem);
      } else if (i === segments.length - 1 && dataTitle) {
        trail.push({
          label: dataTitle,
          route: currentPath,
        });
      } else {
        break;
      }
    }

    return trail;
  });

  readonly pageTitle = computed(() => {
    const breadcrumb = this.breadcrumbItems();
    if (breadcrumb.length) {
      return breadcrumb[breadcrumb.length - 1].label;
    }
    const dataTitle = this.routeData()?.['title'];
    return dataTitle || 'Agenda';
  });

  constructor() {
    effect(() => {
      this.#titleService.setTitle(`Agenda - ${this.pageTitle()}`);
    });
  }

  /**
   * Navigue vers la précédente URL (stockée en mémoire).
   * @returns void
   */
  goBack(): void {
    this.#history.goBack();
  }
}
