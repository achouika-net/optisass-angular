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
import { userHasAccessToItem } from '@app/helpers';
import { MenuItem } from '@app/models';
import { Store } from '@ngrx/store';
import { TranslatePipe } from '@ngx-translate/core';
import { MENU } from '../../config/menu.config';
import {
  UserRoleSelector,
  UserSelector,
} from '../../core/store/auth/auth.selectors';

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
  private readonly store = inject(Store);

  readonly isMobile = input.required<boolean>();
  readonly isCollapsed = input.required<boolean>();

  private readonly user = this.store.selectSignal(UserSelector);
  readonly userName = computed(
    () => `${this.user().last_name || ''} ${this.user().first_name || ''}`
  );
  readonly userRole = this.store.selectSignal(UserRoleSelector);
  readonly openSubMenu = signal<string | null>(null);
  readonly favoritesOpen = signal(true);
  readonly favorisItems = signal<MenuItem[]>([]);

  readonly menuItems = signal<MenuItem[]>(MENU);

  /** Menu principal filtré (link, sub avec children valides) */
  readonly visibleMenuItems = computed(
    () =>
      this.menuItems()
        .filter(
          (item) => ['link', 'sub'].includes(item.type) && this.hasAccess(item)
        )
        .map((item) => {
          if (item.type === 'sub' && item.children) {
            const filtered = item.children.filter((child) =>
              this.hasAccess(child)
            );
            return filtered.length > 0 ? { ...item, children: filtered } : null;
          }
          return item;
        })
        .filter(Boolean) as MenuItem[]
  );

  /** Menu à afficher dans le mode collapsed */
  readonly flatMenuItemsForCollapsed = computed(() =>
    this.menuItems().flatMap((item) => {
      if (!this.hasAccess(item)) return [];

      if (item.type === 'link') return [item];

      if (item.type === 'sub' && item.children?.length) {
        return item.children.filter((child) => this.hasAccess(child));
      }

      return [];
    })
  );

  /** Liens rapides (extLink) */
  readonly extLinks = computed(() =>
    this.menuItems().filter(
      (item) => item.type === 'extLink' && this.hasAccess(item)
    )
  );

  /** Liens de bas de page (footer) */
  readonly footerLinks = computed(() =>
    this.menuItems().filter(
      (item) => item.type === 'footer' && this.hasAccess(item)
    )
  );

  /**
   * Au démarrage : ouvre le sous-menu correspondant à l’URL active.
   */
  ngOnInit(): void {
    const opened = this.menuItems()
      .filter((i) => i.type === 'sub')
      .find((i) =>
        i.children?.some((child) =>
          this.router.url.startsWith(`/p/${child.route}`)
        )
      );
    if (opened) {
      this.openSubMenu.set(opened.label);
    }
  }

  /**
   * Vérifie si l’utilisateur a accès à un item donné.
   * @param item Élément de menu.
   * @returns `true` si l’élément est visible pour l’utilisateur.
   */
  private hasAccess(item: MenuItem): boolean {
    return userHasAccessToItem(item, this.userRole());
  }

  /**
   * Vérifie si un item est marqué comme favori.
   * @param label Label de l’item.
   * @returns `true` si l’item est dans les favoris.
   */
  isFavorite(label: string): boolean {
    return this.favorisItems().some((f) => f.label === label);
  }

  /**
   * Met à jour l’ordre des favoris suite à un drag&drop.
   * @param event Événement CDK contenant l’ordre.
   */
  dropFavorite(event: CdkDragDrop<MenuItem[]>): void {
    const current = [...this.favorisItems()];
    moveItemInArray(current, event.previousIndex, event.currentIndex);
    this.favorisItems.set(current);
  }

  /**
   * Supprime un élément des favoris.
   * @param label Label de l’item à retirer.
   */
  removeFavorite(label: string): void {
    this.favorisItems.set(this.favorisItems().filter((f) => f.label !== label));
  }

  /**
   * Ajoute ou retire un item des favoris.
   * @param favoriteItems Favoris actuels.
   * @param item Élément à manipuler.
   * @param e Événement DOM (click).
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
   * @param label Label du sous-menu.
   */
  toggleSubMenu(label: string): void {
    this.openSubMenu.update((current) => (current === label ? null : label));
  }

  /**
   * Vérifie si un sous-menu est actuellement ouvert.
   * @param label Nom du sous-menu.
   * @returns `true` si ouvert.
   */
  isSubMenuOpen(label: string): boolean {
    return this.openSubMenu() === label;
  }

  /**
   * Vérifie si l’un des enfants du sous-menu est actif (route match).
   * @param children Enfants du sous-menu.
   * @returns `true` si un enfant est actif.
   */
  isSubActive(children?: MenuItem[]): boolean {
    if (!children) return false;
    return children.some((child) =>
      this.router.url.startsWith(`/p/${child.route}`)
    );
  }
}
