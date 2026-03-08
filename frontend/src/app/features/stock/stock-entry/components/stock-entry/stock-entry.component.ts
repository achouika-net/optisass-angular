import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  applyEach,
  disabled,
  FieldTree,
  form,
  min,
  required,
  validate,
} from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router } from '@angular/router';
import { ActionsButtonsComponent, CameraCaptureDialogComponent } from '@app/components';
import { DeviceCapabilitiesService } from '@app/core/services';
import { ResourceStore } from '@app/core/store';
import {
  ActionsButton,
  createEmptySupplier,
  ISupplier,
  ISupplierInvoice,
  Product,
} from '@app/models';
import { createStockEntryProductSchemaHelpers, productSchema } from '@app/validators';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ToastrService } from 'ngx-toastr';
import {
  BulkConflictAction,
  calculateTotalQuantity,
  createProductRow,
  createProductRowFromProduct,
  getDefaultStockEntryFormModel,
  IBulkConflictDialogData,
  IBulkConflictProduct,
  invoiceToFormData,
  IOcrSupplierData,
  IOcrUploadResult,
  IProductSearchResult,
  ISplitDialogData,
  IStockEntryFormModel,
  IStockEntryProductFormRow,
  ISupplierDiffDialogData,
  ISupplierDiffResult,
  ISupplierFieldDiff,
  IWarehouseAllocation,
  SupplierIdentifierField,
  toStockEntryRequest,
} from '../../models';
import { SupplierMatchingService } from '../../services';
import { StockEntryStore } from '../../stock-entry.store';
import { validateWarehouseAllocations } from '../../validators/stock-entry.validators';
import { BulkActionConflictDialogComponent } from '../bulk-action-conflict-dialog/bulk-action-conflict-dialog.component';
import { OcrUploadDialogComponent } from '../ocr-upload-dialog/ocr-upload-dialog.component';
import { ProductSearchDialogComponent } from '../product-search-dialog/product-search-dialog.component';
import { SplitQuantityDialogComponent } from '../split-quantity-dialog/split-quantity-dialog.component';
import { StockEntryActionsComponent } from '../stock-entry-actions/stock-entry-actions.component';
import { StockEntryHeaderComponent } from '../stock-entry-header/stock-entry-header.component';
import { StockEntryTableComponent } from '../stock-entry-table/stock-entry-table.component';
import { StockEntryTabsComponent } from '../stock-entry-tabs/stock-entry-tabs.component';
import { SupplierDiffDialogComponent } from '../supplier-diff-dialog/supplier-diff-dialog.component';
import { SupplierInfoComponent } from '../supplier-info/supplier-info.component';
import { SupplierQuickCreateDialogComponent } from '../supplier-quick-create-dialog/supplier-quick-create-dialog.component';

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
    StockEntryActionsComponent,
    StockEntryHeaderComponent,
    StockEntryTableComponent,
    StockEntryTabsComponent,
    SupplierInfoComponent,
  ],
  providers: [StockEntryStore],
})
export class StockEntryComponent {
  readonly #router = inject(Router);
  readonly #dialog = inject(MatDialog);
  readonly #resourceStore = inject(ResourceStore);
  readonly #deviceCapabilities = inject(DeviceCapabilitiesService);
  readonly #toastr = inject(ToastrService);
  readonly #translate = inject(TranslateService);
  readonly #supplierMatching = inject(SupplierMatchingService);
  readonly store = inject(StockEntryStore);

  readonly suppliers = this.#resourceStore.suppliers;
  readonly warehouses = this.#resourceStore.warehouses;
  readonly brands = this.#resourceStore.brands;
  readonly models = this.#resourceStore.models;
  readonly hasCamera = this.#deviceCapabilities.hasCamera;

