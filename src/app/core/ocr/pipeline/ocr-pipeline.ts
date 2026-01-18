import {
  IDataExtractor,
  IOcrPipeline,
  IOcrResult,
  IParseResult,
  OcrDocumentType,
  OcrProviderType,
  ParserStrategyType,
  detectLowConfidenceWarnings,
} from '@optisaas/opti-saas-lib';
import { OcrService } from '../ocr.service';

/**
 * Parser interface for pipeline use.
 * Uses IDataExtractor directly for type compatibility.
 */
export type IPipelineParser<T> = IDataExtractor<T>;

/**
 * OCR Pipeline implementation.
 * Combines a provider (via OcrService) with a parser to process documents.
 */
export class OcrPipeline<T> implements IOcrPipeline<T> {
  constructor(
    private readonly ocrService: OcrService,
    private readonly parser: IPipelineParser<T>,
    public readonly documentType: OcrDocumentType,
    public readonly providerType: OcrProviderType,
    public readonly parserStrategy: ParserStrategyType,
    private readonly language = 'fra',
  ) {}

  /**
   * Processes a document file through OCR and parsing.
   * @param file Image file to process
   * @returns Parsed result with structured data
   */
  async process(file: File): Promise<IParseResult<T>> {
    const startTime = performance.now();

    const ocrResult = await this.ocrService.process(file, {
      documentType: this.documentType,
      language: this.language,
    });

    const data = this.parser.extractData(ocrResult.rawText, ocrResult.blocks);
    const warnings = this.#detectWarnings(ocrResult);

    return {
      data,
      confidence: ocrResult.confidence,
      warnings,
      processingTime: performance.now() - startTime,
    };
  }

  /**
   * Processes raw OCR result (if OCR was done externally).
   * @param ocrResult OCR result to parse
   * @returns Parsed result with structured data
   */
  processOcrResult(ocrResult: IOcrResult): IParseResult<T> {
    const startTime = performance.now();

    const data = this.parser.extractData(ocrResult.rawText, ocrResult.blocks);
    const warnings = this.#detectWarnings(ocrResult);

    return {
      data,
      confidence: ocrResult.confidence,
      warnings,
      processingTime: performance.now() - startTime,
    };
  }

  /**
   * Detects fields with low confidence.
   */
  #detectWarnings(ocrResult: IOcrResult): string[] {
    return detectLowConfidenceWarnings(ocrResult.blocks);
  }
}
