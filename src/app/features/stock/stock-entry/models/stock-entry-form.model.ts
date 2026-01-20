import { IInvoiceLine, ISupplierInvoice } from '@optisaas/opti-saas-lib';
import {
  createEmptySupplier,
  DEFAULT_PRODUCT_FORM,
  IProductForm,
  ISupplier,
  Product,
  toProductForm,
} from '@app/models';
import {
  DocumentType,
  IStockEntryProductRequest,
  IStockEntryRequest,
  IWarehouseAllocation,
} from './stock-entry.model';

export interface IStockEntryProductFormRow extends IProductForm {
  readonly id: string | null;
  readonly warehouseAllocations: readonly IWarehouseAllocation[];
  readonly _rowId: string;
  readonly _ocrConfidence: number | null;
  readonly _isExpanded: boolean;
}

export interface IStockEntryFormModel {
  readonly documentNumber: string;
  readonly documentDate: Date;
  readonly documentType: DocumentType;
  readonly supplier: ISupplier;
  readonly products: readonly IStockEntryProductFormRow[];
}

/**
 * Creates a default empty form model.
 * @returns A new empty form model
 */
export function getDefaultStockEntryFormModel(): IStockEntryFormModel {
  return {
    documentNumber: '',
    documentDate: new Date(),
    documentType: 'invoice',
    supplier: createEmptySupplier(),
    products: [],
  };
}

/**
 * Creates a new product row with a unique ID.
 * @param partial Partial product row data
 * @returns A new product row with defaults
 */
export function createProductRow(
  partial: Partial<IStockEntryProductFormRow> = {},
): IStockEntryProductFormRow {
  return {
    ...DEFAULT_PRODUCT_FORM,
    id: null,
    warehouseAllocations: [],
    _rowId: crypto.randomUUID(),
    _ocrConfidence: null,
    _isExpanded: false,
    ...partial,
  };
}

/**
 * Creates a product row from an existing product.
 * @param product The existing product
 * @param _quantity Initial quantity (for future warehouse allocation)
 * @returns A new product row with product data
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function createProductRowFromProduct(
  product: Product,
  _quantity = 1,
): IStockEntryProductFormRow {
  const productForm = toProductForm(product);
  return {
    ...productForm,
    id: product.id,
    warehouseAllocations: [],
    _rowId: crypto.randomUUID(),
    _ocrConfidence: null,
    _isExpanded: false,
  };
}

/**
 * Calculates the total quantity from warehouse allocations.
 * @param allocations Warehouse allocations
 * @returns Total quantity
 */
export function calculateTotalQuantity(allocations: readonly IWarehouseAllocation[]): number {
  return allocations.reduce((sum, a) => sum + a.quantity, 0);
}

/**
 * Checks if a product row has all required fields filled.
 * @param row Product row to check
 * @returns True if complete
 */
export function isProductRowComplete(row: IStockEntryProductFormRow): boolean {
  const totalQuantity = calculateTotalQuantity(row.warehouseAllocations);

  if (totalQuantity <= 0) return false;
  if (row.purchasePriceExclTax === null || row.purchasePriceExclTax < 0) return false;
  if (row.warehouseAllocations.length === 0) return false;

  if (row.id !== null) return true;

  if (!row.productType) return false;
  if (!row.designation) return false;
  if (!row.pricingMode) return false;

  if (row.pricingMode === 'coefficient' && !row.coefficient) return false;
  if (row.pricingMode === 'fixedAmount' && !row.fixedAmount) return false;
  if (row.pricingMode === 'fixedPrice' && !row.fixedPrice) return false;

  if (row.productType === 'lens') {
    return !!row.lensType && !!row.lensMaterial;
  }

  if (row.productType === 'optical_frame' || row.productType === 'sun_frame') {
    return (
      !!row.frameShape &&
      !!row.frameMaterial &&
      !!row.frameEyeSize &&
      !!row.frameBridge &&
      !!row.frameTemple &&
      !!row.frameType
    );
  }

  if (row.productType === 'contact_lens') {
    return (
      !!row.contactLensType &&
      !!row.contactLensUsage &&
      !!row.contactLensBaseCurve &&
      !!row.contactLensDiameter
    );
  }

  if (row.productType === 'accessory') {
    return !!row.accessoryCategory;
  }

  return true;
}

/**
 * Converts form model to API request.
 * @param formModel Form model
 * @returns API request payload
 */
export function toStockEntryRequest(formModel: IStockEntryFormModel): IStockEntryRequest {
  return {
    documentNumber: formModel.documentNumber,
    documentDate: formModel.documentDate.toISOString().split('T')[0],
    documentType: formModel.documentType,
    supplier: formModel.supplier,
    products: formModel.products
      .filter((p) => p.designation !== null)
      .map((row): IStockEntryProductRequest => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { _rowId, _ocrConfidence, _isExpanded, ...productData } = row;
        return productData;
      }),
  };
}

/**
 * Converts an OCR invoice line to a product row.
 * @param line Invoice line from OCR
 * @param confidence OCR confidence score
 * @returns Product row
 */
export function invoiceLineToProductRow(
  line: IInvoiceLine,
  confidence: number,
): IStockEntryProductFormRow {
  return createProductRow({
    designation: line.designation,
    warehouseAllocations: [],
    purchasePriceExclTax: line.unitPriceHT,
    tvaRate: line.vatRate ?? 0.2,
    _ocrConfidence: confidence,
    _isExpanded: true,
  });
}

/**
 * Converts OCR invoice data to partial form data.
 * @param invoice OCR invoice data
 * @param confidence OCR confidence score
 * @returns Partial form data with document and product data
 */
export function invoiceToFormData(
  invoice: ISupplierInvoice,
  confidence: number,
): {
  documentNumber: string;
  documentDate: Date;
  supplierName: string | null;
  products: IStockEntryProductFormRow[];
} {
  return {
    documentNumber: invoice.invoiceNumber ?? '',
    documentDate: invoice.invoiceDate ?? new Date(),
    supplierName: invoice.supplier?.name ?? null,
    products: invoice.lines.map((line) => invoiceLineToProductRow(line, confidence)),
  };
}
