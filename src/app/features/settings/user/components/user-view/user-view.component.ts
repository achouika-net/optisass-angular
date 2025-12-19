import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ActionsButtonsComponent, ConfirmationPopupComponent } from '@app/components';
import { ActionsButton } from '@app/models';
import { TranslateService } from '@ngx-translate/core';
import { filter, tap } from 'rxjs';
import { UserStore } from '../../user.store';
import { UserFormComponent } from '../user-form/user-form.component';

@Component({
  selector: 'app-user-view',
  imports: [ActionsButtonsComponent, UserFormComponent],
  template: `
    <app-actions-buttons [actionButtons]="actionButtons()" />
    <app-user-form />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class UserViewComponent implements OnInit {
  readonly #userStore = inject(UserStore);
  readonly #dialog = inject(MatDialog);
  readonly #translate = inject(TranslateService);
  protected actionButtons = signal<ActionsButton[]>([
    {
      label: 'commun.generatePassword',
      direction: 'right',
      action: 'generatePassword',
      permissions: [],
    },
  ]);

  ngOnInit() {
    this.#userStore.getUser();
  }

  /**
   * gestion des actions
   * @param {string} action
   */
  protected handleActions(action: string) {
    switch (action) {
      case 'generatePassword':
        this.#dialog
          .open(ConfirmationPopupComponent, {
            data: {
              message: this.#translate.instant('user.generateAutoPasswordConfirmationPopup'),
              deny: this.#translate.instant('commun.no'),
              confirm: this.#translate.instant('commun.yes'),
            },
            minWidth: '80vw',
            disableClose: true,
          })
          .afterClosed()
          .pipe(
            filter((result: boolean) => !!result),
            tap(() => this.#userStore.updateUser({ new_password: true } as any))
          )
          .subscribe();
    }
  }
}
