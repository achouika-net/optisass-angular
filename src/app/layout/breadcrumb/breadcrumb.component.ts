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
import { NavigationHistoryService } from '../../core/navigation-history/navigation-history.service';
import { findRouteByUrl } from '@app/helpers';
import { AuthStore } from '@app/core/store';
import { IClientRoute } from '@optisaas/opti-saas-lib';

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
  #authStore = inject(AuthStore);
  readonly isMobile = input.required<boolean>();

  // Accès direct aux routes disponibles depuis le store (déjà un computed signal via Proxy)
  private readonly routes = this.#authStore.navigation;

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
    const trail: Partial<IClientRoute>[] = [];
    const segments = url.split('/');
    let currentPath = '';
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      currentPath = currentPath ? `${currentPath}/${segment}` : segment;
      const route = findRouteByUrl(this.routes(), currentPath);
      if (route) {
        trail.push(route);
      } else if (i === segments.length - 1 && dataTitle) {
        trail.push({
          label: dataTitle,
          path: currentPath,
          type: 'link',
          id: currentPath,
          authorizations_needed: [],
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