  /**
   * Default warehouse (type PRINCIPALE) for new allocations.
   * Always exists per business rule.
   */
  readonly #defaultWarehouse = computed(
    () => this.warehouses().find((w) => w.type === 'PRINCIPALE' && w.active)!,
  );

  /**
   * Creates default warehouse allocation.
   * @param quantity Quantity for allocation
   * @returns Single allocation array with default warehouse
   */
  #createDefaultAllocation(quantity: number): readonly IWarehouseAllocation[] {
    return [{ warehouseId: String(this.#defaultWarehouse().id), quantity }];
  }

  readonly #formModel = signal<IStockEntryFormModel>(getDefaultStockEntryFormModel());
  readonly #selectedRowIds = signal<Set<string>>(new Set());

  readonly entryForm = form(this.#formModel, (fp) => {
    required(fp.documentNumber as any);
    required(fp.supplier.name as any);

    applyEach(fp.products, (rowPath) => {
      // Stock entry required fields (all products - existing and new)
      required(rowPath.purchasePriceExclTax as any);
      min(rowPath.purchasePriceExclTax as any, 0);

      validate(rowPath.warehouseAllocations as any, validateWarehouseAllocations);

      // Product schema validators (new products only - helpers include isNewProduct check)
      const helpers = createStockEntryProductSchemaHelpers(rowPath as any);
      productSchema(rowPath, helpers, { validateAlertThreshold: false, validateDesignation: true });

      // Disable modelId when no brand is selected
      disabled(rowPath.modelId as any, ({ valueOf }) => !valueOf(rowPath.brandId as any));
    });
  });

  readonly supplier = computed(() => this.#formModel().supplier);
  readonly documentNumber = computed(() => this.#formModel().documentNumber);
  readonly documentDate = computed(() => this.#formModel().documentDate);
  readonly documentType = computed(() => this.#formModel().documentType);
  readonly products = computed(() => this.#formModel().products);
  readonly selectedRowIds = this.#selectedRowIds.asReadonly();

  readonly totalProducts = computed(() => this.products().length);
  readonly selectedCount = computed(() => this.#selectedRowIds().size);

  readonly isFormValid = computed(() => {
    const model = this.#formModel();
    if (model.products.length === 0) return false;
    return !this.entryForm().invalid();
  });

  readonly incompleteProducts = computed(() => {
    const products = this.products();
    const incomplete: IStockEntryProductFormRow[] = [];

    for (let i = 0; i < products.length; i++) {
      const productField = this.entryForm.products[i];
      if (productField?.().invalid()) {
        incomplete.push(products[i]);
      }
    }
    return incomplete;
  });

  readonly showSupplierInfoCard = computed(() => {
    const supplier = this.supplier();
    return supplier.id !== null || !!supplier.name.trim();
  });

  readonly totalHT = computed(() => {
    return this.products().reduce((sum, p) => {
      const qty = calculateTotalQuantity(p.warehouseAllocations);
      const price = p.purchasePriceExclTax ?? 0;
      return sum + qty * price;
    }, 0);
  });

  readonly initialTabIndex = computed(() => {
    const supplier = this.supplier();
    const isOcrProcessed = this.products().some((p) => p._ocrConfidence !== null);
    const hasValidSupplier = !!supplier.name?.trim();

    if (isOcrProcessed && !hasValidSupplier) return 0;
    return 1;
  });

  /**
   * Function to get FieldTree for a product by index.
   * Used by stock-entry-table to pass FieldTree to stock-entry-row.
   */
  readonly getProductFieldsFn = (
    index: number,
  ): FieldTree<IStockEntryProductFormRow> | undefined => {
    return this.entryForm.products[index];
  };

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
   * Sets the supplier for the stock entry.
   * @param supplier The supplier to set, or null to clear
   */
  setSupplier(supplier: ISupplier | null): void {
    this.#formModel.update((m) => ({
      ...m,
      supplier: supplier ?? createEmptySupplier(),
    }));
  }

  /**
   * Adds a new empty product row.
   * @returns The created row ID
   */
  addProduct(): string {
    const row = createProductRow({
      warehouseAllocations: this.#createDefaultAllocation(1),
    });
    this.#formModel.update((m) => ({
      ...m,
      products: [...m.products, row],
    }));
    return row._rowId;
  }

  /**
   * Finds a duplicate product in the current list.
   * Checks by product ID (for existing products) or designation/brand/model (for new products).
   * @param productId Product ID to check (for existing products)
   * @param designation Designation to check (for new products)
   * @param brandId Brand ID to check
   * @param modelId Model ID to check
   * @returns The duplicate row or null
   */
  findDuplicate(
    productId: string | null,
    designation: string | null,
    brandId: string | null = null,
    modelId: string | null = null,
  ): IStockEntryProductFormRow | null {
    const products = this.products();

    if (productId) {
      const byId = products.find((p) => p.id === productId);
      if (byId) return byId;
    }

    if (designation) {
      const normalizedDesignation = designation.toLowerCase().trim();
      const byDesignation = products.find(
        (p) => p.designation?.toLowerCase().trim() === normalizedDesignation,
      );
      if (byDesignation) return byDesignation;
    }

    if (brandId && modelId) {
      const byBrandModel = products.find((p) => p.brandId === brandId && p.modelId === modelId);
      if (byBrandModel) return byBrandModel;
    }

    return null;
  }

  /**
   * Merges quantity into an existing product row.
   * @param existingRowId The existing row ID
   * @param additionalQuantity Quantity to add
   */
  mergeProduct(existingRowId: string, additionalQuantity: number): void {
    this.#formModel.update((m) => ({
      ...m,
      products: m.products.map((p) => {
        if (p._rowId !== existingRowId) return p;
        const newAllocations =
          p.warehouseAllocations.length > 0
            ? p.warehouseAllocations.map((a, i) =>
              i === 0 ? { ...a, quantity: a.quantity + additionalQuantity } : a,
            )
            : this.#createDefaultAllocation(additionalQuantity);
        return { ...p, warehouseAllocations: newAllocations };
      }),
    }));
    this.#toastr.success(this.#translate.instant('stock.entry.duplicate.merged'));
  }

  /**
   * Adds a product row from an existing product, handling duplicates.
   * @param product The existing product
   * @param quantity Initial quantity
   * @returns Object with rowId and whether it was merged
   */
  addExistingProduct(product: Product, quantity = 1): { rowId: string; merged: boolean } {
    const duplicate = this.findDuplicate(product.id, null);

    if (duplicate) {
      this.mergeProduct(duplicate._rowId, quantity);
      return { rowId: duplicate._rowId, merged: true };
    }

    const row = createProductRowFromProduct(product);
    const rowWithAllocation = {
      ...row,
      warehouseAllocations: this.#createDefaultAllocation(quantity),
    };
    this.#formModel.update((m) => ({
      ...m,
      products: [...m.products, rowWithAllocation],
    }));
    return { rowId: row._rowId, merged: false };
  }

  /**
   * Removes a product row by ID.
   * @param rowId The row ID to remove
   */
  removeProduct(rowId: string): void {
    this.#formModel.update((m) => ({
      ...m,
      products: m.products.filter((p) => p._rowId !== rowId),
    }));
    this.#selectedRowIds.update((ids) => {
      const newIds = new Set(ids);
      newIds.delete(rowId);
      return newIds;
    });
  }

  /**
   * Updates a product row.
   * @param rowId The row ID
   * @param updates The partial updates
   */
  updateProduct(rowId: string, updates: Partial<IStockEntryProductFormRow>): void {
    this.#formModel.update((m) => ({
      ...m,
      products: m.products.map((p) => (p._rowId === rowId ? { ...p, ...updates } : p)),
    }));
  }

  /**
   * Sets warehouse allocations for a product.
   * @param rowId The row ID
   * @param allocations The warehouse allocations
   */
  setAllocations(rowId: string, allocations: readonly IWarehouseAllocation[]): void {
    this.updateProduct(rowId, { warehouseAllocations: allocations });
  }

  /**
   * Toggles selection of a row.
   * @param rowId The row ID
   */
  toggleSelection(rowId: string): void {
    this.#selectedRowIds.update((ids) => {
      const newIds = new Set(ids);
      if (newIds.has(rowId)) {
        newIds.delete(rowId);
      } else {
        newIds.add(rowId);
      }
      return newIds;
    });
  }

  /**
   * Selects or deselects all rows.
   * @param selected Whether to select all
   */
  selectAll(selected: boolean): void {
    if (selected) {
      this.#selectedRowIds.set(new Set(this.products().map((p) => p._rowId)));
    } else {
      this.#selectedRowIds.set(new Set());
    }
  }

  /**
   * Toggles expansion of a row.
   * @param rowId The row ID
   */
  toggleExpand(rowId: string): void {
    this.#formModel.update((m) => ({
      ...m,
      products: m.products.map((p) =>
        p._rowId === rowId ? { ...p, _isExpanded: !p._isExpanded } : p,
      ),
    }));
  }

  /**
   * Navigates to the next product with validation errors.
   */
  goToNextError(): void {
    const products = this.products();
    const currentExpandedIdx = products.findIndex((p) => p._isExpanded);

    for (let i = currentExpandedIdx + 1; i < products.length; i++) {
      if (this.entryForm.products[i]?.().invalid()) {
        if (currentExpandedIdx >= 0) {
          this.toggleExpand(products[currentExpandedIdx]._rowId);
        }
        this.toggleExpand(products[i]._rowId);
        return;
      }
    }

    for (let i = 0; i < currentExpandedIdx; i++) {
      if (this.entryForm.products[i]?.().invalid()) {
        if (currentExpandedIdx >= 0) {
          this.toggleExpand(products[currentExpandedIdx]._rowId);
        }
        this.toggleExpand(products[i]._rowId);
        return;
      }
    }
  }

  /**
   * Deletes all selected products.
   */
  deleteSelectedProducts(): void {
    const selectedIds = this.#selectedRowIds();
    this.#formModel.update((m) => ({
      ...m,
      products: m.products.filter((p) => !selectedIds.has(p._rowId)),
    }));
    this.#selectedRowIds.set(new Set());
  }

  /**
   * Gets selected products with multiple warehouse allocations (splits).
   * @returns Products with conflicts
   */
  getProductsWithSplits(): readonly IBulkConflictProduct[] {
    const selectedIds = this.#selectedRowIds();
    return this.products()
      .filter((p) => selectedIds.has(p._rowId) && p.warehouseAllocations.length > 1)
      .map((p) => ({
        rowId: p._rowId,
        designation: p.designation,
        allocations: p.warehouseAllocations,
      }));
  }

  /**
   * Applies warehouse to all selected products.
   * @param warehouseId The warehouse ID
   * @param excludeRowIds Row IDs to exclude from the operation
   */
  applyBulkWarehouse(warehouseId: string, excludeRowIds: ReadonlySet<string> = new Set()): void {
    const selectedIds = this.#selectedRowIds();
    this.#formModel.update((m) => ({
      ...m,
      products: m.products.map((p) => {
        if (!selectedIds.has(p._rowId)) return p;
        if (excludeRowIds.has(p._rowId)) return p;
        const totalQty = calculateTotalQuantity(p.warehouseAllocations);
        const qty = totalQty > 0 ? totalQty : 1;
        const allocations: readonly IWarehouseAllocation[] = [{ warehouseId, quantity: qty }];
        return { ...p, warehouseAllocations: allocations };
      }),
    }));
  }

  /**
   * Applies TVA rate to all selected products.
   * @param tvaRate The TVA rate (0.20 for 20%)
   */
  applyBulkTva(tvaRate: number): void {
    const selectedIds = this.#selectedRowIds();
    this.#formModel.update((m) => ({
      ...m,
      products: m.products.map((p) => (selectedIds.has(p._rowId) ? { ...p, tvaRate } : p)),
    }));
  }

  /**
   * Runs product matching on all products without a match result.
   */
  #runProductMatching(): void {
    const productsToMatch = this.products()
      .filter((p) => !p._matchResult && p.designation)
      .map((p) => ({ rowId: p._rowId, designation: p.designation }));

    if (productsToMatch.length === 0) return;

    const supplierId = this.supplier().id;
    this.store.matchProducts(productsToMatch, supplierId).subscribe((results) => {
      if (results.length === 0) return;

      const resultsMap = new Map(results.map((r) => [r.rowId, r.result]));
      this.#formModel.update((m) => ({
        ...m,
        products: m.products.map((p) => {
          const matchResult = resultsMap.get(p._rowId);
          return matchResult ? { ...p, _matchResult: matchResult } : p;
        }),
      }));
    });
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
   * Extracts supplier data from OCR invoice and updates form.
   * @param invoice OCR-extracted invoice
   * @param confidence OCR confidence score
   * @returns Extracted supplier data or null if no supplier in invoice
   */
  #loadFromOcr(invoice: ISupplierInvoice, confidence: number): IOcrSupplierData | null {
    const defaultWarehouseId = String(this.#defaultWarehouse().id);
    const formData = invoiceToFormData(invoice, confidence, defaultWarehouseId);

    const ocrSupplier: IOcrSupplierData | null = invoice.supplier
      ? {
        name: invoice.supplier.name ?? null,
        ice: invoice.supplier.ice ?? null,
        fiscalId: invoice.supplier.fiscalId ?? null,
        tradeRegister: invoice.supplier.tradeRegister ?? null,
        cnss: invoice.supplier.cnss ?? null,
        patente: invoice.supplier.patente ?? null,
        address: invoice.supplier.address ?? null,
        phone: invoice.supplier.phone ?? null,
        email: invoice.supplier.email ?? null,
        bank: invoice.supplier.bank ?? null,
        rib: invoice.supplier.rib ?? null,
        addressDetails: invoice.supplier.addressDetails,
      }
      : null;

    // Update form model with OCR data
    this.#formModel.update((model) => ({
      ...model,
      documentNumber: formData.documentNumber,
      documentDate: formData.documentDate,
      products: [...model.products, ...formData.products],
    }));

    return ocrSupplier;
  }

  /**
   * Handles OCR result and processes supplier matching.
   * @param result OCR upload result
   */
  #handleOcrResult(result: IOcrUploadResult): void {
    const ocrSupplier = this.#loadFromOcr(result.invoice, result.confidence);

    this.#runProductMatching();

    if (!ocrSupplier) return;

    this.#processOcrSupplier(ocrSupplier);
  }

  /**
   * Uses SupplierMatchingService for matching logic.
   * @param ocrSupplier OCR-extracted supplier data
   */
  #processOcrSupplier(ocrSupplier: IOcrSupplierData): void {
    const suppliersList = this.suppliers();
    const matchResult = this.#supplierMatching.findByIdentifiers(ocrSupplier, suppliersList);

    if (!matchResult) {
      const newSupplier = this.#supplierMatching.createFromOcr(ocrSupplier);
      this.setSupplier(newSupplier);
      return;
    }

    const diffs = this.#supplierMatching.computeDiffs(ocrSupplier, matchResult.supplier);

    if (diffs.length === 0) {
      this.setSupplier(matchResult.supplier);
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
        this.setSupplier(existingSupplier);
        return;
      }

      if (result.action === 'ignore_all') {
        this.setSupplier(existingSupplier);
      } else {
        const mergedSupplier = this.#supplierMatching.mergeWithOcr(
          existingSupplier,
          ocrSupplier,
          result.acceptedFields,
        );
        this.setSupplier(mergedSupplier);
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
        this.setSupplier(result);
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
        this.addExistingProduct(result.product, 1);
      } else {
        const rowId = this.addProduct();
        this.updateProduct(rowId, {
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
    const product = this.products().find((p) => p._rowId === rowId);
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
        this.setAllocations(rowId, result);
      }
    });
  }

  /**
   * Handles bulk warehouse change with conflict detection.
   * @param warehouseId Target warehouse ID
   */
  onBulkWarehouseChange(warehouseId: string): void {
    const conflictingProducts = this.getProductsWithSplits();

    if (conflictingProducts.length === 0) {
      this.applyBulkWarehouse(warehouseId);
      return;
    }

    const warehouse = this.warehouses().find((w) => String(w.id) === warehouseId);
    const data: IBulkConflictDialogData = {
      selectedCount: this.selectedCount(),
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
        this.applyBulkWarehouse(warehouseId);
      } else if (action === 'exclude') {
        const excludeIds = new Set(conflictingProducts.map((p) => p.rowId));
        this.applyBulkWarehouse(warehouseId, excludeIds);
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
    const request = toStockEntryRequest(this.#formModel());
    this.store.submitEntry(request);
  }

  /**
   * Handles match suggestion selection.
   * @param event Event with rowId and productId
   */
  onMatchSuggestionSelect(event: { rowId: string; productId: string }): void {
    const product = this.products().find((p) => p._rowId === event.rowId);
    if (!product?._matchResult) return;

    this.updateProduct(event.rowId, {
      id: event.productId,
      _matchResult: {
        ...product._matchResult,
        matchedProductId: event.productId,
        confidence: 'high',
        method: 'manual',
      },
    });
  }

  /**
   * Handles match retry request.
   * @param rowId Row ID to retry matching
   */
  onMatchRetry(rowId: string): void {
    const product = this.products().find((p) => p._rowId === rowId);
    if (!product?.designation) return;

    const supplierId = this.supplier().id;
    this.store.matchProduct(product.designation, supplierId).subscribe((matchResult) => {
      this.updateProduct(rowId, { _matchResult: matchResult });
    });
  }

  /**
   * Clears the match result for a product row.
   * @param rowId The row ID
   */
  clearMatchResult(rowId: string): void {
    this.updateProduct(rowId, { _matchResult: null });
  }
}
