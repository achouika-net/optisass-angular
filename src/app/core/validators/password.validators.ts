import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { PASSWORD_MIN_LENGTH } from '@app/config';

/**
 * Validateur des caractères requis dans le mot de passe
 * @param control FormControl
 * @returns ValidationErrors | null
 */
export const validatePasswordPattern: ValidatorFn = (
  control: AbstractControl
): ValidationErrors | null => {
  const newPassword: string = control.value;
  if (!newPassword) return null;

  let errors = {};
  const ALLOWED_SYMBOLS = "!\"#$%&'()*+,-./:;<=>?@[\\]^_'{|}~";
  const SPECIAL_CHARACTERS_PATTERN = new RegExp(`[${ALLOWED_SYMBOLS}]`);
  const LOWER_CASE_PATTERN = new RegExp('[a-z]');
  const UPPER_CASE_PATTERN = new RegExp('[A-Z]');
  const NUMBERS_PATTERN = new RegExp('[0-9]');
  if (!SPECIAL_CHARACTERS_PATTERN.test(newPassword)) {
    errors = { ...errors, specialCharactersRequired: true };
  }
  if (!LOWER_CASE_PATTERN.test(newPassword)) {
    errors = { ...errors, lowerCaseCharactersRequired: true };
  }
  if (!UPPER_CASE_PATTERN.test(newPassword)) {
    errors = { ...errors, upperCaseCharactersRequired: true };
  }
  if (!NUMBERS_PATTERN.test(newPassword)) {
    errors = { ...errors, numbersRequired: true };
  }
  if (newPassword.length < PASSWORD_MIN_LENGTH) {
    errors = { ...errors, passwordLength: true };
  }
  return errors;
};

/**
 * Valide que les deux mots de passes sont identiques
 * @param control FormControl
 * @returns ValidationErrors | null
 */
export const validateSamePasswords: ValidatorFn = (
  control: AbstractControl
): ValidationErrors | null => {
  const password = control.parent?.get('password');
  const confirmPassword = control.parent?.get('confirmPassword');
  return password?.value == confirmPassword?.value
    ? null
    : { passwordsMustBeEqual: true };
};
