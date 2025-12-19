import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { TranslateModule } from '@ngx-translate/core';

/**
 * A dialog component for selecting a reason for inactivity.
 */
@Component({
  selector: 'app-inactivity-reason-popup',
  templateUrl: './inactivity-reason-popup.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslateModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
  ],
})
export class InactivityReasonPopupComponent {
  readonly #dialogRef = inject<MatDialogRef<InactivityReasonPopupComponent, string>>(MatDialogRef);
  reason = new FormControl<string>('');

  /**
   * Updates the reason for deactivation and closes the dialog.
   * @param {boolean} confirm - A flag indicating whether the reason is confirmed or not.
   */
  saveReason(): void {
    const value = this.reason.getRawValue();
    this.#dialogRef.close(value);
  }
}
