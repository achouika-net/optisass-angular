import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { ValidationErrors } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { displayDateFormatter } from '@app/helpers';
import { TranslateService } from '@ngx-translate/core';
import { PASSWORD_MIN_LENGTH } from '@app/config';

/**
 * @description
 * Angular component representing a form control error message.
 * This component is designed to be used within Angular forms to display error messages for form controls.
 * It takes inputs for pattern, field, and errors to dynamically generate the error message.
 *
 * @example
 * // In an Angular component template
 * <mat-error app-form-control-error [pattern]="somePattern" [field]="someFieldName" [errors]="someValidationErrors" />
 */
@Component({
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: '[app-form-control-error]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatFormFieldModule],
  template: `
    <ng-content select="[before]" />
    {{ errorMessage() }}
    <ng-content select="[after]" />
  `,
})
export class FormControlErrorComponent {
  readonly #translate = inject(TranslateService);

  pattern = input<string>(null);
  field = input<string>(null);
  errors = input.required<ValidationErrors>();
  customErrorMessage = input<Map<string, string>>();
  errorMessage = computed<string>(() =>
    this.#getErrorMessage(
      this.errors(),
      this.pattern(),
      this.field(),
      this.customErrorMessage(),
      this.#translate
    )
  );

  /**
   * This method generates list of error message based on the errors object
   * Errors must be ordered by priority
   * @param errors ValidationErrors
   * @param pattern to show on the specific pattern error message
   * @param field field name to display in error message
   * @param customMessages
   * @param translate
   * @returns
   */
  readonly #getErrorMessage = (
    errors: ValidationErrors,
    pattern: string,
    field: string,
    customMessages: Map<string, string>,
    translate: TranslateService
  ): string => {
    if (!errors) return '';
    const getCustomMessage = (key: string): string => {
      return customMessages?.has(key) ? translate.instant(customMessages.get(key)) : null;
    };
    for (const key of Object.keys(errors)) {
      switch (key) {
        case 'required':
          return (
            getCustomMessage(key) ||
            translate.instant('validators.required', {
              fieldName: translate.instant(`commun.${field ?? 'field'}`),
            })
          );
        case 'email':
          return getCustomMessage(key) || translate.instant('validators.email');
        case 'unique':
          return getCustomMessage(key) || translate.instant('validators.unique');
        case 'minlength':
        case 'maxlength':
        case 'min':
        case 'max': {
          const validatorValueParams: Record<string, number> = {
            minlength: errors.minlength?.requiredLength,
            maxlength: errors.maxlength?.requiredLength,
            min: errors.min?.min,
            max: errors.max?.max,
          };
          return (
            getCustomMessage(key) ||
            translate.instant(`validators.${key}`, {
              value: validatorValueParams[key],
            })
          );
        }
        case 'matDatepickerMin':
        case 'matDatepickerMax': {
          const isMax = key === 'matDatepickerMax';
          const date = displayDateFormatter(
            isMax ? errors.matDatepickerMax.max : errors.matDatepickerMin.min
          );
          const today = displayDateFormatter(new Date());
          return getCustomMessage(key) || today === date
            ? translate.instant(`validators.${key}Today`)
            : translate.instant(`validators.${key}`, {
                libelle: translate.instant(`commun.${field ?? 'theDate'}`),
                [isMax ? 'max' : 'min']: date,
              });
        }
        case 'passwordLength':
          return (
            getCustomMessage(key) ||
            translate.instant('validators.passwordLength', {
              length: PASSWORD_MIN_LENGTH,
            })
          );
        case 'pattern':
        case 'matDatepickerParse':
        case 'matEndDateInvalid':
        case 'matStartDateInvalid':
        case 'invalidDateRange':
        case 'lowerCaseCharactersRequired':
        case 'upperCaseCharactersRequired':
        case 'specialCharactersRequired':
        case 'numbersRequired':
        case 'passwordsMustBeEqual':
          return (
            getCustomMessage(key) ||
            translate.instant(
              `${key === 'pattern' ? 'validators.' + pattern : 'validators.' + key}`
            )
          );
        case 'prefixInvalid':
          return (
            getCustomMessage(key) ||
            translate.instant('validators.prefixInvalid', {
              prefix: errors.prefixInvalid?.requiredPrefix,
            })
          );
      }
    }
  };
}
