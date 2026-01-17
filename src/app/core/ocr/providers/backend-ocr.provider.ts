import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { IOcrEngine, IOcrResult, IOcrOptions } from '@optisaas/opti-saas-lib';
import { OCR_CONFIG } from '../ocr.config';

@Injectable()
export class BackendOcrProvider implements IOcrEngine {
  readonly name = 'backend';

  readonly #config = inject(OCR_CONFIG);
  readonly #http = inject(HttpClient);

  get isAvailable(): boolean {
    return this.#config.backendOcrUrl !== null;
  }

  /**
   * Sends the image to the backend for OCR processing.
   * @param image Image file to process
   * @param options Processing options
   * @returns OCR result
   */
  async process(image: File, options?: IOcrOptions): Promise<IOcrResult> {
    if (!this.#config.backendOcrUrl) {
      throw new Error('Backend OCR URL not configured');
    }

    const startTime = performance.now();

    try {
      const formData = new FormData();
      formData.append('image', image);

      if (options?.language) {
        formData.append('language', options.language);
      }
      if (options?.documentType) {
        formData.append('documentType', options.documentType);
      }
      if (options?.enhanceImage !== undefined) {
        formData.append('enhanceImage', String(options.enhanceImage));
      }

      const response = await firstValueFrom(
        this.#http.post<IOcrResult>(this.#config.backendOcrUrl, formData),
      );

      return {
        rawText: response.rawText,
        confidence: response.confidence,
        blocks: response.blocks,
        provider: `backend:${response.provider}`,
        processingTime: performance.now() - startTime,
      };
    } catch (error) {
      throw new Error(
        `Backend OCR failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}
