import { inject } from '@angular/core';
import {
  IOcrBlock,
  IOcrResult,
  IParseResult,
  IValidationResult,
  OcrDocumentType,
} from '@optisaas/opti-saas-lib';
import { OcrService } from './ocr.service';

/**
 * Abstract class for document parsers.
 * Each feature implements its own parser.
 */
export abstract class DocumentParser<T> {
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
   * @param rawText Raw extracted text
   * @param blocks Text blocks with positions
   * @returns Structured data
   */
  protected abstract extractData(rawText: string, blocks: IOcrBlock[]): T;

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
    const warnings: string[] = [];

    ocrResult.blocks
      .filter((block) => block.confidence < 0.8)
      .forEach((block) => {
        warnings.push(`Uncertain text: "${block.text.substring(0, 50)}..."`);
      });

    return warnings;
  }
}
