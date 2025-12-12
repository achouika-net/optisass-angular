// import { ChangeDetectionStrategy, Component, effect, inject, OnDestroy } from '@angular/core';
// import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
// import { MatButton } from '@angular/material/button';
// import { MatCard, MatCardContent } from '@angular/material/card';
// import { MatError, MatFormField, MatInput, MatLabel } from '@angular/material/input';
// import { MatOption, MatSelect } from '@angular/material/select';
// import { MatSlideToggle } from '@angular/material/slide-toggle';
// import { FormControlErrorComponent } from '@app/components';
// import { FieldControlLabelDirective } from '@app/directives';
// import { getDirtyValues } from '@app/helpers';
// import { TranslatePipe } from '@ngx-translate/core';
// import { IUserForm } from '../../models';
// import { UserStore } from '../../user.store';

// @Component({
//   selector: 'app-user-form',
//   imports: [
//     FieldControlLabelDirective,
//     FormControlErrorComponent,
//     FormsModule,
//     MatButton,
//     MatCard,
//     MatCardContent,
//     MatError,
//     MatFormField,
//     MatInput,
//     MatLabel,
//     ReactiveFormsModule,
//     TranslatePipe,
//     MatFormField,
//     MatSlideToggle,
//     MatOption,
//     MatSelect,
//   ],
//   templateUrl: './user-form.component.html',
//   changeDetection: ChangeDetectionStrategy.OnPush,
// })
// export class UserFormComponent implements OnDestroy {
//   readonly #userStore = inject(UserStore);
//   readonly #fb = inject(FormBuilder);
//   protected roles = this.#userStore.state.roles;
//   protected user = this.#userStore.state.user;
//   protected userForm: FormGroup<IUserForm>
//   constructor() {
//     effect(() => {
//       if (this.user()) {
//         // this.userForm.patchValue(this.#userStore.state.user());
//         this.userForm.markAsPristine();
//       }
//     });
//   }

//   /**
//    * Ajouter ou modifier l'utilisateur
//    */
//   save() {
//     if (!this.user()) {
//       // this.#userStore.addUser(this.userForm.getRawValue());
//     } else {
//       const updatedValues = getDirtyValues(this.userForm);
//       if (updatedValues) {
//         this.#userStore.updateUser(updatedValues);
//       }
//     }
//   }

//   ngOnDestroy() {
//     this.#userStore.resetUser();
//   }
// }
