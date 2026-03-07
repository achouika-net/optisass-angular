import { ChangeDetectionStrategy, Component, effect, inject, input } from '@angular/core';
import { UserStore } from '../../user.store';
import { UserFormComponent } from '../user-form/user-form.component';

@Component({
  selector: 'app-user-view',
  imports: [UserFormComponent],
  template: ` <app-user-form /> `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class UserViewComponent {
  readonly #userStore = inject(UserStore);

  // Reçoit automatiquement le paramètre ':id' de la route grâce à withComponentInputBinding()
  readonly id = input.required<number>();

  constructor() {
    // Effect pour mettre à jour le store quand l'ID change
    effect(() => {
      this.#userStore.getUser(this.id());
    });
  }
}
