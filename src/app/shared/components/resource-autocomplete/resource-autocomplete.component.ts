import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  model,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import {
  debounce,
  disabled,
  form,
  FormField,
  FormValueControl,
  required,
} from '@angular/forms/signals';
import {
  MatAutocomplete,
  MatAutocompleteModule,
  MatAutocompleteSelectedEvent,
} from '@angular/material/autocomplete';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslateModule } from '@ngx-translate/core';
import { FieldErrorComponent } from '../field-error/field-error.component';
import { IAutocompleteOption } from './resource-autocomplete.model';

type AutocompleteValue = string | null;
type InternalFormValue = string | IAutocompleteOption | null;

@Component({
  selector: 'app-resource-autocomplete',
  templateUrl: './resource-autocomplete.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormField,
    MatFormFieldModule,
    MatInputModule,
    MatAutocompleteModule,
    TranslateModule,
    FieldErrorComponent,
  ],
})
export class ResourceAutocompleteComponent implements FormValueControl<AutocompleteValue> {
  private readonly autocomplete = viewChild.required<MatAutocomplete>('auto');
  readonly value = model<AutocompleteValue>(null);
  readonly disabled = input<boolean>(false);
  readonly required = input<boolean>(false);

  /** Options list */
  readonly options = input.required<IAutocompleteOption[]>();

  /** Key for stored value: 'id' or 'code' */
  readonly valueKey = input<'id' | 'code'>('code');

  /** Key for display: 'label' or 'name' */
  readonly labelKey = input<string>('label');

  /** Field placeholder */
  readonly placeholder = input<string>('');

  /** Show "All" option (value: null) at top */
  readonly showAllOption = input<boolean>(true);

  /** Translate labels via translate pipe */
  readonly translateLabels = input<boolean>(false);

  /** Internal signal for the form - stores string (typing) or object (selected) */
  readonly #formValue = signal<InternalFormValue>(null);

  /** Signal Form for mat-form-field invalid state */
  readonly internalForm = form(this.#formValue, (s) => {
    required(s, { when: () => this.required() && this.value() === null });
    disabled(s, this.disabled);
    debounce(s, 300);
  });

  /** Whether input is focused */
  readonly isFocused = signal<boolean>(false);

  /** Filtered options based on search text when focused */
  readonly filteredOptions = computed(() => {
    if (!this.isFocused()) return this.options();

    const val = this.internalForm().value();

    // If null or object selected, show all options
    if (val === null || typeof val === 'object') {
      return this.options();
    }

    // If string, filter
    const query = val.toLowerCase();
    if (!query) return this.options();

    const key = this.labelKey();
    return this.options().filter((opt) => {
      const label = this.#getOptionLabel(opt, key);
      return label.toLowerCase().includes(query);
    });
  });

  constructor() {
    // Sync parent value → internalForm (set object) when not focused and options are loaded
    effect(() => {
      const val = this.value();
      const opts = this.options();

      untracked(() => {
        if (!this.isFocused() && opts.length > 0) {
          if (val === null) {
            this.internalForm().value.set(null);
          } else {
            const selected = opts.find((opt) => opt[this.valueKey()] === val) ?? null;
            this.internalForm().value.set(selected);
          }
        }
      });
    });
  }

  /**
   * Handles field focus.
   */
  onFocus(): void {
    this.isFocused.set(true);
  }

  /**
   * Handles autocomplete panel opened event.
   */
  onPanelOpened(): void {
    const currentValue = this.value();
    if (currentValue !== null) {
      this.#selectMatchingOption(currentValue);
    }
  }

  /**
   * Handles option selection.
   * @param event Autocomplete selection event
   */
  onOptionSelected(event: MatAutocompleteSelectedEvent): void {
    const selectedOption = event.option.value as IAutocompleteOption | null;

    if (selectedOption === null) {
      this.value.set(null);
      this.internalForm().value.set(null);
    } else {
      const vKey = this.valueKey();
      const newValue = selectedOption[vKey] as string | null;
      this.value.set(newValue ?? null);
      this.internalForm().value.set(selectedOption);
    }
    this.isFocused.set(false);
  }

  /**
   * Handles autocomplete panel closed event.
   * Restores previous value if user typed without selecting.
   */
  onPanelClosed(): void {
    const current = this.internalForm().value();

    if (typeof current === 'string') {
      const previousValue = this.value();
      if (previousValue) {
        const selected = this.options().find((opt) => opt[this.valueKey()] === previousValue);
        this.internalForm().value.set(selected ?? null);
      } else {
        this.internalForm().value.set(null);
      }
    }

    this.isFocused.set(false);
  }

  /**
   * Display function for autocomplete.
   * @param option Option to display
   * @returns Option label
   */
  displayFn = (option: IAutocompleteOption | string | null): string => {
    if (!option) return '';
    if (typeof option === 'string') return option;
    return this.#getOptionLabel(option, this.labelKey());
  };

  /**
   * Gets option label based on configured key.
   * @param option Source option
   * @param key Label key ('label' or 'name')
   * @returns Option label
   */
  #getOptionLabel(option: IAutocompleteOption, key: string): string {
    const value = key === 'label' ? option.label : key === 'name' ? option.name : option.label;
    return String(value ?? option.label ?? option.name ?? '');
  }

  /**
   * Manually selects the matching option in the autocomplete panel.
   * @param valueToMatch Value to match against options
   */
  #selectMatchingOption(valueToMatch: string): void {
    const autocomplete = this.autocomplete();
    if (!autocomplete?.options) return;

    const vKey = this.valueKey();
    autocomplete.options.forEach((opt) => {
      const optValue = opt.value as IAutocompleteOption | null;
      if (optValue && optValue[vKey] === valueToMatch) {
        opt.select();
      } else {
        opt.deselect();
      }
    });
  }
}
