import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ActionsButtonsComponent } from '@app/components';
import { ActionsButton, DirectionType } from '@app/models';
import { TranslateService } from '@ngx-translate/core';
import { UserStore } from '../../user.store';

@Component({
  selector: 'app-user-view',
  imports: [ActionsButtonsComponent],
  template: `
    <app-actions-buttons [actionButtons]="actionButtons()" />
    <!-- <app-user-form /> -->
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class UserViewComponent implements OnInit {
  readonly #userStore = inject(UserStore);
  readonly #dialog = inject(MatDialog);
  readonly #translateService = inject(TranslateService);
  protected actionButtons = signal<ActionsButton[]>([
    {
      libelle: 'commun.generatePassword',
      direction: DirectionType.RIGHT,
      action: 'generatePassword',
      permissions: [],
    },
  ]);

  ngOnInit() {
    this.#userStore.getUser();
  }

  // /**
  //  * gestion des actions
  //  * @param {string} action
  //  */
  // protected handleActions(action: string) {
  //   switch (action) {
  //     case 'generatePassword':
  //       this.#dialog
  //         .open(ConfirmationPopupComponent, {
  //           data: {
  //             message: this.#translateService.instant(
  //               'user.generateAutoPasswordConfirmationPopup'
  //             ),
  //             deny: this.#translateService.instant('commun.no'),
  //             confirm: this.#translateService.instant('commun.yes'),
  //           },
  //           minWidth: '80vw',
  //           disableClose: true,
  //         })
  //         .afterClosed()
  //         .pipe(
  //           filter((result: boolean) => !!result),
  //           tap(() => this.#userStore.updateUser({ new_password: true }))
  //         )
  //         .subscribe();
  //   }
  // }
}
