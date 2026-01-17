import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { IOcrConfig } from '@optisaas/opti-saas-lib';
import { OCR_CONFIG, DEFAULT_OCR_CONFIG } from './ocr.config';
import { TesseractProvider } from './providers/tesseract.provider';
import { BackendOcrProvider } from './providers/backend-ocr.provider';

/**
 * Configures the OCR module.
 * @param config Partial OCR configuration (merged with defaults)
 * @returns Providers for dependency injection
 */
export function provideOcr(config?: Partial<IOcrConfig>): EnvironmentProviders {
  const mergedConfig: IOcrConfig = {
    ...DEFAULT_OCR_CONFIG,
    ...config,
  };

  return makeEnvironmentProviders([
    { provide: OCR_CONFIG, useValue: mergedConfig },
    TesseractProvider,
    BackendOcrProvider,
  ]);
}
