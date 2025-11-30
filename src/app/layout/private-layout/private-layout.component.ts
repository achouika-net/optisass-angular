import { BreakpointObserver } from '@angular/cdk/layout';
import { NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, linkedSignal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatSidenav, MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterLink, RouterOutlet } from '@angular/router';
import { Store } from '@ngrx/store';
import { map } from 'rxjs';
import {
  CircleLogoSettingsSelector,
  LogoSettingsSelector,
} from '../../core/store/settings/settings.selectors';
import { BreadcrumbComponent } from '../breadcrumb/breadcrumb.component';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { TopbarActionsComponent } from '../topbar-actions/topbar-actions.component';
import {
  UserCentresSelector,
  UserCurrentCentreSelector,
} from '../../core/store/auth/auth.selectors';
import { ICenter } from '@app/models';
import { ConfirmationPopupComponent } from '../../shared/components/confirmation-popup/confirmation-popup.component';
import { TranslateService } from '@ngx-translate/core';
import { MatDialog } from '@angular/material/dialog';
import { SetCurrentCenter } from '../../core/store/auth/auth.actions';
import { WebSocketsService } from '@app/services';

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
  providers: [WebSocketsService],
})
export default class PrivateLayoutComponent {
  readonly #store = inject(Store);
  readonly #breakpointObserver = inject(BreakpointObserver);
  readonly #translate = inject(TranslateService);
  readonly #dialog = inject(MatDialog);
  // eslint-disable-next-line no-unused-private-class-members
  readonly #webSocketsService = inject(WebSocketsService);

  logo = this.#store.selectSignal<string>(LogoSettingsSelector);
  circleLogo = this.#store.selectSignal<string>(CircleLogoSettingsSelector);
  centres = this.#store.selectSignal<ICenter[]>(UserCentresSelector);
  currentCentre = this.#store.selectSignal<ICenter>(UserCurrentCentreSelector);
  readonly #isHandset = toSignal(
    this.#breakpointObserver.observe('(max-width: 599.98px)').pipe(map(({ matches }) => matches))
  );
  readonly #isLarge = toSignal(
    this.#breakpointObserver.observe('(min-width: 1280px)').pipe(map(({ matches }) => matches))
  );
  readonly isMobile = linkedSignal(() => this.#isHandset());
  readonly isCollapsed = linkedSignal(() => !this.#isLarge() || this.#isHandset());

  toggleSidenav(sidenav: MatSidenav): void {
    if (this.isMobile()) {
      sidenav.toggle();
    }
    this.isCollapsed.update((v) => !v);
  }

  /**
   * Sélectionner le/les centres
   * @param currentCenter
   * @returns void
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

        // Dispatch l'action avec le flag isManualChange à true
        // La navigation sera gérée automatiquement par l'effect setCurrentCenter$
        this.#store.dispatch(
          SetCurrentCenter({
            currentCenter,
            isManualChange: true,
          })
        );
      });
  }
}
