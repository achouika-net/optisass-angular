import { InjectionToken } from '@angular/core';
import { IOcrConfig } from '@optisaas/opti-saas-lib';

/**
 * Injection token for OCR configuration.
 */
export const OCR_CONFIG = new InjectionToken<IOcrConfig>('OCR_CONFIG');

/**
 * Default OCR configuration.
 */
export const DEFAULT_OCR_CONFIG: IOcrConfig = {
  defaultProvider: 'tesseract',
  fallbackProvider: null,
  minConfidence: 0.7,
  overrides: {
    invoice: 'tesseract',
    delivery_note: 'tesseract',
  },
  backendOcrUrl: null,
  openaiKey: null,
  googleVisionKey: null,
};
