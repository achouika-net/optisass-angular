import {
  CdkDrag,
  CdkDragDrop,
  CdkDropList,
  moveItemInArray,
} from '@angular/cdk/drag-drop';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  OnInit,
  signal,
} from '@angular/core';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatTooltip } from '@angular/material/tooltip';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { AuthStore } from '@app/core/store';
import { IClientRoute } from '@optisaas/opti-saas-lib';

@Component({
  selector: 'app-sidebar',
  imports: [
    MatSidenavModule,
    MatListModule,
    MatIconModule,
    MatDividerModule,
    RouterLink,
    RouterLinkActive,
    TranslatePipe,
    MatTooltip,
    CdkDropList,
    CdkDrag,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
})
export class SidebarComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly authStore = inject(AuthStore);

  readonly isMobile = input.required<boolean>();
  readonly isCollapsed = input.required<boolean>();
  readonly openSubMenu = signal<string | null>(null);
  readonly favoritesOpen = signal(true);
  readonly favorisItems = signal<IClientRoute[]>([]);

  // Accès direct aux routes disponibles depuis le store (déjà un computed signal via Proxy)
  readonly routes = this.authStore.navigation;

  /** Menu principal filtré (link, collapse avec children valides) */
  readonly visibleMenuItems = computed(
    () =>
      this.routes()
        .filter((route) => ['link', 'collapse'].includes(route.type))
        .map((route) => {
          if (route.type === 'collapse' && route.children) {
            const filtered = route.children.filter((child) =>
              ['link', 'collapse-link'].includes(child.type)
            );
            return filtered.length > 0 ? { ...route, children: filtered } : null;
          }
          return route;
        })
        .filter(Boolean) as IClientRoute[]
  );

  /** Menu à afficher dans le mode collapsed */
  readonly flatMenuItemsForCollapsed = computed(() =>
    this.routes().flatMap((route) => {
      if (route.type === 'link') return [route];

      if (route.type === 'collapse' && route.children?.length) {
        return route.children.filter((child) =>
          ['link', 'collapse-link'].includes(child.type)
        );
      }

      return [];
    })
  );

  /** Liens rapides (collapse-link externe) */
  readonly extLinks = computed(() =>
    this.routes().filter((route) => route.type === 'collapse-link')
  );

  /** Liens de bas de page (à implémenter si nécessaire) */
  readonly footerLinks = computed(() =>
    this.routes().filter((route) => route.type === 'link' && route.id === 'a-propos')
  );

  /**
   * Au démarrage : ouvre le sous-menu correspondant à l'URL active.
   */
  ngOnInit(): void {
    const opened = this.routes()
      .filter((route) => route.type === 'collapse')
      .find((route) =>
        route.children?.some((child) =>
          this.router.url.startsWith(`/p/${child.path}`)
        )
      );
    if (opened) {
      this.openSubMenu.set(opened.label);
    }
  }

  /**
   * Vérifie si un item est marqué comme favori.
   */
  isFavorite(label: string): boolean {
    return this.favorisItems().some((f) => f.label === label);
  }

  /**
   * Met à jour l'ordre des favoris suite à un drag&drop.
   */
  dropFavorite(event: CdkDragDrop<IClientRoute[]>): void {
    const current = [...this.favorisItems()];
    moveItemInArray(current, event.previousIndex, event.currentIndex);
    this.favorisItems.set(current);
  }

  /**
   * Supprime un élément des favoris.
   */
  removeFavorite(label: string): void {
    this.favorisItems.set(this.favorisItems().filter((f) => f.label !== label));
  }

  /**
   * Ajoute ou retire un item des favoris.
   */
  handleFavorite(favoriteItems: IClientRoute[], route: IClientRoute, e: Event): void {
    e.stopPropagation();
    e.preventDefault();
    const isFav = this.isFavorite(route.label);
    if (isFav) {
      this.removeFavorite(route.label);
    } else {
      this.favorisItems.set([...favoriteItems, route]);
    }
  }

  /**
   * Ouvre ou ferme manuellement un sous-menu.
   */
  toggleSubMenu(label: string): void {
    this.openSubMenu.update((current) => (current === label ? null : label));
  }

  /**
   * Vérifie si un sous-menu est actuellement ouvert.
   */
  isSubMenuOpen(label: string): boolean {
    return this.openSubMenu() === label;
  }

  /**
   * Vérifie si l'un des enfants du sous-menu est actif (route match).
   */
  isSubActive(children?: IClientRoute[]): boolean {
    if (!children) return false;
    return children.some((child) =>
      this.router.url.startsWith(`/p/${child.path}`)
    );
  }
}
