import { ChangeDetectionStrategy, Component, computed, inject, input, model, viewChild } from '@angular/core';
import { rxResource, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Field, FieldTree, FormField } from '@angular/forms/signals';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { FieldErrorComponent } from '@app/components';
import { ControlLabelDirective } from '@app/directives';
import { IAddress } from '@app/models';
import { TranslateModule } from '@ngx-translate/core';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { GeoapifyAddressService } from './geoapify-address.service';
import { IAddressOption } from './geoapify-address.model';

@Component({
  selector: 'app-address-fields',
  templateUrl: './address-fields.component.html',
  styleUrl: './address-fields.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.standalone-layout]': '!inheritParentLayout()',
  },
  imports: [

    MatFormFieldModule,
    MatInputModule,
    MatAutocompleteModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    TranslateModule,
    ControlLabelDirective,
    FieldErrorComponent,
    FormField,
  ],
})
export class AddressFieldsComponent {
  readonly #addressService = inject(GeoapifyAddressService);

  // ===== FIELDTREE INPUT (Angular 21 Child Form Pattern) =====

  readonly address = model.required<FieldTree<IAddress>>();

  // ===== COMPONENT-SPECIFIC INPUTS =====

  streetLabelKey = input<string>('address.street');
  streetLine2LabelKey = input<string>('address.streetLine2');
  postcodeLabelKey = input<string>('address.postcode');
  cityLabelKey = input<string>('address.city');
  countryCode = input<string>('ma');
  inheritParentLayout = input<boolean>(true);

  // ===== COMPUTED FIELD ACCESSORS =====

  readonly streetField = computed(() => (this.address() as any).street);
  readonly streetLine2Field = computed(() => (this.address() as any).streetLine2);
  readonly postcodeField = computed(() => (this.address() as any).postcode);
  readonly cityField = computed(() => (this.address() as any).city);

  // ===== AUTOCOMPLETE =====

  readonly #streetValue = computed(() => (this.address() as any).street().value() || '');

  readonly #debouncedStreetQuery = toSignal(
    toObservable(this.#streetValue).pipe(debounceTime(400), distinctUntilChanged()),
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

  // ===== COMPUTED FOR UI STATE =====

  readonly isDisabled = computed(() => (this.address() as any).street().disabled());
  readonly isReadonly = computed(() => (this.address() as any).street().readonly());
  readonly isHidden = computed(() => (this.address() as any).street().hidden());

  // ===== EVENT HANDLERS =====

  /**
   * Handles address selection from autocomplete
   * @param event - Material Autocomplete selection event
   */
  onOptionSelected(event: MatAutocompleteSelectedEvent): void {
    const selectedAddress = event.option.value as IAddressOption;

    // Build street with housenumber if available
    const street = selectedAddress.housenumber
      ? `${selectedAddress.housenumber} ${selectedAddress.street || ''}`
      : selectedAddress.street || selectedAddress.formatted;

    // Update all fields via FieldTree
    const addr = this.address() as any;
    addr.street().value.set(street);
    addr.postcode().value.set(selectedAddress.postcode || null);
    addr.city().value.set(selectedAddress.city || null);
    addr.country().value.set(selectedAddress.country || null);
    addr.lat().value.set(selectedAddress.lat || null);
    addr.lon().value.set(selectedAddress.lon || null);
  }

  /**
   * Clears all address fields
   */
  clear(): void {
    const addr = this.address() as any;
    addr.street().value.set(null);
    addr.streetLine2().value.set(null);
    addr.postcode().value.set(null);
    addr.city().value.set(null);
    addr.country().value.set(null);
    addr.lat().value.set(null);
    addr.lon().value.set(null);
  }

  /**
   * Display function for autocomplete
   * @param option - Selected option (IAddressOption or string)
   * @returns Text to display in input
   */
  displayFn = (option: IAddressOption | string | null): string => {
    if (!option) return '';
    return typeof option === 'string' ? option : option.formatted;
  };
}
