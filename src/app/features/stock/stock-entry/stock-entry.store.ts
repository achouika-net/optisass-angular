import { HttpErrorResponse } from '@angular/common/http';
import { computed, inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { createEmptyAddress, createEmptySupplier, ISupplier, Product } from '@app/models';
import { ErrorService } from '@app/services';
import { patchState, signalState } from '@ngrx/signals';
import { TranslateService } from '@ngx-translate/core';
import { ToastrService } from 'ngx-toastr';
import { catchError, of, tap } from 'rxjs';
import {
  calculateTotalQuantity,
  createProductRow,
  createProductRowFromProduct,
  DocumentType,
  getDefaultStockEntryFormModel,
  IBulkConflictProduct,
  invoiceToFormData,
  IOcrSupplierData,
  isProductRowComplete,
  IStockEntryFormModel,
  IStockEntryProductFormRow,
  ISupplierFieldDiff,
  IWarehouseAllocation,
  SupplierDiffField,
  SupplierIdentifierField,
  toStockEntryRequest,
} from './models';
import { ISupplierInvoice } from '@optisaas/opti-saas-lib';
import { StockEntryService } from './services';

interface StockEntryState {
  formModel: IStockEntryFormModel;
  selectedRowIds: Set<string>;
  isSubmitting: boolean;
  isProcessingOcr: boolean;
}

@Injectable()
export class StockEntryStore {
  readonly #router = inject(Router);
  readonly #service = inject(StockEntryService);
  readonly #errorService = inject(ErrorService);
  readonly #toastr = inject(ToastrService);
  readonly #translate = inject(TranslateService);

  readonly #state = signalState<StockEntryState>({
    formModel: getDefaultStockEntryFormModel(),
    selectedRowIds: new Set<string>(),
    isSubmitting: false,
    isProcessingOcr: false,
  });

  readonly formModel = this.#state.formModel;
  readonly selectedRowIds = this.#state.selectedRowIds;
  readonly isSubmitting = this.#state.isSubmitting;
  readonly isProcessingOcr = this.#state.isProcessingOcr;

  readonly supplier = computed(() => this.#state.formModel().supplier);
  readonly documentNumber = computed(() => this.#state.formModel().documentNumber);
  readonly documentDate = computed(() => this.#state.formModel().documentDate);
  readonly documentType = computed(() => this.#state.formModel().documentType);
  readonly products = computed(() => this.#state.formModel().products);

  readonly totalProducts = computed(() => this.products().length);
  readonly selectedCount = computed(() => this.#state.selectedRowIds().size);

  readonly incompleteProducts = computed(() =>
    this.products().filter((p) => !isProductRowComplete(p)),
  );

  readonly isFormValid = computed(() => {
    const model = this.#state.formModel();
    if (!model.documentNumber) return false;
    if (!model.supplier.name) return false;
    if (model.products.length === 0) return false;
    return this.incompleteProducts().length === 0;
  });

  /**
   * Sets the supplier for the entry.
   * @param supplier The supplier or null
   */
  setSupplier(supplier: ISupplier | null): void {
    patchState(this.#state, (state) => ({
      formModel: {
        ...state.formModel,
        supplier: supplier ?? createEmptySupplier(),
      },
    }));
  }

  /**
   * Sets the document number.
   * @param documentNumber The document number
   */
  setDocumentNumber(documentNumber: string): void {
    patchState(this.#state, (state) => ({
      formModel: { ...state.formModel, documentNumber },
    }));
  }

  /**
   * Sets the document date.
   * @param documentDate The document date
   */
  setDocumentDate(documentDate: Date): void {
    patchState(this.#state, (state) => ({
      formModel: { ...state.formModel, documentDate },
    }));
  }

  /**
   * Sets the document type.
   * @param documentType The document type
   */
  setDocumentType(documentType: DocumentType): void {
    patchState(this.#state, (state) => ({
      formModel: { ...state.formModel, documentType },
    }));
  }

  /**
   * Adds a new empty product row.
   * @returns The created row ID
   */
  addProduct(): string {
    const row = createProductRow();
    patchState(this.#state, (state) => ({
      formModel: {
        ...state.formModel,
        products: [...state.formModel.products, row],
      },
    }));
    return row._rowId;
  }

  /**
   * Finds a duplicate product in the current list.
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
      return products.find((p) => p.id === productId) ?? null;
    }

    if (designation) {
      const normalizedDesignation = designation.toLowerCase().trim();
      const byDesignation = products.find(
        (p) => p.designation?.toLowerCase().trim() === normalizedDesignation,
      );
      if (byDesignation) return byDesignation;
    }

    if (brandId && modelId) {
      return products.find((p) => p.brandId === brandId && p.modelId === modelId) ?? null;
    }

    return null;
  }

  /**
   * Merges quantity into an existing product row.
   * @param existingRowId The existing row ID
   * @param additionalQuantity Quantity to add
   */
  mergeProduct(existingRowId: string, additionalQuantity: number): void {
    patchState(this.#state, (state) => ({
      formModel: {
        ...state.formModel,
        products: state.formModel.products.map((p) => {
          if (p._rowId !== existingRowId) return p;
          const newAllocations =
            p.warehouseAllocations.length > 0
              ? p.warehouseAllocations.map((a, i) =>
                  i === 0 ? { ...a, quantity: a.quantity + additionalQuantity } : a,
                )
              : [];
          return { ...p, warehouseAllocations: newAllocations };
        }),
      },
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

    const row = createProductRowFromProduct(product, quantity);
    patchState(this.#state, (state) => ({
      formModel: {
        ...state.formModel,
        products: [...state.formModel.products, row],
      },
    }));
    return { rowId: row._rowId, merged: false };
  }

  /**
   * Removes a product row by ID.
   * @param rowId The row ID to remove
   */
  removeProduct(rowId: string): void {
    patchState(this.#state, (state) => {
      const newSelectedIds = new Set(state.selectedRowIds);
      newSelectedIds.delete(rowId);
      return {
        formModel: {
          ...state.formModel,
          products: state.formModel.products.filter((p) => p._rowId !== rowId),
        },
        selectedRowIds: newSelectedIds,
      };
    });
  }

  /**
   * Updates a product row.
   * @param rowId The row ID
   * @param updates The partial updates
   */
  updateProduct(rowId: string, updates: Partial<IStockEntryProductFormRow>): void {
    patchState(this.#state, (state) => ({
      formModel: {
        ...state.formModel,
        products: state.formModel.products.map((p) => {
          if (p._rowId !== rowId) return p;
          return { ...p, ...updates };
        }),
      },
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
    patchState(this.#state, (state) => {
      const newIds = new Set(state.selectedRowIds);
      if (newIds.has(rowId)) {
        newIds.delete(rowId);
      } else {
        newIds.add(rowId);
      }
      return { selectedRowIds: newIds };
    });
  }

  /**
   * Selects or deselects all rows.
   * @param selected Whether to select all
   */
  selectAll(selected: boolean): void {
    if (selected) {
      patchState(this.#state, (state) => ({
        selectedRowIds: new Set(state.formModel.products.map((p) => p._rowId)),
      }));
    } else {
      patchState(this.#state, { selectedRowIds: new Set() });
    }
  }

  /**
   * Toggles expansion of a row.
   * @param rowId The row ID
   */
  toggleExpand(rowId: string): void {
    patchState(this.#state, (state) => ({
      formModel: {
        ...state.formModel,
        products: state.formModel.products.map((p) => {
          if (p._rowId !== rowId) return p;
          return { ...p, _isExpanded: !p._isExpanded };
        }),
      },
    }));
  }

  /**
   * Gets selected products with multiple warehouse allocations (splits).
   * @returns Products with conflicts
   */
  getProductsWithSplits(): readonly IBulkConflictProduct[] {
    const selectedIds = this.#state.selectedRowIds();
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
    const selectedIds = this.#state.selectedRowIds();
    patchState(this.#state, (state) => ({
      formModel: {
        ...state.formModel,
        products: state.formModel.products.map((p) => {
          if (!selectedIds.has(p._rowId)) return p;
          if (excludeRowIds.has(p._rowId)) return p;
          const totalQty = calculateTotalQuantity(p.warehouseAllocations);
          const qty = totalQty > 0 ? totalQty : 1;
          const allocations: readonly IWarehouseAllocation[] = [{ warehouseId, quantity: qty }];
          return { ...p, warehouseAllocations: allocations };
        }),
      },
    }));
  }

  /**
   * Applies TVA rate to all selected products.
   * @param tvaRate The TVA rate (0.20 for 20%)
   */
  applyBulkTva(tvaRate: number): void {
    const selectedIds = this.#state.selectedRowIds();
    patchState(this.#state, (state) => ({
      formModel: {
        ...state.formModel,
        products: state.formModel.products.map((p) => {
          if (!selectedIds.has(p._rowId)) return p;
          return { ...p, tvaRate };
        }),
      },
    }));
  }

  /**
   * Resets the form to initial state.
   */
  reset(): void {
    patchState(this.#state, {
      formModel: getDefaultStockEntryFormModel(),
      selectedRowIds: new Set<string>(),
      isSubmitting: false,
      isProcessingOcr: false,
    });
  }

  /**
   * Sets OCR processing state.
   * @param processing Whether OCR is processing
   */
  setProcessingOcr(processing: boolean): void {
    patchState(this.#state, { isProcessingOcr: processing });
  }

  /**
   * Loads OCR invoice data into the form.
   * Returns OCR supplier data for the component to handle matching.
   * @param invoice Parsed invoice data
   * @param confidence OCR confidence score
   * @returns OCR supplier data or null if no supplier extracted
   */
  loadFromOcr(invoice: ISupplierInvoice, confidence: number): IOcrSupplierData | null {
    const formData = invoiceToFormData(invoice, confidence);

    const ocrSupplier: IOcrSupplierData | null = invoice.supplier
      ? {
          name: invoice.supplier.name ?? null,
          ice: invoice.supplier.ice ?? null,
          fiscalId: invoice.supplier.fiscalId ?? null,
          tradeRegister: invoice.supplier.tradeRegister ?? null,
          address: invoice.supplier.address ?? null,
          phone: invoice.supplier.phone ?? null,
        }
      : null;

    patchState(this.#state, (state) => ({
      formModel: {
        ...state.formModel,
        documentNumber: formData.documentNumber,
        documentDate: formData.documentDate,
        products: [...state.formModel.products, ...formData.products],
      },
      isProcessingOcr: false,
    }));

    const count = formData.products.length;
    this.#toastr.success(this.#translate.instant('stock.entry.ocr.productsLoaded', { count }));

    return ocrSupplier;
  }

  /**
   * Finds a supplier by unique identifiers (ICE, Tax ID, Trade Register, SIRET).
   * @param ocrSupplier OCR-extracted supplier data
   * @param suppliers List of existing suppliers to search
   * @returns Match result with supplier and matched field, or null
   */
  findSupplierByIdentifiers(
    ocrSupplier: IOcrSupplierData,
    suppliers: readonly ISupplier[],
  ): { supplier: ISupplier; matchedBy: SupplierIdentifierField } | null {
    const identifiers: { field: SupplierIdentifierField; ocrValue: string | null }[] = [
      { field: 'ice', ocrValue: ocrSupplier.ice },
      { field: 'taxId', ocrValue: ocrSupplier.fiscalId },
      { field: 'tradeRegister', ocrValue: ocrSupplier.tradeRegister },
    ];

    for (const { field, ocrValue } of identifiers) {
      if (!ocrValue) continue;

      const normalizedValue = ocrValue.replace(/\s/g, '').toLowerCase();
      const match = suppliers.find((s) => {
        const supplierValue = s[field];
        if (!supplierValue) return false;
        return supplierValue.replace(/\s/g, '').toLowerCase() === normalizedValue;
      });

      if (match) {
        return { supplier: match, matchedBy: field };
      }
    }

    return null;
  }

  /**
   * Computes differences between OCR data and existing supplier.
   * @param ocrSupplier OCR-extracted supplier data
   * @param existingSupplier Existing supplier from database
   * @returns Array of field differences
   */
  computeSupplierDiffs(
    ocrSupplier: IOcrSupplierData,
    existingSupplier: ISupplier,
  ): ISupplierFieldDiff[] {
    const diffs: ISupplierFieldDiff[] = [];

    if (ocrSupplier.name && ocrSupplier.name !== existingSupplier.name) {
      diffs.push({
        field: 'name',
        labelKey: 'stock.entry.supplierInfo.name',
        currentValue: existingSupplier.name,
        ocrValue: ocrSupplier.name,
      });
    }

    if (ocrSupplier.address && ocrSupplier.address !== existingSupplier.address?.street) {
      diffs.push({
        field: 'address',
        labelKey: 'stock.entry.supplierInfo.address',
        currentValue: existingSupplier.address?.street ?? null,
        ocrValue: ocrSupplier.address,
      });
    }

    if (ocrSupplier.phone && ocrSupplier.phone !== existingSupplier.phone) {
      diffs.push({
        field: 'phone',
        labelKey: 'stock.entry.supplierInfo.phone',
        currentValue: existingSupplier.phone,
        ocrValue: ocrSupplier.phone,
      });
    }

    if (ocrSupplier.ice && ocrSupplier.ice !== existingSupplier.ice) {
      diffs.push({
        field: 'ice',
        labelKey: 'stock.entry.supplierInfo.ice',
        currentValue: existingSupplier.ice,
        ocrValue: ocrSupplier.ice,
      });
    }

    if (ocrSupplier.fiscalId && ocrSupplier.fiscalId !== existingSupplier.taxId) {
      diffs.push({
        field: 'taxId',
        labelKey: 'stock.entry.supplierInfo.taxId',
        currentValue: existingSupplier.taxId,
        ocrValue: ocrSupplier.fiscalId,
      });
    }

    if (ocrSupplier.tradeRegister && ocrSupplier.tradeRegister !== existingSupplier.tradeRegister) {
      diffs.push({
        field: 'tradeRegister',
        labelKey: 'stock.entry.supplierInfo.tradeRegister',
        currentValue: existingSupplier.tradeRegister,
        ocrValue: ocrSupplier.tradeRegister,
      });
    }

    return diffs;
  }

  /**
   * Creates a new supplier from OCR data.
   * @param ocrSupplier OCR-extracted supplier data
   * @returns New supplier with OCR data
   */
  createSupplierFromOcr(ocrSupplier: IOcrSupplierData): ISupplier {
    const newSupplier = createEmptySupplier();
    return {
      ...newSupplier,
      name: ocrSupplier.name ?? '',
      address: {
        ...createEmptyAddress(),
        street: ocrSupplier.address,
        country: 'Maroc',
      },
      phone: ocrSupplier.phone,
      ice: ocrSupplier.ice,
      taxId: ocrSupplier.fiscalId,
      tradeRegister: ocrSupplier.tradeRegister,
    };
  }

  /**
   * Merges accepted OCR fields into existing supplier.
   * @param existingSupplier Existing supplier
   * @param ocrSupplier OCR data
   * @param acceptedFields Fields to merge
   * @returns Merged supplier
   */
  mergeSupplierWithOcr(
    existingSupplier: ISupplier,
    ocrSupplier: IOcrSupplierData,
    acceptedFields: readonly SupplierDiffField[],
  ): ISupplier {
    const merged = { ...existingSupplier, address: { ...existingSupplier.address } };

    for (const field of acceptedFields) {
      switch (field) {
        case 'name':
          if (ocrSupplier.name) merged.name = ocrSupplier.name;
          break;
        case 'address':
          if (ocrSupplier.address) merged.address.street = ocrSupplier.address;
          break;
        case 'phone':
          if (ocrSupplier.phone) merged.phone = ocrSupplier.phone;
          break;
        case 'ice':
          if (ocrSupplier.ice) merged.ice = ocrSupplier.ice;
          break;
        case 'taxId':
          if (ocrSupplier.fiscalId) merged.taxId = ocrSupplier.fiscalId;
          break;
        case 'tradeRegister':
          if (ocrSupplier.tradeRegister) merged.tradeRegister = ocrSupplier.tradeRegister;
          break;
      }
    }

    return merged;
  }

  /**
   * Submits the stock entry.
   */
  submitEntry(): void {
    if (!this.isFormValid()) return;

    patchState(this.#state, { isSubmitting: true });
    const request = toStockEntryRequest(this.#state.formModel());

    this.#service
      .createEntry(request)
      .pipe(
        tap(() => {
          patchState(this.#state, { isSubmitting: false });
          this.#toastr.success(this.#translate.instant('commun.operationTerminee'));
          void this.#router.navigate(['/p/stock/products']);
        }),
        catchError((error: HttpErrorResponse) => {
          patchState(this.#state, { isSubmitting: false });
          this.#errorService.getError(error, 'stock.entry.errors.createEntry', true);
          return of(null);
        }),
      )
      .subscribe();
  }
}
