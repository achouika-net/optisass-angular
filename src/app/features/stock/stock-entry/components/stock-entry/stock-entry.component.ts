import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DeviceCapabilitiesService } from '@app/core/services';
import { ResourceStore } from '@app/core/store';
import { TranslateModule } from '@ngx-translate/core';
import { ActionsButtonsComponent, CameraCaptureDialogComponent } from '@app/components';
import { ActionsButton } from '@app/models';
import { ISupplier } from '@app/models';
import {
  BulkConflictAction,
  calculateTotalQuantity,
  IBulkConflictDialogData,
  IOcrSupplierData,
  IOcrUploadResult,
  IProductSearchResult,
  ISplitDialogData,
  IStockEntryProductFormRow,
  ISupplierDiffDialogData,
  ISupplierDiffResult,
  ISupplierFieldDiff,
  IWarehouseAllocation,
  SupplierIdentifierField,
} from '../../models';
import { StockEntryStore } from '../../stock-entry.store';
import { StockEntryActionsComponent } from '../stock-entry-actions/stock-entry-actions.component';
import { StockEntryFormComponent } from '../stock-entry-form/stock-entry-form.component';
import { StockEntryTableComponent } from '../stock-entry-table/stock-entry-table.component';
import { ProductSearchDialogComponent } from '../product-search-dialog/product-search-dialog.component';
import { SplitQuantityDialogComponent } from '../split-quantity-dialog/split-quantity-dialog.component';
import { OcrUploadDialogComponent } from '../ocr-upload-dialog/ocr-upload-dialog.component';
import { SupplierQuickCreateDialogComponent } from '../supplier-quick-create-dialog/supplier-quick-create-dialog.component';
import { BulkActionConflictDialogComponent } from '../bulk-action-conflict-dialog/bulk-action-conflict-dialog.component';
import { SupplierInfoCardComponent } from '../supplier-info-card/supplier-info-card.component';
import { SupplierDiffDialogComponent } from '../supplier-diff-dialog/supplier-diff-dialog.component';

@Component({
  selector: 'app-stock-entry',
  templateUrl: './stock-entry.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatProgressSpinnerModule,
    TranslateModule,
    ActionsButtonsComponent,
    StockEntryFormComponent,
    StockEntryActionsComponent,
    StockEntryTableComponent,
    SupplierInfoCardComponent,
  ],
  providers: [StockEntryStore],
})
export class StockEntryComponent {
  readonly #router = inject(Router);
  readonly #dialog = inject(MatDialog);
  readonly #resourceStore = inject(ResourceStore);
  readonly #deviceCapabilities = inject(DeviceCapabilitiesService);
  readonly store = inject(StockEntryStore);

  readonly suppliers = this.#resourceStore.suppliers;
  readonly warehouses = this.#resourceStore.warehouses;
  readonly hasCamera = this.#deviceCapabilities.hasCamera;

  readonly showSupplierInfoCard = computed(() => {
    const supplier = this.store.supplier();
    return supplier.id !== null || !!supplier.name.trim();
  });

  readonly actionButtons = computed<ActionsButton[]>(() => {
    const buttons: ActionsButton[] = [
      {
        label: 'commun.chooseFile',
        icon: 'upload_file',
        action: 'upload',
        color: 'tertiary',
        direction: 'right',
        permissions: [],
      },
    ];

    if (this.hasCamera()) {
      buttons.push({
        label: 'commun.takePhoto',
        icon: 'photo_camera',
        action: 'camera',
        color: 'tertiary',
        direction: 'right',
        permissions: [],
      });
    }

    buttons.push({
      label: 'stock.entry.searchProduct',
      icon: 'search',
      action: 'search',
      direction: 'right',
      permissions: [],
    });

    return buttons;
  });

  /**
   * Handles product row changes.
   * @param event Change event with rowId and updates
   */
  onProductChange(event: { rowId: string; updates: Partial<IStockEntryProductFormRow> }): void {
    this.store.updateProduct(event.rowId, event.updates);
  }

