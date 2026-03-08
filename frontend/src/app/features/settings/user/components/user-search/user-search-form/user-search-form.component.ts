import {
  ChangeDetectionStrategy,
  Component,
  Signal,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { Field, FieldTree, FormField } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { States } from '@app/config';
import { ControlLabelDirective } from '@app/directives';
import { IRole, IResource } from '@app/models';
import { TranslateModule } from '@ngx-translate/core';
import { IUserSearch } from '../../../models';
import { UserStore } from '../../../user.store';

@Component({
  selector: 'app-user-search-form',
  templateUrl: './user-search-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [

    TranslateModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    ControlLabelDirective,
    FormField,
  ],
})
export class UserSearchFormComponent {
  #userStore = inject(UserStore);

  readonly searchForm: any = input.required<FieldTree<IUserSearch>>();
  #searchValue: Signal<IUserSearch> = this.#userStore.state.searchForm;
  roles: Signal<IRole[]> = this.#userStore.state.roles;
  states = signal<IResource[]>(States).asReadonly();

  constructor() {
    effect(() => {
      const searchValue = this.#searchValue();
      untracked(() => {
        if (searchValue && this.searchForm()().value()) {
          this.searchForm()().value.set(searchValue);
        }
      });
    });
  }

  search(): void {
    this.#userStore.setSearchForm(this.searchForm()().value());
    this.#userStore.searchUsers();
  }

  resetSearchForm(): void {
    this.#userStore.resetSearchForm();
  }
}
