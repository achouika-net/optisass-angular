import {
  categoryToFrameSubType,
  categoryToProductType,
  IBrand,
  IInvoiceLine,
  IModel,
  IProductMatchResult,
  ISupplierInvoice,
  parseSafiloDesignation,
} from '@app/models';
import {
  createEmptySupplier,
  getDefaultProductForm,
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

export type OcrLevel = 'high' | 'medium' | 'low';

export interface IStockEntryProductFormRow extends IProductForm {
  readonly id: string | null;
  readonly warehouseAllocations: readonly IWarehouseAllocation[];
  readonly _rowId: string;
  readonly _ocrConfidence: number | null;
  readonly _ocrLevel: OcrLevel | null;
  readonly _ocrIcon: string | null;
  readonly _isExpanded: boolean;
  readonly _matchResult: IProductMatchResult | null;
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
  const ocrConfidence = partial._ocrConfidence ?? null;
  const ocrLevel = computeOcrLevel(ocrConfidence);

  return {
    ...getDefaultProductForm(),
    id: null,
    warehouseAllocations: [],
    _rowId: crypto.randomUUID(),
    _ocrConfidence: ocrConfidence,
    _ocrLevel: ocrLevel,
    _ocrIcon: computeOcrIcon(ocrLevel),
    _isExpanded: false,
    _matchResult: null,
    ...partial,
  };
}

/**
 * Creates a product row from an existing product.
 * @param product The existing product
 * @returns A new product row with product data
 */
export function createProductRowFromProduct(product: Product): IStockEntryProductFormRow {
  const productForm = toProductForm(product);
  return {
    ...productForm,
    id: product.id,
    warehouseAllocations: [],
    _rowId: crypto.randomUUID(),
    _ocrConfidence: null,
    _ocrLevel: null,
    _ocrIcon: null,
    _isExpanded: false,
    _matchResult: null,
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
 * Computes OCR confidence level from a confidence score.
 * @param confidence OCR confidence score (0-1)
 * @returns Level string for styling
 */
export function computeOcrLevel(confidence: number | null): OcrLevel | null {
  if (confidence === null) return null;
  if (confidence >= 0.8) return 'high';
  if (confidence >= 0.5) return 'medium';
  return 'low';
}

/**
 * Gets the Material icon name for an OCR confidence level.
 * @param level OCR confidence level
 * @returns Material icon name
 */
export function computeOcrIcon(level: OcrLevel | null): string | null {
  if (level === null) return null;
  const icons: Record<OcrLevel, string> = {
    high: 'verified',
    medium: 'help',
    low: 'error',
  };
  return icons[level];
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
        const {
          _rowId,
          _ocrConfidence,
          _ocrLevel,
          _ocrIcon,
          _isExpanded,
          _matchResult,
          ...productData
        } = row;
        return productData;
      }),
  };
}

/**
 * Converts an OCR invoice line to a product row.
 * Uses Safilo-format parsing to extract product type, frame dimensions,
 * color code, and finish from the designation.
 * @param line Invoice line from OCR
 * @param confidence OCR confidence score
 * @param defaultWarehouseId Default warehouse ID for allocation
 * @returns Product row with pre-filled fields from OCR parsing
 */
export function invoiceLineToProductRow(
  line: IInvoiceLine,
  confidence: number,
  defaultWarehouseId: string,
): IStockEntryProductFormRow {
  const parsed = parseSafiloDesignation(line.designation);
  const productType = categoryToProductType(parsed.parsedCategory);
  const frameSubType = categoryToFrameSubType(parsed.parsedCategory);

  const combinedConfidence = Math.max(confidence, parsed.confidence);

  const ocrLevel = computeOcrLevel(combinedConfidence);

  const row = createProductRow({
    designation: line.designation,
    warehouseAllocations: [{ warehouseId: defaultWarehouseId, quantity: line.quantity ?? 0 }],
    purchasePriceExclTax: line.unitPriceHT,
    tvaRate: line.vatRate ?? 0.2,

    productType: productType,
    frameSubType: frameSubType,
    frameColor: parsed.parsedColorCode ?? parsed.parsedColor,
    frameEyeSize: parsed.parsedFrameSize?.eyeSize ?? null,
    frameBridge: parsed.parsedFrameSize?.bridgeSize ?? null,
    frameTemple: parsed.parsedFrameSize?.templeLength ?? null,
    frameFinish: parsed.parsedFinish,

    _ocrConfidence: combinedConfidence,
    _ocrLevel: ocrLevel,
    _ocrIcon: computeOcrIcon(ocrLevel),
    _isExpanded: false,
  });

  return row;
}

