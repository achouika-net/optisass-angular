import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  model,
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
import { AddressField, IAddress } from '@app/models';
import { GeoapifyAddressService } from './geoapify-address.service';
import { IAddressOption } from './geoapify-address.model';

@Component({
  selector: 'app-address-fields',
  templateUrl: './address-fields.component.html',
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
export class AddressFieldsComponent implements FormValueControl<IAddress | null> {
  readonly #addressService = inject(GeoapifyAddressService);
  readonly #translate = inject(TranslateService);

  // ===== FormValueControl REQUIRED =====

  value = model<IAddress | null>(null);

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

  streetLabel = input<string>(this.#translate.instant('address.street'));
  streetLine2Label = input<string>(this.#translate.instant('address.streetLine2'));
  postcodeLabel = input<string>(this.#translate.instant('address.postcode'));
  cityLabel = input<string>(this.#translate.instant('address.city'));
  countryCode = input<string>('ma');

  // ===== ADDRESS REQUIRED INPUT =====
  // When addressRequired=true (default), street, postcode, and city show asterisks

  addressRequired = input<boolean>(true);

  readonly streetRequired = computed(() => this.addressRequired());
  readonly postcodeRequired = computed(() => this.addressRequired());
  readonly cityRequired = computed(() => this.addressRequired());

  // ===== INTERNAL STATE =====

  readonly streetInput = signal<string>('');
  readonly streetLine2Input = signal<string>('');
  readonly postcodeInput = signal<string>('');
  readonly cityInput = signal<string>('');

  readonly fieldTouched = signal<Record<AddressField, boolean>>({
    street: false,
    streetLine2: false,
    postcode: false,
    city: false,
  });

  // ===== AUTOCOMPLETE =====

  readonly #debouncedStreetQuery = toSignal(
    toObservable(this.streetInput).pipe(debounceTime(400), distinctUntilChanged()),
    { initialValue: '' }
  );

  readonly addressResource = rxResource({
    params: () => ({
      query: this.#debouncedStreetQuery(),
      countryCode: this.countryCode(),
    }),
    stream: ({ params }) => this.#addressService.searchAddresses(params.query, 3, params.countryCode),
    defaultValue: [],
  });

  // ===== COMPUTED FOR ERRORS =====

  readonly streetErrors = computed(() => this.#getFieldErrors('street'));
  readonly streetLine2Errors = computed(() => this.#getFieldErrors('streetLine2'));
  readonly postcodeErrors = computed(() => this.#getFieldErrors('postcode'));
  readonly cityErrors = computed(() => this.#getFieldErrors('city'));

  readonly showStreetError = computed(() => this.#shouldShowError('street'));
  readonly showStreetLine2Error = computed(() => this.#shouldShowError('streetLine2'));
  readonly showPostcodeError = computed(() => this.#shouldShowError('postcode'));
  readonly showCityError = computed(() => this.#shouldShowError('city'));

  constructor() {
    // Sync external value to internal inputs
    effect(() => {
      const addr = this.value();
      if (addr) {
        if (addr.street !== null && addr.street !== this.streetInput()) {
          this.streetInput.set(addr.street);
        }
        if (addr.streetLine2 !== undefined && addr.streetLine2 !== this.streetLine2Input()) {
          this.streetLine2Input.set(addr.streetLine2 || '');
        }
        if (addr.postcode !== null && addr.postcode !== this.postcodeInput()) {
          this.postcodeInput.set(addr.postcode);
        }
        if (addr.city !== null && addr.city !== this.cityInput()) {
          this.cityInput.set(addr.city);
        }
      }
    });
  }

  // ===== EVENT HANDLERS =====

  /**
   * Handles street input changes
   * @param event - Native input event
   */
  onStreetInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.streetInput.set(value);
    this.#updateValue({ street: value || null });
  }

  /**
   * Handles street line 2 input changes
   * @param event - Native input event
   */
  onStreetLine2Input(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.streetLine2Input.set(value);
    this.#updateValue({ streetLine2: value || null });
  }

  /**
   * Handles postcode input changes
   * @param event - Native input event
   */
  onPostcodeInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.postcodeInput.set(value);
    this.#updateValue({ postcode: value || null });
  }

  /**
   * Handles city input changes
   * @param event - Native input event
   */
  onCityInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.cityInput.set(value);
    this.#updateValue({ city: value || null });
  }

  /**
   * Handles address selection from autocomplete
   * @param event - Material Autocomplete selection event
   */
  onOptionSelected(event: MatAutocompleteSelectedEvent): void {
    const address = event.option.value as IAddressOption;

    // Build street with housenumber if available
    const street = address.housenumber
      ? `${address.housenumber} ${address.street || ''}`
      : address.street || address.formatted;

    this.streetInput.set(street);
    this.postcodeInput.set(address.postcode || '');
    this.cityInput.set(address.city || '');

    this.value.set({
      street,
      streetLine2: this.streetLine2Input() || null,
      postcode: address.postcode || null,
      city: address.city || null,
      country: address.country || null,
      lat: address.lat || null,
      lon: address.lon || null,
    });
  }

  /**
   * Handles field blur events
   * @param field - The field that lost focus
   */
  onBlur(field: AddressField): void {
    this.fieldTouched.update((current) => ({ ...current, [field]: true }));
  }

  /**
   * Clears all address fields
   */
  clear(): void {
    this.streetInput.set('');
    this.streetLine2Input.set('');
    this.postcodeInput.set('');
    this.cityInput.set('');
    this.value.set(null);
  }

  /**
   * Display function for autocomplete
   * @param option - Selected option (IAddressOption or string)
   * @returns Text to display in input
   */
  displayFn = (option: IAddressOption | string): string => {
    if (!option) return '';
    return typeof option === 'string' ? option : option.formatted;
  };

  // ===== PRIVATE METHODS =====

  /**
   * Updates the value with partial address data
   * @param partial - Partial address to merge
   */
  #updateValue(partial: Partial<IAddress>): void {
    const current = this.value() || {
      street: null,
      streetLine2: null,
      postcode: null,
      city: null,
      country: null,
      lat: null,
      lon: null,
    };
    this.value.set({ ...current, ...partial });
  }

  /**
   * Gets validation errors for a specific field
   * @param field - Field name to get errors for
   * @returns Array of validation errors for the field
   */
  #getFieldErrors(field: AddressField): readonly ValidationError.WithOptionalField[] {
    return this.errors().filter((error) => {
      const fieldTree = error.fieldTree;
      // Check if error is for this specific nested field
      // fieldTree could be like ['address', 'street'] or just contain the field name
      if (Array.isArray(fieldTree)) {
        return fieldTree.includes(field) || fieldTree[fieldTree.length - 1] === field;
      }
      return false;
    });
  }

  /**
   * Determines if error should be shown for a field
   * @param field - Field name to check
   * @returns True if error should be displayed
   */
  #shouldShowError(field: AddressField): boolean {
    const isTouched = this.touched() || this.fieldTouched()[field];
    const hasErrors = this.#getFieldErrors(field).length > 0;
    return isTouched && hasErrors;
  }
}
