import { ChangeDetectionStrategy, Component, effect, inject, input, OnInit, signal } from '@angular/core';
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

  // Reçoit automatiquement le paramètre ':id' de la route grâce à withComponentInputBinding()
  readonly id = input.required<number>();

  protected actionButtons = signal<ActionsButton[]>([
    {
      libelle: 'commun.generatePassword',
      direction: DirectionType.RIGHT,
      action: 'generatePassword',
      permissions: [],
    },
  ]);

  constructor() {
    // Effect pour mettre à jour le store quand l'ID change
    effect(() => {
      this.#userStore.setUserId(this.id());
    });
  }

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
