import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  forwardRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  ControlValueAccessor,
  FormControl,
  NG_VALUE_ACCESSOR,
  ReactiveFormsModule,
} from '@angular/forms';
import {
  MatAutocomplete,
  MatAutocompleteTrigger,
} from '@angular/material/autocomplete';
import { MatOptionSelectionChange } from '@angular/material/core';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatOption } from '@angular/material/select';
import { FieldControlLabelDirective } from '@app/directives';
import { TranslatePipe } from '@ngx-translate/core';
import { tap } from 'rxjs/operators';

@Component({
  selector: 'app-timezone-select',
  templateUrl: './timezone-select.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => TimezoneSelectComponent),
      multi: true,
    },
  ],
  imports: [
    MatFormField,
    MatLabel,
    MatOption,
    MatInput,
    ReactiveFormsModule,
    FieldControlLabelDirective,
    MatAutocompleteTrigger,
    MatAutocomplete,
    TranslatePipe,
  ],
})
export class TimezoneSelectComponent implements ControlValueAccessor {
  readonly #destroyRef = inject(DestroyRef);
  trigger = viewChild(MatAutocompleteTrigger);
  #timezones = signal(Intl.supportedValuesOf('timeZone'));
  searchControl = new FormControl('');
  onChange: (value: string | null) => void;
  onTouched: VoidFunction;
  #searchControlValueChanges = toSignal(this.searchControl.valueChanges);
  protected filteredTimezones = computed(() => {
    const val = (this.#searchControlValueChanges() || '').toLowerCase();
    return this.#timezones()
      .filter(
        (tz) =>
          tz.toLowerCase().includes(val) ||
          this.formatTimezone(tz).toLowerCase().includes(val)
      )
      .map((tz) => ({
        value: tz,
        label: this.formatTimezone(tz),
      }));
  });

  displayTimezone = (tz: string | null): string =>
    tz ? this.formatTimezone(tz) : '';
  constructor() {
    afterNextRender(() => this.onOpenAutoComplete());
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
          const timeZone = e
            ? e.source.value
            : (this.filteredTimezones()[0].value ?? null);
          this.searchControl.setValue(timeZone);
          this.onChange(timeZone);
          this.onTouched();
          this.trigger().closePanel();
        })
      )
      .subscribe();
  }

  /**
   * to write a value into a form control
   * @param { string } value
   */
  writeValue(value: string | null): void {
    this.searchControl.setValue(value);
  }

  /**
   * to register a function to be called when the control's value changes'
   * @param {string | null) => void} fn
   */
  registerOnChange(fn: (value: string | null) => void): void {
    this.onChange = fn;
  }

  /**
   * to register a function to be called when the control receives a touch event
   * @param {VoidFunction} fn
   */
  registerOnTouched(fn: VoidFunction): void {
    this.onTouched = fn;
  }

  /**
   * handle disable state
   * @param isDisabled
   */
  setDisabledState(isDisabled: boolean): void {
    if (isDisabled) {
      this.searchControl.disable();
    } else {
      this.searchControl.enable();
    }
  }

  /**
   * format the timezone to display it in the select
   * ex: America/New_York => (GMT-05:00) Eastern Time (US & Canada)
   * @param {string} tz
   * @return {string}
   */
  formatTimezone(tz: string): string {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      timeZoneName: 'shortOffset',
    });
    const parts = formatter.formatToParts(now);
    const offset = parts.find((p) => p.type === 'timeZoneName')?.value ?? '';
    const city = tz.split('/').pop()?.replace(/_/g, ' ') ?? tz;
    return `(${offset}) ${city}`;
  }
}
