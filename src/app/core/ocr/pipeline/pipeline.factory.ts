import { Injectable, inject, Injector, Type } from '@angular/core';
import {
  IPipelineFactory,
  IPipelineConfig,
  IPipelineDocumentConfig,
  OcrDocumentType,
  ParserStrategyType,
} from '@optisaas/opti-saas-lib';
import { OcrService } from '../ocr.service';
import { OcrLocaleService } from '../services/locale.service';
import { ParserRegistry } from '../parser-registry';
import { PIPELINE_CONFIG } from './pipeline.config.token';
import { OcrPipeline, IPipelineParser } from './ocr-pipeline';
import { AiInvoiceParser } from './parsers/ai-invoice.parser';

/**
 * Registry of AI parser classes by document type.
 */
type IAiParserRegistry = Record<string, Type<IPipelineParser<unknown>>>;

/**
 * Factory for creating OCR pipelines.
 * Reads configuration and instantiates the correct provider/parser combination.
 */
@Injectable({ providedIn: 'root' })
export class PipelineFactory implements IPipelineFactory {
  readonly #config = inject(PIPELINE_CONFIG);
  readonly #ocrService = inject(OcrService);
  readonly #localeService = inject(OcrLocaleService);
  readonly #injector = inject(Injector);

  /**
   * AI parser registry - maps document type to AI parser class.
   */
  readonly #aiParsers: IAiParserRegistry = {
    invoice: AiInvoiceParser,
    // Add more AI parsers here as needed:
    // delivery_note: AiDeliveryNoteParser,
  };

  /**
   * Cache for instantiated parser adapters.
   */
  readonly #parserCache = new Map<string, IPipelineParser<unknown>>();

  /**
   * Creates a pipeline for a document type.
   * @param documentType Type of document to process
   * @param configOverride Optional config override
   * @returns Configured pipeline
   */
  create<T>(
    documentType: OcrDocumentType,
    configOverride?: Partial<IPipelineDocumentConfig>,
  ): OcrPipeline<T> {
    const docConfig = this.#getDocumentConfig(documentType, configOverride);
    const parser = this.#getParser<T>(documentType, docConfig.parser);
    const language = docConfig.language ?? this.#localeService.getTesseractLanguage();

    return new OcrPipeline<T>(
      this.#ocrService,
      parser,
      documentType,
      docConfig.provider,
      docConfig.parser,
      language,
    );
  }

  /**
   * Gets the current configuration.
   * @returns Pipeline configuration
   */
  getConfig(): IPipelineConfig {
    return this.#config;
  }

  /**
   * Registers an AI parser for a document type.
   * @param documentType Document type
   * @param parserClass Parser class implementing IPipelineParser
   */
  registerAiParser<T>(documentType: OcrDocumentType, parserClass: Type<IPipelineParser<T>>): void {
    this.#aiParsers[documentType] = parserClass as Type<IPipelineParser<unknown>>;
  }

  /**
   * Gets the merged config for a document type.
   */
  #getDocumentConfig(
    documentType: OcrDocumentType,
    override?: Partial<IPipelineDocumentConfig>,
  ): IPipelineDocumentConfig {
    const base = this.#config.documents[documentType] ?? {
      provider: this.#config.defaultProvider,
      parser: this.#config.defaultParser,
    };

    return {
      provider: override?.provider ?? base.provider,
      parser: override?.parser ?? base.parser,
      language: override?.language ?? base.language,
    };
  }

  /**
   * Gets or creates a parser instance.
   */
  #getParser<T>(documentType: OcrDocumentType, strategy: ParserStrategyType): IPipelineParser<T> {
    const cacheKey = `${documentType}:${strategy}`;

    const cached = this.#parserCache.get(cacheKey);
    if (cached) {
      return cached as IPipelineParser<T>;
    }

    let parser: IPipelineParser<T>;

    if (strategy === 'regex') {
      parser = this.#getRegexParser<T>(documentType);
    } else if (strategy === 'ai') {
      parser = this.#getAiParser<T>(documentType);
    } else if (strategy === 'hybrid') {
      // Hybrid: for now, use regex (full hybrid would need confidence checking)
      parser = this.#getRegexParser<T>(documentType);
    } else {
      throw new Error(`Unknown parser strategy: ${strategy}`);
    }

    this.#parserCache.set(cacheKey, parser as IPipelineParser<unknown>);
    return parser;
  }

  /**
   * Gets a regex parser from the existing ParserRegistry.
   * DocumentParser now implements IDataExtractor publicly, no adapter needed.
   */
  #getRegexParser<T>(documentType: OcrDocumentType): IPipelineParser<T> {
    const parserRegistry = this.#injector.get(ParserRegistry);

    if (!parserRegistry.hasParser(documentType)) {
      throw new Error(`No regex parser registered for document type: ${documentType}`);
    }

    // DocumentParser implements IDataExtractor, compatible with IPipelineParser
    return parserRegistry.getParser<T>(documentType) as unknown as IPipelineParser<T>;
  }

  /**
   * Gets or creates an AI parser.
   */
  #getAiParser<T>(documentType: OcrDocumentType): IPipelineParser<T> {
    const parserClass = this.#aiParsers[documentType];

    if (!parserClass) {
      throw new Error(`No AI parser registered for document type: ${documentType}`);
    }

    return this.#injector.get(parserClass) as IPipelineParser<T>;
  }
}
