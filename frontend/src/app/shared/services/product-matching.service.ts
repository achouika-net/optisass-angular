import { computed, Injectable, inject } from '@angular/core';
import {
  IBrand,
  IModel,
  IParsedProductInfo,
  IProductMatchResult,
  IProductSuggestion,
  MatchConfidence,
  MatchMethod,
  Product,
  createNoMatchResult,
  normalizeBarcode,
  normalizeBrandName,
  normalizeModelName,
  parseDesignation,
  calculateSimilarity,
  scoreToConfidence,
} from '@app/models';
import { ResourceStore } from '@app/core/store';
import { ProductService } from './product.service';
import { Observable, forkJoin, map, of, catchError } from 'rxjs';

interface BrandCacheEntry {
  brandId: string;
  brand: IBrand;
  score: number;
}

interface ModelCacheEntry {
  modelId: string;
  model: IModel;
  score: number;
}

interface MatchAttempt {
  priority: number;
  result: IProductMatchResult;
}

/**
 * Builds O(1) lookup cache for brands.
 * Indexes by normalized code, label, aliases, and manufacturer codes.
 * @returns Cache with Map for exact lookups
 */
const buildBrandCache = (brands: IBrand[]): { exactMap: Map<string, BrandCacheEntry> } => {
  const exactMap = new Map<string, BrandCacheEntry>();

  for (const brand of brands) {
    const entry100: BrandCacheEntry = { brandId: brand.id, brand, score: 100 };
    const entry98: BrandCacheEntry = { brandId: brand.id, brand, score: 98 };
    const entry95: BrandCacheEntry = { brandId: brand.id, brand, score: 95 };
    const entry90: BrandCacheEntry = { brandId: brand.id, brand, score: 90 };

    const normalizedCode = normalizeBrandName(brand.code);
    if (normalizedCode && !exactMap.has(normalizedCode)) {
      exactMap.set(normalizedCode, entry100);
    }

    const normalizedLabel = normalizeBrandName(brand.label);
    if (normalizedLabel && !exactMap.has(normalizedLabel)) {
      exactMap.set(normalizedLabel, entry98);
    }

    for (const alias of brand.aliases) {
      const normalizedAlias = normalizeBrandName(alias);
      if (normalizedAlias && !exactMap.has(normalizedAlias)) {
        exactMap.set(normalizedAlias, entry95);
      }
    }

    for (const mfgCode of brand.manufacturerCodes) {
      const normalizedMfg = normalizeBrandName(mfgCode);
      if (normalizedMfg && !exactMap.has(normalizedMfg)) {
        exactMap.set(normalizedMfg, entry90);
      }
    }
  }

  return { exactMap };
};

/**
 * Builds O(1) lookup cache for models, grouped by brand.
 * Indexes by brandId:normalizedKey for exact lookups.
 * @returns Cache with Maps for exact lookups and models by brand
 */
const buildModelCache = (
  models: IModel[],
): {
  exactMap: Map<string, ModelCacheEntry>;
  modelsByBrand: Map<string, readonly IModel[]>;
} => {
  const exactMap = new Map<string, ModelCacheEntry>();
  const modelsByBrand = new Map<string, IModel[]>();

  for (const model of models) {
    const brandId = model.brandId;

    if (!modelsByBrand.has(brandId)) {
      modelsByBrand.set(brandId, []);
    }
    modelsByBrand.get(brandId)!.push(model);

    const entry100: ModelCacheEntry = { modelId: model.id, model, score: 100 };
    const entry98: ModelCacheEntry = { modelId: model.id, model, score: 98 };
    const entry95: ModelCacheEntry = { modelId: model.id, model, score: 95 };
    const entry92: ModelCacheEntry = { modelId: model.id, model, score: 92 };

    const normalizedCode = normalizeModelName(model.code);
    if (normalizedCode) {
      const keyCode = `${brandId}:${normalizedCode}`;
      if (!exactMap.has(keyCode)) {
        exactMap.set(keyCode, entry100);
      }
    }

    const normalizedLabel = normalizeModelName(model.label);
    if (normalizedLabel) {
      const keyLabel = `${brandId}:${normalizedLabel}`;
      if (!exactMap.has(keyLabel)) {
        exactMap.set(keyLabel, entry98);
      }
    }

    for (const alias of model.aliases) {
      const normalizedAlias = normalizeModelName(alias);
      if (normalizedAlias) {
        const keyAlias = `${brandId}:${normalizedAlias}`;
        if (!exactMap.has(keyAlias)) {
          exactMap.set(keyAlias, entry95);
        }
      }
    }

    if (model.manufacturerCode) {
      const normalizedMfg = normalizeModelName(model.manufacturerCode);
      if (normalizedMfg) {
        const keyMfg = `${brandId}:${normalizedMfg}`;
        if (!exactMap.has(keyMfg)) {
          exactMap.set(keyMfg, entry92);
        }
      }
    }
  }

  return { exactMap, modelsByBrand };
};

