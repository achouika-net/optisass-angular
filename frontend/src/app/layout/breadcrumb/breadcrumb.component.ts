import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router, RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { MatIconModule } from '@angular/material/icon';
import { MatButton } from '@angular/material/button';
import { MatDivider } from '@angular/material/divider';
import { filter, map, startWith } from 'rxjs/operators';
import { TranslateModule } from '@ngx-translate/core';
import { NavigationHistoryService } from '../../core/navigation-history/navigation-history.service';
import { BreadcrumbItem } from '@app/models';
import { APP_NAME } from '../../config/global.config';

@Component({
  selector: 'app-breadcrumb',
  imports: [MatIconModule, MatDivider, MatButton, RouterLink, TranslateModule],
  templateUrl: './breadcrumb.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BreadcrumbComponent {
  readonly #router = inject(Router);
  readonly #activatedRoute = inject(ActivatedRoute);
  readonly #history = inject(NavigationHistoryService);
  readonly #titleService = inject(Title);

  readonly isMobile = input.required<boolean>();

  /** Signal déclenché à chaque changement de navigation */
  private readonly navigationEnd = toSignal(
    this.#router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      startWith(null),
      map(() => this.#router.url)
    ),
    { initialValue: this.#router.url }
  );

  /** URL précédente pour le bouton retour */
  readonly previousUrl = computed(() => {
    this.navigationEnd();
    return this.#history.getPreviousUrl();
  });

  /**
   * Construit le breadcrumb en parcourant la chaîne firstChild
   * Chaque segment de route peut avoir data.breadcrumb (clé i18n)
   */
  readonly breadcrumbItems = computed<BreadcrumbItem[]>(() => {
    this.navigationEnd(); // Déclenche le recalcul à chaque navigation

    const breadcrumbs: BreadcrumbItem[] = [];
    const seenKeys = new Set<string>();
    let url = '';
    let route: ActivatedRoute | null = this.#activatedRoute.root;

    // Parcourt la chaîne des routes actives via firstChild
    while (route) {
      const segments = route.snapshot.url.map((s) => s.path);

      if (segments.length > 0) {
        url = `${url}/${segments.join('/')}`;
      }

      // Utilise routeConfig.data pour éviter l'héritage des données parentes
      const breadcrumbKey = route.routeConfig?.data?.['breadcrumb'] as string | undefined;

      // Évite les doublons en vérifiant si la clé a déjà été ajoutée
      if (breadcrumbKey && !seenKeys.has(breadcrumbKey)) {
        seenKeys.add(breadcrumbKey);
        // Stocker la clé i18n, le pipe translate la traduira dans le template
        breadcrumbs.push({ label: breadcrumbKey, url });
      }

      route = route.firstChild;
    }

    return breadcrumbs;
  });

  /** Titre de la page (dernier élément du breadcrumb) */
  readonly pageTitle = computed(() => {
    const items = this.breadcrumbItems();
    return items.length > 0 ? items[items.length - 1].label : '';
  });

  constructor() {
    effect(() => {
      this.#titleService.setTitle(`${APP_NAME} - ${this.pageTitle()}`);
    });
  }

  /**
   * Navigue vers la précédente URL (stockée en mémoire)
   */
  goBack(): void {
    this.#history.goBack();
  }
}
