import { AfterViewInit, Directive, ElementRef, inject, input } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

/**
 * Directive that can be used to set the placeholder text.
 * if appFieldControlLabel is set with a value then placeholder is set with it else it took the value of the label
 *
 * @example
 * <mat-form-field [appFieldControlLabel]="Placeholder">
 *   <mat-label>Label</mat-label>
 *   <input matInput />
 * </mat-form-field>
 */
@Directive({
  selector: '[appFieldControlLabel]',
})
export class FieldControlLabelDirective implements AfterViewInit {
  private readonly translate = inject(TranslateService);
  private readonly el = inject(ElementRef);

  /**
   * The placeholder text to be displayed in the mat-form-field element.
   */
  appFieldControlLabel = input<string>();

  /**
   * Sets the placeholder text of the input element to the translated value of the appPlaceholder input.
   */
  ngAfterViewInit() {
    const select = this.el.nativeElement.querySelector('.mat-mdc-select-placeholder');
    const placeholder = this.getFieldControlPlaceholder(!!select);
    const input =
      this.el.nativeElement.querySelector('input') ||
      this.el.nativeElement.querySelector('textarea');
    // Check if input or select is disabled before applying the placeholder
    const isMatSelectDisabled =
      this.el.nativeElement.querySelector('.mat-mdc-select')?.getAttribute('aria-disabled') ===
      'true';

    if (!placeholder || input?.disabled || isMatSelectDisabled) {
      return;
    }

    // Check if the input or select already has a placeholder
    const hasInputPlaceholder = input?.getAttribute('placeholder');
    const hasSelectPlaceholder = select?.innerText.trim();

    // in case of input
    if (input && !hasInputPlaceholder) {
      input?.setAttribute('placeholder', placeholder);
    }

    // in case of select
    if (select && !hasSelectPlaceholder) {
      select.innerText = placeholder;
    }
  }

  /**
   * Récupérer le message placeholder selon le type (Input ou select)
   * @param {boolean} isSelect
   * @private {string}
   */
  private getFieldControlPlaceholder(isSelect: boolean): string {
    return (
      this.appFieldControlLabel() ||
      this.translate.instant(isSelect ? 'commun.placeholderSelect' : 'commun.placeholderInput')
    );
  }
}