/**
 * Service for matching OCR-extracted product information against the database.
 * Combines pure functions from the lib with access to application data.
 * Uses computed caches for O(1) brand/model lookups.
 */
@Injectable({ providedIn: 'root' })
export class ProductMatchingService {
  readonly #resourceStore = inject(ResourceStore);
  readonly #productService = inject(ProductService);

  readonly #brandCache = computed(() => buildBrandCache(this.#resourceStore.brands()));

  readonly #modelCache = computed(() => buildModelCache(this.#resourceStore.models()));

  /**
   * Matches a product from OCR data against the database.
   * Tries multiple strategies in parallel for performance, returns best match by priority:
   * 1. Barcode (EAN/UPC) - highest confidence
   * 2. Supplier code - high confidence
   * 3. Manufacturer reference - medium confidence
   * 4. Fuzzy designation parsing - variable confidence
   * @param reference The reference/barcode from OCR
   * @param designation The product designation from OCR
   * @param supplierId The supplier ID (if known)
   * @returns Observable of match result with confidence and suggestions
   */
  matchProduct(
    reference: string | null,
    designation: string | null,
    supplierId: string | null,
  ): Observable<IProductMatchResult> {
    if (!designation) {
      return of(createNoMatchResult());
    }

    if (reference) {
      const barcode = normalizeBarcode(reference);
      const matchObservables: Observable<MatchAttempt>[] = [];

      if (barcode) {
        matchObservables.push(
          this.#matchByBarcode(barcode).pipe(map((result) => ({ priority: 1, result }))),
        );
      }

      if (supplierId) {
        matchObservables.push(
          this.#matchBySupplierCode(reference, supplierId).pipe(
            map((result) => ({ priority: 2, result })),
          ),
        );
      }

      matchObservables.push(
        this.#matchByManufacturerRef(reference).pipe(map((result) => ({ priority: 3, result }))),
      );

      if (matchObservables.length > 0) {
        return forkJoin(matchObservables).pipe(
          map((results) => {
            const matched = results
              .filter((r) => r.result.matchedProductId)
              .sort((a, b) => a.priority - b.priority);

            if (matched.length > 0) {
              return matched[0].result;
            }

            return this.#matchByDesignationSync(designation);
          }),
        );
      }
    }

    return of(this.#matchByDesignationSync(designation));
  }

  /**
   * Parses a designation and extracts product information.
   * @param designation The raw designation text
   * @returns Parsed product information
   */
  parseProductDesignation(designation: string): IParsedProductInfo {
    return parseDesignation(designation);
  }

  /**
   * Matches a brand name against the database using O(1) cache lookup.
   * Falls back to fuzzy matching if no exact match found.
   * @param parsedBrand The brand name to match (from OCR)
   * @returns Match result with brand ID and score, or null
   */
  matchBrand(parsedBrand: string): BrandCacheEntry | null {
    if (!parsedBrand) return null;

    const normalized = normalizeBrandName(parsedBrand);
    const cache = this.#brandCache();

    const exactMatch = cache.exactMap.get(normalized);
    if (exactMatch) return exactMatch;

    const brands = this.#resourceStore.brands();
    let bestMatch: BrandCacheEntry | null = null;

    for (const brand of brands) {
      const similarity = calculateSimilarity(normalized, normalizeBrandName(brand.label));
      const score = Math.round(similarity * 100);

      if (score >= 80 && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { brandId: brand.id, brand, score };
        if (score === 100) break;
      }
    }

    return bestMatch;
  }

  /**
   * Matches a model name against the database for a given brand using O(1) cache lookup.
   * Falls back to fuzzy matching if no exact match found.
   * @param parsedModel The model name to match (from OCR)
   * @param brandId The brand ID to filter models
   * @returns Match result with model ID and score, or null
   */
  matchModel(parsedModel: string, brandId: string): ModelCacheEntry | null {
    if (!parsedModel || !brandId) return null;

    const normalized = normalizeModelName(parsedModel);
    const cache = this.#modelCache();

    const cacheKey = `${brandId}:${normalized}`;
    const exactMatch = cache.exactMap.get(cacheKey);
    if (exactMatch) return exactMatch;

    const brandModels = cache.modelsByBrand.get(brandId);
    if (!brandModels || brandModels.length === 0) return null;

    let bestMatch: ModelCacheEntry | null = null;

    for (const model of brandModels) {
      const similarity = calculateSimilarity(normalized, normalizeModelName(model.label));
      const score = Math.round(similarity * 100);

      if (score >= 75 && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { modelId: model.id, model, score };
        if (score === 100) break;
      }
    }

    return bestMatch;
  }

