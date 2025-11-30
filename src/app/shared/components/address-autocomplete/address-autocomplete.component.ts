import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  output,
  OutputEmitterRef,
  Signal,
  signal,
  viewChild,
  AfterViewInit,
} from '@angular/core';
import {
  AsyncValidatorFn,
  ControlValueAccessor,
  FormControl,
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
  ReactiveFormsModule,
  ValidationErrors,
  Validator,
  ValidatorFn,
} from '@angular/forms';
import { MatAutocompleteModule, MatAutocompleteTrigger } from '@angular/material/autocomplete';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import {
  FieldControlLabelDirective,
  MarkRequiredFormControlAsDirtyDirective,
} from '@app/directives';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { FormControlErrorComponent } from '@app/components';
import { Address, IAddress } from './address.model';
import { rxResource, takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { debounceTime, map, tap } from 'rxjs/operators';
import { catchError, of } from 'rxjs';
import { ToastrService } from 'ngx-toastr';
import { AddressService } from './address.service';
import { MIN_LENGTH_SEARCH } from '@app/config';
import { MatOptionSelectionChange } from '@angular/material/core';

@Component({
  selector: 'app-address-autocomplete',
  templateUrl: './address-autocomplete.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FieldControlLabelDirective,
    TranslateModule,
    ReactiveFormsModule,
    MatAutocompleteModule,
    MatFormFieldModule,
    MatInputModule,
    FormControlErrorComponent,
    MatSlideToggleModule,
    MarkRequiredFormControlAsDirtyDirective,
  ],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: AddressAutocompleteComponent,
      multi: true,
    },
    {
      provide: NG_VALIDATORS,
      useExisting: AddressAutocompleteComponent,
      multi: true,
    },
    AddressService,
  ],
})
export class AddressAutocompleteComponent
  implements ControlValueAccessor, Validator, AfterViewInit
{
  #addressService = inject(AddressService);
  #toastr = inject(ToastrService);
  #translate = inject(TranslateService);
  #destroyRef = inject(DestroyRef);
  public formControlName = input<string>();
  public validatorFn = input.required<ValidatorFn>();
  public asyncValidatorFn = input<AsyncValidatorFn>(null);
  public selectAddressOutput: OutputEmitterRef<IAddress> = output<IAddress>();
  addressControl = new FormControl<string | IAddress>(null);
  trigger = viewChild(MatAutocompleteTrigger);
  onChange: (value: string | IAddress) => void;
  onTouch: () => void;
  onValidationChange: () => void;
  atLeastMessage = (value: string, minLength = MIN_LENGTH_SEARCH): string => {
    return this.#translate.instant('validators.atLeast', {
      value: minLength - (value?.length ?? 0),
    });
  };
  message: Signal<string> = computed(() => {
    const value = this.input();
    if (typeof value === 'string' && value?.trim().length < MIN_LENGTH_SEARCH) {
      return this.atLeastMessage(value.trim());
    }
    return '';
  });
  input = signal<string | IAddress>('');
  label = input<string>(this.#translate.instant('commun.address'));
  debouncedInput = toSignal(toObservable(this.input).pipe(debounceTime(600)));
  #searchParams = computed<{ input: string | IAddress }>(() => ({
    input: this.debouncedInput(),
  }));

  addressResource = rxResource<IAddress[], { input: string | IAddress }>({
    params: () => this.#searchParams(),
    stream: ({ params }) => {
      if (params.input && typeof params.input !== 'string') {
        return of([params.input]);
      }
      const input = (params.input as string) || '';
      if (input.length < MIN_LENGTH_SEARCH) {
        return of([]);
      }

      return this.#addressService.searchAdress(input).pipe(
        map((result: IAddress[]) => {
          result.unshift(new Address(input));
          return result;
        }),
        catchError(() => {
          this.#toastr.error(this.#translate.instant('error.searchAddress'));
          return of([]);
        })
      );
    },
    defaultValue: [],
  });

  constructor() {
    effect(() => {
      this.addressControl.setValidators(this.validatorFn());
      this.addressControl.markAsTouched();
    });
    effect(() => {
      this.addressControl.setAsyncValidators(this.asyncValidatorFn());
      this.addressControl.markAsTouched();
    });
  }

  /**
   * to write a value into a form control
   * @param value string
   */
  writeValue(value: string): void {
    this.addressControl.setValue(value);
    this.input.set(value);
  }

  /**
   * report the value back to the parent form by calling a callback
   * @param fn
   */
  registerOnChange(fn: (value: string | IAddress) => void) {
    this.onChange = fn;
  }

  /**
   * @param {() => void} fn
   */
  registerOnValidatorChange?(fn: () => void): void {
    this.onValidationChange = fn;
  }

  /**
   * report to the parent form that the control was touched
   * @param fn
   */
  registerOnTouched(fn: () => void) {
    this.onTouch = fn;
  }

  /**
   * Sets the disabled state of the form control.
   * @param isDisabled Whether the form control should be disabled or not.
   */
  setDisabledState(isDisabled: boolean): void {
    if (isDisabled) {
      this.addressControl.disable();
    }
  }

  /**
   * @returns {ValidationErrors}
   */
  validate(): ValidationErrors {
    return !this.addressControl.valid ? this.addressControl.errors : null;
  }

  /**
   * Specify the value of the option in the autocomplete
   * @param {IAddress | string} address
   * @return {string}
   */
  displayFn(address: IAddress | string): string {
    if (!address) {
      return null;
    }
    return typeof address === 'string'
      ? address
      : `${address?.adresse} ${address?.cp || address?.ville ? ' ,' : ''} ${address?.cp} ${
          address?.ville
        }`.trim();
  }

  ngAfterViewInit() {
    this.onOpenAutoComplete();
  }

  /**
   * à l'ouverture de autocompletePanel on s'abonne à l'event panelClosingActions afin
   * de forcer la selection depuis le panel donc soit
   * on récupére la valeur de l'option sélectionner, soit on
   * sélectionne la première option disponible , si l'utilisateur n'a pas choisi d'option,
   * sinon on vide le champ si la recherche n'a pas de résultat
   */
  onOpenAutoComplete(): void {
    this.trigger()
      .panelClosingActions.pipe(
        takeUntilDestroyed(this.#destroyRef),
        tap((e: MatOptionSelectionChange | null) => {
          const address: IAddress = e ? e.source.value : this.addressResource.value()[0] ?? null;
          this.addressControl.setValue(address);
          this.onChange(this.displayFn(address));
          this.selectAddressOutput.emit({
            ...address,
            adresse: this.displayFn(address),
          });
          this.onTouch();
          this.input.set(address);
          this.trigger().closePanel();
        })
      )
      .subscribe();
  }
}
