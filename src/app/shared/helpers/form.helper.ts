import { FormGroup, FormArray, AbstractControl } from '@angular/forms';

/**
 * Returns an object containing the updated values from a given form group or form array.
 *
 * @param {FormGroup<any> | FormArray<any>} form - The form group or form array to get dirty values from.
 * @returns {any} - The object containing the updated values.
 */

// eslint-disable-next-line  @typescript-eslint/no-explicit-any
export const getDirtyValues = (form: FormGroup<any> | FormArray<any>): any => {
  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  const dirtyValues: any = Object.entries(form.controls).reduce(
    // eslint-disable-next-line  @typescript-eslint/no-explicit-any
    (acc: any, [key, currentControl]: [string, any]) => {
      if (currentControl.dirty) {
        acc[key] = currentControl.controls
          ? getDirtyValues(currentControl)
          : currentControl.value;
      }
      return acc;
    },
    {}
  );

  return form instanceof FormArray ? Object.values(dirtyValues) : dirtyValues;
};

/**
 * Efface une erreur de validation spécifique d'un champ.
 * @param control Le champ de contrôle.
 * @param errorKey La clé de l'erreur à supprimer.
 */
export const clearError = (
  control: AbstractControl,
  errorKey: string
): void => {
  const errors = control?.errors;
  if (errors?.[errorKey]) {
    delete errors[errorKey];
    control?.setErrors(Object.keys(errors).length > 0 ? errors : null);
  }
};

/**
 * Ajoute une erreur de validation à un champ.
 * @param control Le champ de contrôle.
 * @param errorKey La clé de l'erreur à ajouter.
 * @param params
 */
export const setError = (
  control: AbstractControl,
  errorKey: string,
  params?: unknown
): void => {
  control?.setErrors({ ...control?.errors, [errorKey]: params || true });
  control?.markAsDirty();
};
