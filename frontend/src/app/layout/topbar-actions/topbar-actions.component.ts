import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDivider } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { Store } from '@ngrx/store';
import { Logout, SetCurrentCenter } from '../../core/store/auth/auth.actions';
import { ICenter } from '@app/models';
import { UserCentresSelector, UserCurrentCentreSelector, UserSelector, UserRoleSelector } from '../../core/store/auth/auth.selectors';
import { USER_ROLES } from '../../shared/types/user-roles.type';
import { MatDialog } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';
import { ConfirmationPopupComponent } from '../../shared/components/confirmation-popup/confirmation-popup.component';

import { toSignal } from '@angular/core/rxjs-interop';
import { CentersService } from '../../features/centers/services/centers.service';
import { computed } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-topbar-actions',
  templateUrl: './topbar-actions.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatMenuModule, MatDivider],
})
export class TopbarActionsComponent {
  private readonly store = inject(Store);
  private readonly dialog = inject(MatDialog);
  private readonly translate = inject(TranslateService);
  private readonly centersService = inject(CentersService);

  isMobile = input.required<boolean>();

  userCentres = this.store.selectSignal<ICenter[]>(UserCentresSelector);
  currentCentre = this.store.selectSignal<ICenter>(UserCurrentCentreSelector);
  user = this.store.selectSignal(UserSelector);
  userRole = this.store.selectSignal(UserRoleSelector);

  userName = computed(
    () => `${this.user()?.last_name || ''} ${this.user()?.first_name || ''}`
  );

  roleName = computed(() => {
    const roleId = this.userRole();
    return roleId ? USER_ROLES[roleId] : '';
  });

  // Fetch all centers to ensure list is complete (bypass auth limitations)
  apiCentres = toSignal(this.centersService.findAll(), { initialValue: [] });

  centres = computed(() => {
    // Map API centers to ICenter structure
    const mappedApiCentres = this.apiCentres().map(c => ({
      ...c as any,
      name: c.nom, // Map nom to name
      // Default missing fields if needed
      active: true,
      migrated: false
    } as ICenter));

    // Combine with user centers and deduplicate by ID
    const all = [...this.userCentres(), ...mappedApiCentres];
    return all.filter((c, index, self) =>
      index === self.findIndex((t) => t.id === c.id)
    );
  });

  logout() {
    this.store.dispatch(Logout({}));
  }

  selectCenter(currentCenter: ICenter): void {
    this.dialog
      .open(ConfirmationPopupComponent, {
        data: {
          message: this.translate.instant('commun.changementCentre'),
          deny: this.translate.instant('commun.non'),
          confirm: this.translate.instant('commun.oui'),
        },
        disableClose: true,
      })
      .afterClosed()
      .subscribe((result) => {
        if (!result) return;

        this.store.dispatch(
          SetCurrentCenter({
            currentCenter,
            isManualChange: true,
          })
        );
      });
  }
}
