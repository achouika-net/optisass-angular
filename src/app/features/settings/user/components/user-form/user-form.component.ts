import { ChangeDetectionStrategy, Component, inject, signal, Signal } from '@angular/core';
import { applyEach, Field, form, maxLength, pattern, required } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDivider } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { FieldErrorComponent, PhotoUploadComponent } from '@app/components';
import { EMAIL_PATTERN, MOBILE_PATTERN } from '@app/config';
import { FieldControlLabelDirective } from '@app/directives';
import { ICenter, ICivilite, IRole } from '@app/models';
import { Store } from '@ngrx/store';
import { TranslateModule } from '@ngx-translate/core';
import { UserCentresSelector } from '../../../../../core/store/auth/auth.selectors';
import { CiviliteByTypeAndStateSelector } from '../../../../../core/store/resources/resources.selector';
import { UserStore } from '../../user.store';

interface ICentreRole {
  center_id: number;
  role_id: number;
}

const newCentreRole: ICentreRole = { center_id: null, role_id: null };

interface IUserForm {
  actif: boolean;
  photo: File | string;
  nom: string;
  prenom: string;
  civilite_id: number;
  mobile: string;
  email: string;
  agrement: string;
  center_roles: ICentreRole[];
}

@Component({
  selector: 'app-user-form',
  templateUrl: './user-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslateModule,
    Field,
    MatButtonModule,
    MatCardModule,
    MatDivider,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatRadioModule,
    MatIconModule,
    FieldControlLabelDirective,
    FieldErrorComponent,
    PhotoUploadComponent,
  ],
})
export class UserFormComponent {
  #store = inject(Store);
  #userStore = inject(UserStore);

  civilites = this.#store.selectSignal<ICivilite[]>(CiviliteByTypeAndStateSelector(1));
  centers = this.#store.selectSignal<ICenter[]>(UserCentresSelector);
  roles: Signal<IRole[]> = this.#userStore.state.roles;

  userFormModel = signal<IUserForm>({
    actif: true,
    photo: null,
    nom: '',
    prenom: '',
    civilite_id: null,
    mobile: '',
    email: '',
    agrement: '',
    center_roles: [newCentreRole],
  });

  form = form(this.userFormModel, (fieldPath) => {
    required(fieldPath.nom);
    maxLength(fieldPath.nom, 40);
    required(fieldPath.prenom);
    maxLength(fieldPath.prenom, 40);
    required(fieldPath.civilite_id);
    required(fieldPath.email);
    pattern(fieldPath.email, EMAIL_PATTERN);
    pattern(fieldPath.mobile, MOBILE_PATTERN);
    applyEach(fieldPath.center_roles, (item) => {
      required(item.center_id);
      required(item.role_id);
    });
  });

  addCentreRole(): void {
    const currentModel = this.userFormModel();
    this.userFormModel.update((model) => ({
      ...model,
      center_roles: [...currentModel.center_roles, newCentreRole],
    }));
  }

  removeCentreRole(index: number): void {
    this.userFormModel.update((model) => ({
      ...model,
      center_roles: model.center_roles.toSpliced(index, 1),
    }));
  }

  save(): void {
    const userData = this.userFormModel();
    console.log('Saving user:', userData);
    // TODO: Implement save logic with userStore
  }
}
