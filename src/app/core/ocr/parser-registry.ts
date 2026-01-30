import { Injectable, InjectionToken, Type, Injector, inject } from '@angular/core';
import { OcrDocumentType } from '@app/models';
import { DocumentParser } from './document-parser';

/**
 * Parser configuration for a document type.
 */
export interface IParserRegistration<T = unknown> {
  documentType: OcrDocumentType;
  parser: Type<DocumentParser<T>>;
  description: string;
}

/**
 * Global parser configuration.
 */
export interface IParserConfig {
  parsers: IParserRegistration[];
}

/**
 * Injection token for parser configuration.
 */
export const PARSER_CONFIG = new InjectionToken<IParserConfig>('PARSER_CONFIG');

/**
 * Default configuration (empty, to be enriched by features).
 */
export const DEFAULT_PARSER_CONFIG: IParserConfig = {
  parsers: [],
};

/**
 * Central registry for document parsers.
 * Allows getting the right parser based on document type.
 */
@Injectable({ providedIn: 'root' })
export class ParserRegistry {
  readonly #injector = inject(Injector);
  readonly #config = inject(PARSER_CONFIG, { optional: true }) ?? DEFAULT_PARSER_CONFIG;
  readonly #instances = new Map<OcrDocumentType, DocumentParser<unknown>>();

  /**
   * Gets the parser for a document type.
   * @param documentType Document type
   * @returns Parser instance
   */
  getParser<T>(documentType: OcrDocumentType): DocumentParser<T> {
    const cached = this.#instances.get(documentType);
    if (cached) {
      return cached as DocumentParser<T>;
    }

    const registration = this.#config.parsers.find((p) => p.documentType === documentType);
    if (!registration) {
      throw new Error(`No parser registered for document type: ${documentType}`);
    }

    const parser = this.#injector.get(registration.parser);
    this.#instances.set(documentType, parser);

    return parser as DocumentParser<T>;
  }

  /**
   * Checks if a parser exists for a document type.
   * @param documentType Document type
   * @returns true if a parser is registered
   */
  hasParser(documentType: OcrDocumentType): boolean {
    return this.#config.parsers.some((p) => p.documentType === documentType);
  }

  /**
   * Lists all supported document types.
   * @returns List of types with their descriptions
   */
  getSupportedTypes(): { type: OcrDocumentType; description: string }[] {
    return this.#config.parsers.map((p) => ({
      type: p.documentType,
      description: p.description,
    }));
  }
}
