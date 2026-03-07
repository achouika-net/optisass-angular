import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule } from '@ngx-translate/core';
import {
  ISupplierDiffDialogData,
  ISupplierDiffResult,
  ISupplierFieldDiff,
  SupplierDiffField,
} from '../../models';

interface IFieldDiffState extends ISupplierFieldDiff {
  accepted: boolean;
}

@Component({
  selector: 'app-supplier-diff-dialog',
  templateUrl: './supplier-diff-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatCheckboxModule, MatDialogModule, MatIconModule, TranslateModule],
})
export class SupplierDiffDialogComponent {
  readonly #dialogRef = inject(MatDialogRef<SupplierDiffDialogComponent, ISupplierDiffResult>);
  readonly #data = inject<ISupplierDiffDialogData>(MAT_DIALOG_DATA);

  readonly supplierName = this.#data.supplierName;
  readonly matchedBy = this.#data.matchedBy;

  readonly diffs = signal<IFieldDiffState[]>(
    this.#data.diffs.map((d) => ({ ...d, accepted: false })),
  );

  readonly acceptedCount = computed(() => this.diffs().filter((d) => d.accepted).length);

  readonly allAccepted = computed(() => this.diffs().every((d) => d.accepted));

  /**
   * Toggles acceptance of a specific field diff.
   * @param field The field to toggle
   */
  toggleField(field: SupplierDiffField): void {
    this.diffs.update((diffs) =>
      diffs.map((d) => (d.field === field ? { ...d, accepted: !d.accepted } : d)),
    );
  }

  /**
   * Accepts all field diffs.
   */
  acceptAll(): void {
    this.diffs.update((diffs) => diffs.map((d) => ({ ...d, accepted: true })));
  }

  /**
   * Ignores all and closes dialog.
   */
  ignoreAll(): void {
    this.#dialogRef.close({
      action: 'ignore_all',
      acceptedFields: [],
    });
  }

  /**
   * Confirms selection and closes dialog.
   */
  confirm(): void {
    const acceptedFields = this.diffs()
      .filter((d) => d.accepted)
      .map((d) => d.field);

    const action =
      acceptedFields.length === this.diffs().length
        ? 'accept_all'
        : acceptedFields.length > 0
          ? 'partial'
          : 'ignore_all';

    this.#dialogRef.close({
      action,
      acceptedFields,
    });
  }

  /**
   * Cancels dialog without changes.
   */
  cancel(): void {
    this.#dialogRef.close(undefined);
  }
}
