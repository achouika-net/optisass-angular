import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { rxResource, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormValueControl, ValidationError } from '@angular/forms/signals';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { GeoapifyAddressService } from './geoapify-address.service';
import { IAddressOption } from './geoapify-address.model';

/**
 * Signal Forms compatible address autocomplete component.
 * Uses rxResource for efficient async data fetching with automatic loading/error states.
 *
 * @example
 * <app-address-autocomplete
 *   [field]="warehouseForm.address"
 *   [label]="'warehouse.address' | translate"
 * />
 */
@Component({
  selector: 'app-address-autocomplete',
  templateUrl: './address-autocomplete.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatFormFieldModule,
    MatInputModule,
    MatAutocompleteModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    TranslateModule,
  ],
})
export class AddressAutocompleteComponent implements FormValueControl<string | null> {
  readonly #addressService = inject(GeoapifyAddressService);
  readonly #translate = inject(TranslateService);

  // ===== FormValueControl REQUIRED =====

  value = model<string | null>(null);

  // ===== FormUiControl OPTIONAL (auto-bound by [field] directive) =====

  touched = input<boolean>(false);
  dirty = input<boolean>(false);
  errors = input<readonly ValidationError.WithOptionalField[]>([]);
  valid = input<boolean>(true);
  invalid = input<boolean>(false);
  pending = input<boolean>(false);
  disabled = input<boolean>(false);
  readonly = input<boolean>(false);
  hidden = input<boolean>(false);
  required = input<boolean>(false);
  name = input<string>();

  // ===== COMPONENT-SPECIFIC INPUTS =====

  label = input<string>(this.#translate.instant('commun.address'));
  placeholder = input<string>(this.#translate.instant('commun.enterAddressForSearch'));
  minSearchLength = input<number>(3);
  countryCode = input<string>('ma');

  // ===== OUTPUTS =====

  addressSelected = output<IAddressOption>();
  blurred = output<void>();

  readonly inputValue = signal<string>('');
  readonly internalTouched = signal<boolean>(false);

  readonly #debouncedQuery = toSignal(
    toObservable(this.inputValue).pipe(debounceTime(400), distinctUntilChanged()),
    { initialValue: '' }
  );

  readonly addressResource = rxResource({
    params: () => ({
      query: this.#debouncedQuery(),
      countryCode: this.countryCode(),
      minLength: this.minSearchLength(),
    }),
    stream: ({ params }) =>
      this.#addressService.searchAddresses(params.query, params.minLength, params.countryCode),
    defaultValue: [],
  });

  readonly isTouched = computed(() => this.touched() || this.internalTouched());
  readonly showError = computed(() => this.isTouched() && this.invalid());

  readonly hintMessage = computed(() => {
    const inputLen = this.inputValue()?.length || 0;
    const minLen = this.minSearchLength();
    if (inputLen > 0 && inputLen < minLen) {
      return this.#translate.instant('validators.atLeast', { value: minLen - inputLen });
    }
    return '';
  });

  constructor() {
    effect(() => {
      const val = this.value();
      if (val && val !== this.inputValue()) {
        this.inputValue.set(val);
      }
    });
  }

  // ===== EVENT HANDLERS =====

  /**
   * Gère la saisie utilisateur dans l'input
   * @param event - Événement input natif
   */
  onInput(event: Event): void {
    this.inputValue.set((event.target as HTMLInputElement).value);
  }

  /**
   * Gère la sélection d'une adresse dans l'autocomplete
   * @param event - Événement de sélection Material Autocomplete
   */
  onOptionSelected(event: MatAutocompleteSelectedEvent): void {
    const address = event.option.value as IAddressOption;
    this.value.set(address.formatted);
    this.inputValue.set(address.formatted);
    this.addressSelected.emit(address);
  }

  /**
   * Gère la perte de focus de l'input
   * Met à jour la valeur si l'utilisateur a saisi sans sélectionner
   */
  onBlur(): void {
    this.internalTouched.set(true);
    const input = this.inputValue();
    if (input && input !== this.value()) {
      this.value.set(input);
    }
    this.blurred.emit();
  }

  /**
   * Efface la valeur de l'input
   */
  clear(): void {
    this.value.set(null);
    this.inputValue.set('');
  }

  /**
   * Fonction d'affichage pour l'autocomplete Material
   * @param option - Option sélectionnée (IAddressOption ou string)
   * @returns Texte à afficher dans l'input
   */
  displayFn = (option: IAddressOption | string): string => {
    if (!option) return '';
    return typeof option === 'string' ? option : option.formatted;
  };
}
