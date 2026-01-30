import { InjectionToken } from '@angular/core';
import { IPipelineConfig } from '@app/models';

/**
 * Default pipeline configuration.
 * Change 'parser' to 'ai' to use AI extraction instead of regex.
 */
export const DEFAULT_PIPELINE_CONFIG: IPipelineConfig = {
  defaultProvider: 'tesseract',
  defaultParser: 'regex',

  documents: {
    invoice: {
      provider: 'tesseract',
      parser: 'regex',
    },
    delivery_note: {
      provider: 'tesseract',
      parser: 'regex',
    },
    quote: {
      provider: 'tesseract',
      parser: 'regex',
    },
    purchase_order: {
      provider: 'tesseract',
      parser: 'regex',
    },
  },
};

/**
 * Creates a custom pipeline configuration.
 * @param overrides Partial config to merge with defaults
 * @returns Complete pipeline configuration
 */
export function createPipelineConfig(overrides: Partial<IPipelineConfig>): IPipelineConfig {
  return {
    defaultProvider: overrides.defaultProvider ?? DEFAULT_PIPELINE_CONFIG.defaultProvider,
    defaultParser: overrides.defaultParser ?? DEFAULT_PIPELINE_CONFIG.defaultParser,
    documents: {
      ...DEFAULT_PIPELINE_CONFIG.documents,
      ...overrides.documents,
    },
  };
}

/**
 * Injection token for pipeline configuration.
 */
export const PIPELINE_CONFIG = new InjectionToken<IPipelineConfig>('PIPELINE_CONFIG', {
  providedIn: 'root',
  factory: () => DEFAULT_PIPELINE_CONFIG,
});
