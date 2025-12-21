import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router, RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { MatIconModule } from '@angular/material/icon';
import { MatButton } from '@angular/material/button';
import { MatDivider } from '@angular/material/divider';
import { filter, map, startWith } from 'rxjs/operators';
import { MenuItem } from '@app/models';
import { MENU } from '../../config/menu.config';
import { NavigationHistoryService } from '../../core/navigation-history/navigation-history.service';
import { findMenuItemByUrl } from '@app/helpers';

@Component({
  selector: 'app-breadcrumb',
  imports: [MatIconModule, RouterLink, MatDivider, MatButton],
  templateUrl: './breadcrumb.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BreadcrumbComponent {
  #router = inject(Router);
  #activatedRoute = inject(ActivatedRoute);
  #history = inject(NavigationHistoryService);
  #titleService = inject(Title);
  readonly isMobile = input.required<boolean>();
  private readonly menuItems = signal<MenuItem[]>(MENU);

  // Signal qui écoute l'URL actuelle via les événements du router
  private readonly currentUrl = toSignal(
    this.#router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      startWith(null),
      map(() => this.#router.url.replace(/^\/p\//, ''))
    ),
    { initialValue: this.#router.url.replace(/^\/p\//, '') }
  );

  // Signal qui écoute les données de la route active
  readonly routeData = toSignal(this.#activatedRoute.data, { initialValue: {} as Record<string, any> });

  readonly previousUrl = computed(() => {
    this.currentUrl();
    return this.#history.getPreviousUrl();
  });
  readonly breadcrumbItems = computed(() => {
    const url = this.currentUrl();
    const data = this.routeData() as Record<string, any>;
    const dataTitle: string = data?.['title'];
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
    const data = this.routeData() as Record<string, any>;
    const dataTitle = data?.['title'];
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
