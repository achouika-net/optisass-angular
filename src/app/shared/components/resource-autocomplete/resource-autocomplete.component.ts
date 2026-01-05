import { ChangeDetectionStrategy, Component, computed, input, model, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormValueControl } from '@angular/forms/signals';
import {
  MatAutocompleteModule,
  MatAutocompleteSelectedEvent,
} from '@angular/material/autocomplete';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslateModule } from '@ngx-translate/core';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { IAutocompleteOption } from './resource-autocomplete.model';

@Component({
  selector: 'app-resource-autocomplete',
  templateUrl: './resource-autocomplete.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatFormFieldModule, MatInputModule, MatAutocompleteModule, TranslateModule],
})
export class ResourceAutocompleteComponent implements FormValueControl<string | number | null> {
  readonly value = model<string | number | null>(null);

  /** Liste des options à afficher dans l'autocomplete */
  readonly options = input.required<IAutocompleteOption[]>();

  /** Clé pour la valeur stockée: 'id' (warehouses, brands) ou 'code' (productTypes, statuses) */
  readonly valueKey = input<'id' | 'code'>('id');

  /** Clé pour l'affichage: 'label' ou 'name' */
  readonly labelKey = input<string>('label');

  /** Placeholder du champ */
  readonly placeholder = input<string>('');

  /** Afficher l'option "Tous" (value: null) en haut de la liste */
  readonly showAllOption = input<boolean>(true);

  /** Traduire les labels via le pipe translate */
  readonly translateLabels = input<boolean>(false);

  readonly searchQuery = signal<string>('');
  readonly isFocused = signal<boolean>(false);

  readonly #debouncedQuery = toSignal(
    toObservable(this.searchQuery).pipe(debounceTime(200), distinctUntilChanged()),
    { initialValue: '' },
  );

  readonly filteredOptions = computed(() => {
    const query = this.#debouncedQuery().toLowerCase();
    const options = this.options();
    const key = this.labelKey();

    if (!query) return options;

    return options.filter((opt) => {
      const label = this.#getOptionLabel(opt, key);
      return label.toLowerCase().includes(query);
    });
  });

  readonly selectedOption = computed(() => {
    const selectedValue = this.value();
    if (selectedValue === null || selectedValue === undefined) return null;

    const vKey = this.valueKey();
    return this.options().find((opt) => opt[vKey] === selectedValue) ?? null;
  });

  readonly displayValue = computed(() => {
    const selected = this.selectedOption();
    if (!selected) return '';
    return this.#getOptionLabel(selected, this.labelKey());
  });

  readonly inputDisplayValue = computed(() => {
    if (this.isFocused()) {
      return this.searchQuery();
    }
    return this.displayValue();
  });

  /**
   * Gère la saisie utilisateur dans le champ.
   * @param event Événement de saisie
   */
  onInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchQuery.set(value);
  }

  /**
   * Gère le focus sur le champ.
   */
  onFocus(): void {
    this.isFocused.set(true);
    this.searchQuery.set('');
  }

  /**
   * Gère la sélection d'une option.
   * @param event Événement de sélection autocomplete
   */
  onOptionSelected(event: MatAutocompleteSelectedEvent): void {
    const selectedOption = event.option.value as IAutocompleteOption | null;

    if (selectedOption === null) {
      this.value.set(null);
    } else {
      const vKey = this.valueKey();
      const newValue = selectedOption[vKey] as string | number | null;
      this.value.set(newValue ?? null);
    }
    this.searchQuery.set('');
    this.isFocused.set(false);
  }

  /**
   * Gère la perte de focus du champ.
   */
  onBlur(): void {
    setTimeout(() => {
      this.searchQuery.set('');
      this.isFocused.set(false);
    }, 200);
  }

  /**
   * Fonction d'affichage pour l'autocomplete.
   * @param option Option à afficher
   * @returns Label de l'option
   */
  displayFn = (option: IAutocompleteOption | null): string => {
    if (!option) return '';
    return this.#getOptionLabel(option, this.labelKey());
  };

  /**
   * Récupère le label d'une option selon la clé configurée.
   * @param option Option source
   * @param key Clé du label ('label' ou 'name')
   * @returns Label de l'option
   */
  #getOptionLabel(option: IAutocompleteOption, key: string): string {
    const value = key === 'label' ? option.label : key === 'name' ? option.name : option.label;
    return String(value ?? option.label ?? option.name ?? '');
  }
}
