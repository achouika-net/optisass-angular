import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { FieldControlLabelDirective } from '@app/directives';
import { TranslateModule } from '@ngx-translate/core';
import { ISplitDialogData, ISplitDialogResult, IWarehouseAllocation } from '../../models';

interface IAllocationRow {
  readonly id: string;
  warehouseId: string | null;
  quantity: number;
}

@Component({
  selector: 'app-split-quantity-dialog',
  templateUrl: './split-quantity-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FieldControlLabelDirective,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    TranslateModule,
  ],
})
export class SplitQuantityDialogComponent {
  readonly #dialogRef = inject(MatDialogRef<SplitQuantityDialogComponent, ISplitDialogResult>);
  readonly #data = inject<ISplitDialogData>(MAT_DIALOG_DATA);

  readonly warehouses = this.#data.warehouses;
  readonly totalQuantity = this.#data.totalQuantity;
  readonly designation = this.#data.designation;

  readonly allocations = signal<IAllocationRow[]>(this.#initAllocations());

  readonly allocatedQuantity = computed(() =>
    this.allocations().reduce((sum, a) => sum + (a.quantity || 0), 0),
  );

  readonly remainingQuantity = computed(() => this.totalQuantity - this.allocatedQuantity());

  readonly isValid = computed(() => {
    const allocs = this.allocations();
    if (allocs.length === 0) return false;
    if (this.remainingQuantity() !== 0) return false;
    return allocs.every((a) => a.warehouseId !== null && a.quantity > 0);
  });

  /**
   * Initializes allocations from existing data or creates default.
   * @returns Initial allocation rows
   */
  #initAllocations(): IAllocationRow[] {
    const existing = this.#data.currentAllocations;
    if (existing.length > 0) {
      return existing.map((a) => ({
        id: crypto.randomUUID(),
        warehouseId: a.warehouseId,
        quantity: a.quantity,
      }));
    }
    return [{ id: crypto.randomUUID(), warehouseId: null, quantity: this.#data.totalQuantity }];
  }

  /**
   * Adds a new allocation row.
   */
  addRow(): void {
    this.allocations.update((rows) => [
      ...rows,
      { id: crypto.randomUUID(), warehouseId: null, quantity: 0 },
    ]);
  }

  /**
   * Removes an allocation row by ID.
   * @param id Row ID to remove
   */
  removeRow(id: string): void {
    this.allocations.update((rows) => rows.filter((r) => r.id !== id));
  }

  /**
   * Updates warehouse for an allocation.
   * @param id Row ID
   * @param warehouseId New warehouse ID
   */
  onWarehouseChange(id: string, warehouseId: string): void {
    this.allocations.update((rows) => rows.map((r) => (r.id === id ? { ...r, warehouseId } : r)));
  }

  /**
   * Updates quantity for an allocation.
   * @param id Row ID
   * @param event Input event
   */
  onQuantityChange(id: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    const quantity = parseInt(input.value, 10) || 0;
    this.allocations.update((rows) => rows.map((r) => (r.id === id ? { ...r, quantity } : r)));
  }

  /**
   * Distributes remaining quantity evenly.
   */
  distributeEvenly(): void {
    const allocs = this.allocations();
    if (allocs.length === 0) return;

    const perRow = Math.floor(this.totalQuantity / allocs.length);
    const remainder = this.totalQuantity % allocs.length;

    this.allocations.update((rows) =>
      rows.map((r, i) => ({ ...r, quantity: perRow + (i < remainder ? 1 : 0) })),
    );
  }

  /**
   * Confirms and closes with result.
   */
  confirm(): void {
    const result: IWarehouseAllocation[] = this.allocations()
      .filter((a) => a.warehouseId !== null && a.quantity > 0)
      .map((a) => ({ warehouseId: a.warehouseId!, quantity: a.quantity }));
    this.#dialogRef.close(result);
  }

  /**
   * Cancels and closes without result.
   */
  cancel(): void {
    this.#dialogRef.close(undefined);
  }
}