  /**
   * Matches by barcode (EAN-13, UPC-A, etc.).
   * @param barcode Normalized barcode
   * @returns Observable of match result
   */
  #matchByBarcode(barcode: string): Observable<IProductMatchResult> {
    return this.#findProductByBarcode(barcode).pipe(
      map((product) => {
        if (product) {
          return this.#createMatchResult('barcode', 100, product);
        }
        return createNoMatchResult();
      }),
    );
  }

  /**
   * Matches by supplier-specific product code.
   * @param code The supplier code
   * @param supplierId The supplier ID
   * @returns Observable of match result
   */
  #matchBySupplierCode(code: string, supplierId: string): Observable<IProductMatchResult> {
    return this.#findProductBySupplierCode(code, supplierId).pipe(
      map((product) => {
        if (product) {
          return this.#createMatchResult('supplierCode', 95, product);
        }
        return createNoMatchResult();
      }),
    );
  }

  /**
   * Matches by manufacturer reference.
   * @param ref The manufacturer reference
   * @returns Observable of match result
   */
  #matchByManufacturerRef(ref: string): Observable<IProductMatchResult> {
    return this.#findProductByManufacturerRef(ref).pipe(
      map((product) => {
        if (product) {
          return this.#createMatchResult('manufacturerRef' as any, 90, product);
        }
        return createNoMatchResult();
      }),
    );
  }

  /**
   * Matches by parsing the designation text (synchronous version).
   * @param designation The product designation
   * @returns Match result with suggestions
   */
  #matchByDesignationSync(designation: string): IProductMatchResult {
    const parsed = parseDesignation(designation);
    const suggestions: IProductSuggestion[] = [];

    let matchedBrandId: string | null = null;
    let matchedModelId: string | null = null;
    let score = 0;

    if (parsed.parsedBrand) {
      const brandMatch = this.matchBrand(parsed.parsedBrand);
      if (brandMatch) {
        matchedBrandId = brandMatch.brandId;
        score += brandMatch.score * 0.4;

        if (parsed.parsedModel) {
          const modelMatch = this.matchModel(parsed.parsedModel, brandMatch.brandId);
          if (modelMatch) {
            matchedModelId = modelMatch.modelId;
            score += modelMatch.score * 0.4;
          }
        }
      }
    }

    if (parsed.barcode) {
      score += 10;
    }
    if (parsed.parsedColor) {
      score += 5;
    }
    if (parsed.parsedSize) {
      score += 5;
    }

    score = Math.min(Math.round(score), 100);
    const confidence = scoreToConfidence(score);

    return {
      method: 'fuzzyDesignation' as any,
      confidence,
      score,
      matchedProductId: null,
      matchedBrandId,
      matchedModelId,
      suggestions,
    };
  }

  /**
   * Creates a successful match result.
   * @param method The match method used
   * @param score The match score
   * @param product The matched product
   * @returns Match result
   */
  #createMatchResult(method: MatchMethod, score: number, product: Product): IProductMatchResult {
    const confidence: MatchConfidence = scoreToConfidence(score);

    return {
      method,
      confidence,
      score,
      matchedProductId: product.id,
      matchedBrandId: product.brandId,
      matchedModelId: product.modelId,
      suggestions: [],
    };
  }

  /**
   * Finds a product by barcode.
   * @param barcode The barcode to search
   * @returns Observable of product or null
   */
  #findProductByBarcode(barcode: string): Observable<Product | null> {
    return this.#productService
      .search({ barcode } as never, 1, 1, { active: '', direction: '' })
      .pipe(
        map((result) => (result.data.length > 0 ? result.data[0] : null)),
        catchError(() => of(null)),
      );
  }

  /**
   * Finds a product by supplier code.
   * @param code The supplier code
   * @param supplierId The supplier ID
   * @returns Observable of product or null
   */
  #findProductBySupplierCode(code: string, supplierId: string): Observable<Product | null> {
    return this.#productService
      .search({ supplierCode: code, supplierId } as never, 1, 1, { active: '', direction: '' })
      .pipe(
        map((result) => (result.data.length > 0 ? result.data[0] : null)),
        catchError(() => of(null)),
      );
  }

  /**
   * Finds a product by manufacturer reference.
   * @param ref The manufacturer reference
   * @returns Observable of product or null
   */
  #findProductByManufacturerRef(ref: string): Observable<Product | null> {
    return this.#productService
      .search({ manufacturerRef: ref } as never, 1, 1, { active: '', direction: '' })
      .pipe(
        map((result) => (result.data.length > 0 ? result.data[0] : null)),
        catchError(() => of(null)),
      );
  }
}
