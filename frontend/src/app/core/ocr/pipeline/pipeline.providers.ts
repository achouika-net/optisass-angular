import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { IPipelineConfig } from '@app/models';
import { PIPELINE_CONFIG, createPipelineConfig } from './pipeline.config.token';
import { AiInvoiceParser } from './parsers';

/**
 * Provides pipeline configuration and parsers.
 * Call in app.config.ts to configure the OCR pipeline.
 *
 * @example
 * ```typescript
 * // app.config.ts
 * export const appConfig: ApplicationConfig = {
 *   providers: [
 *     providePipeline({
 *       documents: {
 *         invoice: { provider: 'tesseract', parser: 'ai' }
 *       }
 *     })
 *   ]
 * };
 * ```
 *
 * @param config Pipeline configuration overrides
 * @returns Angular environment providers
 */
export function providePipeline(config?: Partial<IPipelineConfig>): EnvironmentProviders {
  const mergedConfig = config ? createPipelineConfig(config) : undefined;

  return makeEnvironmentProviders([
    // AI parsers need to be provided
    AiInvoiceParser,

    // Provide config if specified
    ...(mergedConfig
      ? [
          {
            provide: PIPELINE_CONFIG,
            useValue: mergedConfig,
          },
        ]
      : []),
  ]);
}
