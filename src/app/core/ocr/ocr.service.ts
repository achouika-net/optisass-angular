import { Injectable, inject, signal, Injector } from '@angular/core';
import {
  IOcrEngine,
  IOcrResult,
  IOcrOptions,
  OcrErrorCode,
  OcrDocumentType,
} from '@optisaas/opti-saas-lib';
import { OCR_CONFIG } from './ocr.config';
import { TesseractProvider } from './providers/tesseract.provider';
import { BackendOcrProvider } from './providers/backend-ocr.provider';

/**
 * OCR error with code and provider.
 */
export class OcrError extends Error {
  constructor(
    public readonly code: OcrErrorCode,
    message: string,
    public readonly provider?: string,
  ) {
    super(message);
    this.name = 'OcrError';
  }
}

/**
 * Main OCR service.
 * Single entry point for all OCR operations.
 */
@Injectable({ providedIn: 'root' })
export class OcrService {
  readonly #config = inject(OCR_CONFIG);
  readonly #injector = inject(Injector);
  readonly #providers = new Map<string, IOcrEngine>();

  readonly isProcessing = signal(false);
  readonly lastError = signal<string | null>(null);
  readonly lastResult = signal<IOcrResult | null>(null);

  constructor() {
    this.#registerProviders();
  }

  /**
   * Processes an image with the configured OCR.
   * @param image Image file to process
   * @param options Processing options
   * @returns OCR result
   */
  async process(image: File, options?: IOcrOptions): Promise<IOcrResult> {
    this.isProcessing.set(true);
    this.lastError.set(null);

    try {
      this.#validateImage(image);

      const providerName = this.#resolveProvider(options?.documentType);
      const provider = this.#providers.get(providerName);

      if (!provider) {
        throw new OcrError(
          OcrErrorCode.PROVIDER_UNAVAILABLE,
          `Provider "${providerName}" not found`,
        );
      }

      if (!provider.isAvailable) {
        throw new OcrError(
          OcrErrorCode.PROVIDER_UNAVAILABLE,
          `Provider "${providerName}" is not available`,
          providerName,
        );
      }

      const result = await this.#processWithTimeout(provider, image, options);

      if (this.#shouldFallback(result)) {
        const fallbackResult = await this.#tryFallback(image, options);
        if (fallbackResult && fallbackResult.confidence > result.confidence) {
          this.lastResult.set(fallbackResult);
          return fallbackResult;
        }
      }

      this.lastResult.set(result);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'OCR processing failed';
      this.lastError.set(message);
      throw error;
    } finally {
      this.isProcessing.set(false);
    }
  }

  /**
   * Returns the list of available providers.
   */
  getAvailableProviders(): string[] {
    return Array.from(this.#providers.entries())
      .filter(([, provider]) => provider.isAvailable)
      .map(([name]) => name);
  }

  /**
   * Returns the configured default provider.
   */
  getDefaultProvider(): string {
    return this.#config.defaultProvider;
  }

  /**
   * Registers all providers.
   */
  #registerProviders(): void {
    const tesseract = this.#injector.get(TesseractProvider);
    this.#providers.set(tesseract.name, tesseract);

    if (this.#config.backendOcrUrl) {
      const backend = this.#injector.get(BackendOcrProvider);
      this.#providers.set(backend.name, backend);
    }
  }

  /**
   * Resolves the provider to use.
   */
  #resolveProvider(documentType?: string): string {
    if (documentType) {
      const docType = documentType as OcrDocumentType;
      const override = this.#config.overrides[docType];
      if (override) {
        const provider = this.#providers.get(override);
        if (provider?.isAvailable) {
          return override;
        }
      }
    }

    return this.#config.defaultProvider;
  }

  /**
   * Checks if a fallback is needed.
   */
  #shouldFallback(result: IOcrResult): boolean {
    return (
      result.confidence < this.#config.minConfidence &&
      this.#config.fallbackProvider !== null &&
      this.#config.fallbackProvider !== result.provider
    );
  }

  /**
   * Tries fallback with the secondary provider.
   */
  async #tryFallback(image: File, options?: IOcrOptions): Promise<IOcrResult | null> {
    const fallbackName = this.#config.fallbackProvider;
    if (!fallbackName) return null;

    const fallback = this.#providers.get(fallbackName);
    if (!fallback?.isAvailable) return null;

    try {
      return await fallback.process(image, options);
    } catch {
      return null;
    }
  }

  /**
   * Processes with timeout and proper cleanup.
   * @param provider OCR provider to use
   * @param image Image file to process
   * @param options Processing options
   * @returns OCR result
   */
  async #processWithTimeout(
    provider: IOcrEngine,
    image: File,
    options?: IOcrOptions,
  ): Promise<IOcrResult> {
    const timeout = options?.timeout ?? 30000;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(
        () => reject(new OcrError(OcrErrorCode.TIMEOUT, 'OCR timeout', provider.name)),
        timeout,
      );
    });

    try {
      const result = await Promise.race([provider.process(image, options), timeoutPromise]);
      return result;
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }

  /**
   * Validates the image file.
   */
  #validateImage(file: File): void {
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/tiff'];

    if (!validTypes.includes(file.type)) {
      throw new OcrError(OcrErrorCode.INVALID_IMAGE, `Invalid image type: ${file.type}`);
    }

    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new OcrError(OcrErrorCode.IMAGE_TOO_LARGE, 'Image too large (max 10MB)');
    }
  }
}
