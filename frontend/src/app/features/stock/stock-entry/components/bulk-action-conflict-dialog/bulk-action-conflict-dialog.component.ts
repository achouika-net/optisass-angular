import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule } from '@ngx-translate/core';
import { BulkConflictAction, IBulkConflictDialogData } from '../../models';

@Component({
  selector: 'app-bulk-action-conflict-dialog',
  templateUrl: './bulk-action-conflict-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatDialogModule, MatButtonModule, MatIconModule, TranslateModule],
})
export class BulkActionConflictDialogComponent {
  readonly #dialogRef = inject(MatDialogRef<BulkActionConflictDialogComponent, BulkConflictAction>);
  readonly data = inject<IBulkConflictDialogData>(MAT_DIALOG_DATA);

  /**
   * Formats warehouse allocations for display.
   * @param allocations Warehouse allocations
   * @returns Formatted string
   */
  formatAllocations(allocations: readonly { warehouseId: string; quantity: number }[]): string {
    return allocations.map((a) => `${a.quantity}`).join(' + ');
  }

  /**
   * Closes with overwrite action.
   */
  overwrite(): void {
    this.#dialogRef.close('overwrite');
  }

  /**
   * Closes with exclude action.
   */
  exclude(): void {
    this.#dialogRef.close('exclude');
  }

  /**
   * Closes with cancel action.
   */
  cancel(): void {
    this.#dialogRef.close('cancel');
  }
}
