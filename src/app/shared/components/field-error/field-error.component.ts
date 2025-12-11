import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { ValidationError } from '@angular/forms/signals';
import { MatFormFieldModule } from '@angular/material/form-field';
import { PASSWORD_MIN_LENGTH } from '@app/config';
import { displayDateFormatter } from '@app/helpers';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

/**
 * @description
 * Component for displaying error messages from Signal Forms (Angular 21+).
 * Automatically generates error messages based on validator type without needing
 * to specify messages in the validator definitions.
 *
 * @example
 * // In template - Simple usage (auto-detects error type)
 * @if (loginForm.email().touched() && loginForm.email().invalid()) {
 *   <mat-error app-field-error [errors]="loginForm.email().errors()" />
 * }
 *
 * // With field name for better error messages
 * @if (loginForm.email().touched() && loginForm.email().invalid()) {
 *   <mat-error app-field-error [errors]="loginForm.email().errors()" field="email" />
 * }
 */
@Component({
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: '[app-field-error]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatFormFieldModule, TranslateModule],
  template: `
    <ng-content select="[before]" />
    {{ errorMessage() }}
    <ng-content select="[after]" />
  `,
})
export class FieldErrorComponent {
  readonly #translate = inject(TranslateService);

  /**
   * The errors array from Signal Forms (e.g., loginForm.email().errors())
   */
  errors = input.required<ValidationError.WithField[]>();

  /**
   * Optional field name for more descriptive error messages
   */
  fieldname = input<string>();

  /**
   * Optional pattern type for pattern validation errors
   */
  pattern = input<string>();

  /**
   * Optional custom error messages map
   */
  customErrorMessage = input<Map<string, string>>();

  /**
   * Computed error message based on the errors array
   */
  errorMessage = computed<string>(() => {
    const errors = this.errors();
    if (!errors || errors.length === 0) {
      return '';
    }

    return this.#generateErrorMessage(
      errors[0], // Get first error
      this.pattern(),
      this.fieldname(),
      this.customErrorMessage()
    );
  });

  /**
   * Generates error message based on the error object from Signal Forms
   */
  readonly #generateErrorMessage = (
    error: ValidationError.WithField,
    pattern: string,
    field: string,
    customMessages: Map<string, string>
  ): string => {
    if (!error) return '';

    const getCustomMessage = (key: string): string => {
      return customMessages?.has(key) ? this.#translate.instant(customMessages.get(key)) : null;
    };

    // If error has a message property, use it (for custom validators)
    if (error.message) {
      return this.#translate.instant(error.message);
    }

    // Use the error.kind property to determine the error type
    const errorType = error.kind;

    switch (errorType) {
      case 'required':
        return (
          getCustomMessage('required') ||
          this.#translate.instant('validators.required', {
            fieldName: this.#translate.instant(`commun.${field ?? 'field'}`),
          })
        );

      case 'email':
        return getCustomMessage('email') || this.#translate.instant('validators.email');

      case 'pattern':
        // Try to detect common patterns
        const detectedPattern = pattern || this.#detectPatternType(error);
        return (
          getCustomMessage('pattern') ||
          this.#translate.instant(`validators.${detectedPattern || 'pattern'}`)
        );

      case 'minlength':
      case 'maxlength':
      case 'min':
      case 'max': {
        const valueKey =
          errorType === 'minlength' || errorType === 'maxlength' ? 'requiredLength' : errorType;
        return (
          getCustomMessage(errorType) ||
          this.#translate.instant(`validators.${errorType}`, {
            value: (error as any)[valueKey] || (error as any).value,
          })
        );
      }

      case 'matDatepickerMin':
      case 'matDatepickerMax': {
        const isMax = errorType === 'matDatepickerMax';
        const date = displayDateFormatter(isMax ? (error as any).max : (error as any).min);
        const today = displayDateFormatter(new Date());
        return getCustomMessage(errorType) || today === date
          ? this.#translate.instant(`validators.${errorType}Today`)
          : this.#translate.instant(`validators.${errorType}`, {
              libelle: this.#translate.instant(`commun.${field ?? 'theDate'}`),
              [isMax ? 'max' : 'min']: date,
            });
      }

      case 'passwordLength':
        return (
          getCustomMessage('passwordLength') ||
          this.#translate.instant('validators.passwordLength', {
            length: PASSWORD_MIN_LENGTH,
          })
        );

      default:
        // For other validators, try to use the error type as translation key
        return getCustomMessage(errorType) || this.#translate.instant(`validators.${errorType}`);
    }
  };

  /**
   * Tries to detect the pattern type from the error object
   */
  readonly #detectPatternType = (error: ValidationError.WithField): string => {
    if (error.kind === 'pattern' && (error as any).pattern) {
      const patternStr = (error as any).pattern.toString();
      // Check if it matches EMAIL_PATTERN
      if (patternStr.includes('@') || patternStr.includes('email')) {
        return 'email';
      }
    }
    return 'pattern';
  };
}
