import { inject } from '@angular/core';
import {
  IDataExtractor,
  IOcrBlock,
  IOcrResult,
  IParseResult,
  IValidationResult,
  OcrDocumentType,
  detectLowConfidenceWarnings,
} from '@app/models';
import { OcrService } from './ocr.service';

/**
 * Abstract class for document parsers.
 * Each feature implements its own parser.
 * Implements IDataExtractor for pipeline compatibility.
 */
export abstract class DocumentParser<T> implements IDataExtractor<T> {
  protected readonly ocrService = inject(OcrService);

  /** Document type for provider selection */
  abstract readonly documentType: OcrDocumentType;

  /**
   * Parses a document and returns structured data.
   * @param file Image file to parse
   * @returns Result with structured data
   */
  async parse(file: File): Promise<IParseResult<T>> {
    const startTime = performance.now();

    const ocrResult = await this.ocrService.process(file, {
      documentType: this.documentType,
      language: 'fra',
    });

    const data = this.extractData(ocrResult.rawText, ocrResult.blocks);
    const warnings = this.detectWarnings(ocrResult);

    return {
      data,
      confidence: ocrResult.confidence,
      warnings,
      processingTime: performance.now() - startTime,
    };
  }

  /**
   * Extracts business data from OCR text.
   * Public to satisfy IDataExtractor interface (used by pipeline).
   * @param rawText Raw extracted text
   * @param blocks Text blocks with positions
   * @returns Structured data
   */
  abstract extractData(rawText: string, blocks: IOcrBlock[]): T;

  /**
   * Validates extracted data.
   * @param data Data to validate
   * @returns Validation result
   */
  abstract validate(data: T): IValidationResult;

  /**
   * Detects fields with low confidence.
   * @param ocrResult OCR result
   * @returns List of warnings
   */
  protected detectWarnings(ocrResult: IOcrResult): string[] {
    return detectLowConfidenceWarnings(ocrResult.blocks);
  }
}
