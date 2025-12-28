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
import { Field, FieldTree } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { States } from '@app/config';
import { FieldControlLabelDirective } from '@app/directives';
import { IResource } from '@app/models';
import { TranslateModule } from '@ngx-translate/core';
import { IClientSearch } from '../../../models';
import { ClientStore } from '../../../client.store';

@Component({
  selector: 'app-client-search-form',
  templateUrl: './client-search-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    Field,
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
export class ClientSearchFormComponent {
  #clientStore = inject(ClientStore);

  readonly searchForm = input.required<FieldTree<IClientSearch>>();
  #searchValue: Signal<IClientSearch> = this.#clientStore.state.searchForm;
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
    this.#clientStore.setSearchForm(this.searchForm()().value());
    this.#clientStore.searchClients();
  }

  resetSearchForm(): void {
    this.#clientStore.resetSearchForm();
  }
}
