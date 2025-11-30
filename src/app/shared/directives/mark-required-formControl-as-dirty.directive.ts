import { DestroyRef, Directive, Input, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormArray,
  FormControl,
  FormGroup,
  FormGroupDirective,
} from '@angular/forms';
import { Subject } from 'rxjs';

@Directive({
  selector: '[appMarkRequiredFormControlAsDirty]',
})
export class MarkRequiredFormControlAsDirtyDirective implements OnInit {
  #ngControl = inject(FormGroupDirective, { optional: true });
  #destroyRef = inject(DestroyRef);

  @Input() updateRequiredStatus$: Subject<void>;

  ngOnInit(): void {
    this.markAllControlsAsDirty(this.#ngControl.form);
    // Triggers `markAllControlsAsDirty` method whenever a new value is emitted.
    this.updateRequiredStatus$
      ?.pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe(() => this.markAllControlsAsDirty(this.#ngControl.form));
  }

  /**
   * Recursively marks all controls in the given `AbstractControl` and its child controls as dirty.
   * @param {AbstractControl} abstractControl - The control to mark as dirty.
   */
  private markAllControlsAsDirty(abstractControl: AbstractControl): void {
    if (abstractControl instanceof FormControl && abstractControl.invalid) {
      abstractControl.markAsDirty({ onlySelf: true });
      abstractControl.markAsTouched();
    } else if (
      abstractControl instanceof FormGroup ||
      abstractControl instanceof FormArray
    ) {
      Object.values(abstractControl.controls).forEach((control) =>
        this.markAllControlsAsDirty(control)
      );
    }
  }
}
