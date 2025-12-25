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
import { MenuItem } from '@app/models';
import { TranslatePipe } from '@ngx-translate/core';
import { MENU } from '../../config/menu.config';

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

  readonly isMobile = input.required<boolean>();
  readonly isCollapsed = input.required<boolean>();
  readonly openSubMenu = signal<string | null>(null);
  readonly favoritesOpen = signal(true);
  readonly favorisItems = signal<MenuItem[]>([]);

  readonly menuItems = signal<MenuItem[]>(MENU);

  /** Menu principal filtré (link, sub avec children valides) */
  readonly visibleMenuItems = computed(() =>
    this.menuItems()
      .filter((item) => ['link', 'sub'].includes(item.type))
      .map((item) => {
        if (item.type === 'sub' && item.children) {
          return item.children.length > 0 ? item : null;
        }
        return item;
      })
      .filter(Boolean) as MenuItem[]
  );

  /** Menu à afficher dans le mode collapsed */
  readonly flatMenuItemsForCollapsed = computed(() =>
    this.menuItems().flatMap((item) => {
      if (item.type === 'link') return [item];

      if (item.type === 'sub' && item.children?.length) {
        return item.children;
      }

      return [];
    })
  );

  /** Liens rapides (extLink) */
  readonly extLinks = computed(() =>
    this.menuItems().filter((item) => item.type === 'extLink')
  );

  /** Liens de bas de page (footer) */
  readonly footerLinks = computed(() =>
    this.menuItems().filter((item) => item.type === 'footer')
  );

  /**
   * Au démarrage, ouvre le sous-menu correspondant à l'URL active.
   * @returns void
   */
  ngOnInit(): void {
    const opened = this.menuItems()
      .filter((item) => item.type === 'sub')
      .find((item) =>
        item.children?.some((child) =>
          this.router.url.startsWith(`/p/${child.route}`)
        )
      );
    if (opened) {
      this.openSubMenu.set(opened.label);
    }
  }

  /**
   * Vérifie si un item est marqué comme favori.
   * @param label - Le libellé de l'item à vérifier
   * @returns true si l'item est dans les favoris, false sinon
   */
  isFavorite(label: string): boolean {
    return this.favorisItems().some((f) => f.label === label);
  }

  /**
   * Met à jour l'ordre des favoris suite à un drag&drop.
   * @param event - L'événement de drag&drop contenant les indices de déplacement
   * @returns void
   */
  dropFavorite(event: CdkDragDrop<MenuItem[]>): void {
    const current = [...this.favorisItems()];
    moveItemInArray(current, event.previousIndex, event.currentIndex);
    this.favorisItems.set(current);
  }

  /**
   * Supprime un élément des favoris.
   * @param label - Le libellé de l'item à supprimer
   * @returns void
   */
  removeFavorite(label: string): void {
    this.favorisItems.set(this.favorisItems().filter((f) => f.label !== label));
  }

  /**
   * Ajoute ou retire un item des favoris.
   * @param favoriteItems - La liste actuelle des favoris
   * @param item - L'item à ajouter ou retirer
   * @param e - L'événement DOM à stopper
   * @returns void
   */
  handleFavorite(favoriteItems: MenuItem[], item: MenuItem, e: Event): void {
    e.stopPropagation();
    e.preventDefault();
    const isFav = this.isFavorite(item.label);
    if (isFav) {
      this.removeFavorite(item.label);
    } else {
      this.favorisItems.set([...favoriteItems, item]);
    }
  }

  /**
   * Ouvre ou ferme manuellement un sous-menu.
   * @param label - Le libellé du sous-menu à basculer
   * @returns void
   */
  toggleSubMenu(label: string): void {
    this.openSubMenu.update((current) => (current === label ? null : label));
  }

  /**
   * Vérifie si un sous-menu est actuellement ouvert.
   * @param label - Le libellé du sous-menu à vérifier
   * @returns true si le sous-menu est ouvert, false sinon
   */
  isSubMenuOpen(label: string): boolean {
    return this.openSubMenu() === label;
  }

  /**
   * Vérifie si l'un des enfants du sous-menu est actif (route match).
   * @param children - La liste des enfants du sous-menu
   * @returns true si au moins un enfant correspond à l'URL active, false sinon
   */
  isSubActive(children?: MenuItem[]): boolean {
    if (!children) return false;
    return children.some((child) =>
      this.router.url.startsWith(`/p/${child.route}`)
    );
  }
}
