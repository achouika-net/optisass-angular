import { Directive, inject } from '@angular/core';
import { NgControl } from '@angular/forms';

@Directive({
  selector: '[appCapitalizeFirstLetter]',
  host: { '(blur)': 'capitalizeFirstLetter()' },
})
export class CapitalizeFirstLetterDirective {
  ngControl = inject(NgControl, { self: true });

  capitalizeFirstLetter(): void {
    const value = this.ngControl.control.value;

    if (value?.length) {
      this.ngControl.control.setValue(
        value.charAt(0).toUpperCase() + value.slice(1)
      );
    }
  }
}
