import {
  ChangeDetectionStrategy,
  Component,
  Signal,
  effect,
  inject,
  signal,
  untracked,
  input,
} from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { States } from '@app/config';
import { FieldControlLabelDirective } from '@app/directives';
import { IResource, IRole } from '@app/models';
import { TranslateModule } from '@ngx-translate/core';
import { IUserSearch, IUserSearchForm } from '../../../models';
import { UserStore } from '../../../user.store';

@Component({
  selector: 'app-user-search-form',
  templateUrl: './user-search-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    TranslateModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    FieldControlLabelDirective,
  ],
})
export class UserSearchFormComponent {
  #userStore = inject(UserStore);

  readonly searchForm = input.required<FormGroup<IUserSearchForm>>();

  #searchValue: Signal<IUserSearch> = this.#userStore.state.searchForm;
  roles: Signal<IRole[]> = this.#userStore.state.roles;
  states = signal<IResource[]>(States).asReadonly();

  constructor() {
    effect(() => {
      const searchValue = this.#searchValue();
      untracked(() => searchValue && this.searchForm()?.patchValue(searchValue));
    });
  }

  search(): void {
    this.#userStore.setSearchForm(this.searchForm().getRawValue());
    this.#userStore.searchUsers();
  }

  resetSearchForm(): void {
    this.#userStore.resetSearchForm();
  }
}
