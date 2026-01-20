import { IWarehouse } from '../../../settings/warehouse/models/warehouse.model';
import { IProductForm, ISupplier, Product, ProductType } from '@app/models';

export type DocumentType = 'invoice' | 'delivery_note';

export type IProductSearchResult =
  | { type: 'existing'; product: Product }
  | { type: 'new'; designation: string; productType: ProductType | null };

export interface IWarehouseAllocation {
  readonly warehouseId: string;
  readonly quantity: number;
}

export interface IStockEntryProductRequest extends IProductForm {
  readonly id: string | null;
  readonly warehouseAllocations: readonly IWarehouseAllocation[];
}

export interface IStockEntryRequest {
  readonly documentNumber: string;
  readonly documentDate: string;
  readonly documentType: DocumentType;
  readonly supplier: ISupplier;
  readonly products: readonly IStockEntryProductRequest[];
}

export interface ISplitDialogData {
  readonly totalQuantity: number;
  readonly currentAllocations: readonly IWarehouseAllocation[];
  readonly designation: string | null;
  readonly warehouses: readonly IWarehouse[];
}

export type ISplitDialogResult = readonly IWarehouseAllocation[];

export interface IOcrUploadDialogData {
  readonly file: File | null;
}

export interface IOcrUploadResult {
  readonly invoice: import('@optisaas/opti-saas-lib').ISupplierInvoice;
  readonly confidence: number;
  readonly warnings: readonly string[];
}

export interface IBulkConflictProduct {
  readonly rowId: string;
  readonly designation: string | null;
  readonly allocations: readonly IWarehouseAllocation[];
}

export interface IBulkConflictDialogData {
  readonly selectedCount: number;
  readonly conflictingProducts: readonly IBulkConflictProduct[];
  readonly targetWarehouseId: string;
  readonly targetWarehouseName: string;
}

export type BulkConflictAction = 'overwrite' | 'exclude' | 'cancel';

export type SupplierIdentifierField = 'ice' | 'taxId' | 'tradeRegister' | 'siret';

export type SupplierDiffField =
  | 'name'
  | 'address'
  | 'phone'
  | 'email'
  | 'ice'
  | 'taxId'
  | 'tradeRegister'
  | 'siret';

export interface ISupplierFieldDiff {
  readonly field: SupplierDiffField;
  readonly labelKey: string;
  readonly currentValue: string | null;
  readonly ocrValue: string | null;
}

export interface ISupplierDiffDialogData {
  readonly supplierName: string;
  readonly matchedBy: SupplierIdentifierField;
  readonly diffs: readonly ISupplierFieldDiff[];
}

export interface ISupplierDiffResult {
  readonly action: 'accept_all' | 'ignore_all' | 'partial';
  readonly acceptedFields: readonly SupplierDiffField[];
}

export interface IOcrSupplierData {
  readonly name: string | null;
  readonly ice: string | null;
  readonly fiscalId: string | null;
  readonly tradeRegister: string | null;
  readonly address: string | null;
  readonly phone: string | null;
}
