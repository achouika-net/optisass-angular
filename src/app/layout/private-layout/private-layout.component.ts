import { BreakpointObserver } from '@angular/cdk/layout';
import { NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, linkedSignal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatSidenav, MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterLink, RouterOutlet } from '@angular/router';
import { ConfirmationPopupComponent } from '@app/components';
import { AuthStore, SettingsStore } from '@app/core/store';
import { ICenter } from '@app/models';
import { TranslateService } from '@ngx-translate/core';
import { map } from 'rxjs';
import { BreadcrumbComponent } from '../breadcrumb/breadcrumb.component';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { TopbarActionsComponent } from '../topbar-actions/topbar-actions.component';

@Component({
  selector: 'app-private-layout',
  templateUrl: './private-layout.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatToolbarModule,
    MatIconModule,
    RouterLink,
    NgOptimizedImage,
    MatButtonModule,
    MatMenuModule,
    MatDividerModule,
    MatSidenavModule,
    MatListModule,
    RouterOutlet,
    SidebarComponent,
    BreadcrumbComponent,
    TopbarActionsComponent,
  ],
})
export default class PrivateLayoutComponent {
  readonly #authStore = inject(AuthStore);
  readonly #settingsStore = inject(SettingsStore);
  readonly #breakpointObserver = inject(BreakpointObserver);
  readonly #translate = inject(TranslateService);
  readonly #dialog = inject(MatDialog);

  logo = this.#settingsStore.logo;
  circleLogo = this.#settingsStore.smallLogo;
  centres = this.#authStore.userCenters;
  currentCentre = this.#authStore.currentCenter;

  // Mobile: < 600px
  readonly #isHandset = toSignal(
    this.#breakpointObserver.observe('(max-width: 599.98px)').pipe(map(({ matches }) => matches))
  );

  // Tablet: 600px - 1279px
  readonly #isTablet = toSignal(
    this.#breakpointObserver
      .observe('(min-width: 600px) and (max-width: 1279.98px)')
      .pipe(map(({ matches }) => matches))
  );

  // Desktop: >= 1280px
  readonly #isDesktop = toSignal(
    this.#breakpointObserver.observe('(min-width: 1280px)').pipe(map(({ matches }) => matches))
  );

  readonly isMobile = linkedSignal(() => this.#isHandset());
  readonly isTablet = linkedSignal(() => this.#isTablet());
  readonly isDesktop = linkedSignal(() => this.#isDesktop());
  readonly isCollapsed = linkedSignal(() => this.isTablet() || this.isMobile());

  /**
   * Toggle le sidenav (overlay ou collapse selon l'appareil)
   */
  toggleSidenav(sidenav: MatSidenav): void {
    if (this.isMobile()) {
      sidenav.toggle();
    } else {
      this.isCollapsed.update((v) => !v);
    }
  }

  /**
   * Sélectionner un centre après confirmation
   */
  selectCenter(currentCenter: ICenter): void {
    this.#dialog
      .open(ConfirmationPopupComponent, {
        data: {
          message: this.#translate.instant('commun.changementCentre'),
          deny: this.#translate.instant('commun.non'),
          confirm: this.#translate.instant('commun.oui'),
        },
        disableClose: true,
      })
      .afterClosed()
      .subscribe((result) => {
        if (!result) return;

        this.#authStore.setCurrentCenter(currentCenter);
      });
  }
}