  /**
   * Handles action button clicks.
   * @param action The action identifier
   */
  onAction(action: string): void {
    switch (action) {
      case 'upload':
        this.#openOcrDialog();
        break;
      case 'camera':
        this.#openCameraCaptureDialog();
        break;
      case 'search':
        this.openProductSearchDialog();
        break;
    }
  }

  /**
   * Opens camera capture dialog using getUserMedia.
   */
  #openCameraCaptureDialog(): void {
    const dialogRef = this.#dialog.open(CameraCaptureDialogComponent, {
      width: '600px',
      maxWidth: '95vw',
      disableClose: true,
    });

    dialogRef.afterClosed().subscribe((file: File | null) => {
      if (file) {
        this.#openOcrDialogWithFile(file);
      }
    });
  }

  /**
   * Opens OCR dialog for file selection (drag & drop or browse).
   */
  #openOcrDialog(): void {
    const dialogRef = this.#dialog.open(OcrUploadDialogComponent, {
      width: '500px',
      disableClose: true,
    });

    dialogRef.afterClosed().subscribe((result: IOcrUploadResult | null) => {
      if (!result) return;
      this.#handleOcrResult(result);
    });
  }

  /**
   * Opens OCR dialog with pre-selected file (from camera).
   * @param file The file to process
   */
  #openOcrDialogWithFile(file: File): void {
    const dialogRef = this.#dialog.open(OcrUploadDialogComponent, {
      width: '500px',
      disableClose: true,
      data: { file },
    });

    dialogRef.afterClosed().subscribe((result: IOcrUploadResult | null) => {
      if (!result) return;
      this.#handleOcrResult(result);
    });
  }

  /**
   * Handles OCR result and processes supplier matching.
   * @param result OCR upload result
   */
  #handleOcrResult(result: IOcrUploadResult): void {
    const ocrSupplier = this.store.loadFromOcr(result.invoice, result.confidence);

    if (!ocrSupplier) return;

    this.#processOcrSupplier(ocrSupplier);
  }

  /**
   * Processes OCR supplier data: matches against existing suppliers or creates new.
   * @param ocrSupplier OCR-extracted supplier data
   */
  #processOcrSupplier(ocrSupplier: IOcrSupplierData): void {
    const suppliers = this.suppliers();
    const matchResult = this.store.findSupplierByIdentifiers(ocrSupplier, suppliers);

    if (!matchResult) {
      const newSupplier = this.store.createSupplierFromOcr(ocrSupplier);
      this.store.setSupplier(newSupplier);
      return;
    }

    const diffs = this.store.computeSupplierDiffs(ocrSupplier, matchResult.supplier);

    if (diffs.length === 0) {
      this.store.setSupplier(matchResult.supplier);
      return;
    }

    this.#openSupplierDiffDialog(ocrSupplier, matchResult.supplier, matchResult.matchedBy, diffs);
  }

  /**
   * Opens supplier diff dialog when OCR data differs from existing supplier.
   * @param ocrSupplier OCR-extracted supplier data
   * @param existingSupplier Existing supplier from database
   * @param matchedBy Field that matched
   * @param diffs Field differences
   */
  #openSupplierDiffDialog(
    ocrSupplier: IOcrSupplierData,
    existingSupplier: ISupplier,
    matchedBy: SupplierIdentifierField,
    diffs: ISupplierFieldDiff[],
  ): void {
    const data: ISupplierDiffDialogData = {
      supplierName: existingSupplier.name,
      matchedBy,
      diffs,
    };

    const dialogRef = this.#dialog.open(SupplierDiffDialogComponent, {
      width: '600px',
      disableClose: true,
      data,
    });

    dialogRef.afterClosed().subscribe((result: ISupplierDiffResult | undefined) => {
      if (!result) {
        this.store.setSupplier(existingSupplier);
        return;
      }

      if (result.action === 'ignore_all') {
        this.store.setSupplier(existingSupplier);
      } else {
        const mergedSupplier = this.store.mergeSupplierWithOcr(
          existingSupplier,
          ocrSupplier,
          result.acceptedFields,
        );
        this.store.setSupplier(mergedSupplier);
      }
    });
  }

  /**
   * Opens new supplier creation dialog.
   */
  openNewSupplierDialog(): void {
    const dialogRef = this.#dialog.open(SupplierQuickCreateDialogComponent, {
      width: '600px',
      disableClose: true,
    });

    dialogRef.afterClosed().subscribe((result: ISupplier | null) => {
      if (result) {
        this.store.setSupplier(result);
      }
    });
  }

  /**
   * Opens product search dialog.
   */
  openProductSearchDialog(): void {
    const dialogRef = this.#dialog.open(ProductSearchDialogComponent, {
      width: '700px',
      maxHeight: '80vh',
    });

    dialogRef.afterClosed().subscribe((result: IProductSearchResult | null) => {
      if (!result) return;

      if (result.type === 'existing') {
        this.store.addExistingProduct(result.product, 1);
      } else {
        const rowId = this.store.addProduct();
        this.store.updateProduct(rowId, {
          designation: result.designation,
          productType: result.productType,
          _isExpanded: true,
        });
      }
    });
  }

  /**
   * Opens product edit dialog.
   * @param rowId Row ID to edit
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  openProductEditDialog(rowId: string): void {
    // TODO: Implement product edit dialog
  }

  /**
   * Opens split quantity dialog.
   * @param rowId Row ID to split
   */
  openSplitDialog(rowId: string): void {
    const product = this.store.products().find((p) => p._rowId === rowId);
    if (!product) return;

    const data: ISplitDialogData = {
      totalQuantity: calculateTotalQuantity(product.warehouseAllocations),
      currentAllocations: product.warehouseAllocations,
      designation: product.designation,
      warehouses: this.warehouses(),
    };

    const dialogRef = this.#dialog.open(SplitQuantityDialogComponent, {
      width: '600px',
      data,
    });

    dialogRef.afterClosed().subscribe((result: readonly IWarehouseAllocation[] | undefined) => {
      if (result) {
        this.store.setAllocations(rowId, result);
      }
    });
  }

  /**
   * Handles bulk warehouse change with conflict detection.
   * @param warehouseId Target warehouse ID
   */
  onBulkWarehouseChange(warehouseId: string): void {
    const conflictingProducts = this.store.getProductsWithSplits();

    if (conflictingProducts.length === 0) {
      this.store.applyBulkWarehouse(warehouseId);
      return;
    }

    const warehouse = this.warehouses().find((w) => String(w.id) === warehouseId);
    const data: IBulkConflictDialogData = {
      selectedCount: this.store.selectedCount(),
      conflictingProducts,
      targetWarehouseId: warehouseId,
      targetWarehouseName: warehouse?.name ?? warehouseId,
    };

    const dialogRef = this.#dialog.open(BulkActionConflictDialogComponent, {
      width: '500px',
      data,
    });

    dialogRef.afterClosed().subscribe((action: BulkConflictAction | undefined) => {
      if (!action || action === 'cancel') return;

      if (action === 'overwrite') {
        this.store.applyBulkWarehouse(warehouseId);
      } else if (action === 'exclude') {
        const excludeIds = new Set(conflictingProducts.map((p) => p.rowId));
        this.store.applyBulkWarehouse(warehouseId, excludeIds);
      }
    });
  }

  /**
   * Cancels and navigates back.
   */
  onCancel(): void {
    void this.#router.navigate(['/p/stock/products']);
  }

  /**
   * Submits the stock entry.
   */
  onSubmit(): void {
    this.store.submitEntry();
  }
}