/**
 * Converts OCR invoice data to partial form data.
 * @param invoice OCR invoice data
 * @param confidence OCR confidence score
 * @param defaultWarehouseId Default warehouse ID for allocations
 * @returns Partial form data with document and product data
 */
export function invoiceToFormData(
  invoice: ISupplierInvoice,
  confidence: number,
  defaultWarehouseId: string,
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
    products: invoice.lines.map((line) =>
      invoiceLineToProductRow(line, confidence, defaultWarehouseId),
    ),
  };
}

/**
 * Finds a brand by name, checking label, code, and aliases (case-insensitive).
 * @param brandName The brand name to search for
 * @param brands List of available brands
 * @returns The matching brand or null
 */
export function findBrandByName(
  brandName: string | null,
  brands: readonly IBrand[],
): IBrand | null {
  if (!brandName) return null;

  const normalizedSearch = brandName.toLowerCase().trim();

  for (const brand of brands) {
    if (brand.label.toLowerCase() === normalizedSearch) return brand;
    if (brand.code.toLowerCase() === normalizedSearch) return brand;

    for (const alias of brand.aliases) {
      if (alias.toLowerCase() === normalizedSearch) return brand;
    }

    for (const mfCode of brand.manufacturerCodes) {
      if (mfCode.toLowerCase() === normalizedSearch) return brand;
    }
  }

  return null;
}

/**
 * Finds a model by name for a specific brand, checking label, code, and aliases.
 * @param modelName The model name to search for
 * @param brandId The brand ID to filter by
 * @param models List of available models
 * @returns The matching model or null
 */
export function findModelByName(
  modelName: string | null,
  brandId: string | null,
  models: readonly IModel[],
): IModel | null {
  if (!modelName || !brandId) return null;

  const normalizedSearch = modelName.toLowerCase().trim();
  const brandModels = models.filter((m) => m.brandId === brandId);

  for (const model of brandModels) {
    if (model.label.toLowerCase() === normalizedSearch) return model;
    if (model.code.toLowerCase() === normalizedSearch) return model;
    if (model.manufacturerCode?.toLowerCase() === normalizedSearch) return model;

    for (const alias of model.aliases) {
      if (alias.toLowerCase() === normalizedSearch) return alias ? model : null;
    }
  }

  return null;
}

/**
 * Enriches product rows with brand and model IDs based on parsed names.
 * Uses the Safilo designation parser to extract brand/model names,
 * then looks up their IDs in the provided reference data.
 * @param rows Product rows to enrich
 * @param brands Available brands
 * @param models Available models
 * @returns Enriched product rows with brandId and modelId filled
 */
export function enrichProductRowsWithIds(
  rows: readonly IStockEntryProductFormRow[],
  brands: readonly IBrand[],
  models: readonly IModel[],
): IStockEntryProductFormRow[] {
  return rows.map((row) => {
    if (!row.designation) return row;

    const parsed = parseSafiloDesignation(row.designation);

    const brand = findBrandByName(parsed.parsedBrand, brands);
    const brandId = brand?.id ?? null;

    const model = findModelByName(parsed.parsedModel, brandId, models);
    const modelId = model?.id ?? null;

    if (!brandId && !modelId) return row;

    return { ...row, brandId, modelId };
  });
}
