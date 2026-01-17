import { EnvironmentProviders, makeEnvironmentProviders, Provider, Type } from '@angular/core';
import { OcrDocumentType } from '@optisaas/opti-saas-lib';
import { DocumentParser } from './document-parser';
import { PARSER_CONFIG, IParserConfig, IParserRegistration } from './parser-registry';

/**
 * Creates a parser registration.
 * @param documentType Document type
 * @param parser Parser class
 * @param description Human-readable description
 * @returns Registration configuration
 */
export function registerParser<T>(
  documentType: OcrDocumentType,
  parser: Type<DocumentParser<T>>,
  description: string,
): IParserRegistration<T> {
  return { documentType, parser, description };
}

/**
 * Configures document parsers.
 * Call in app.config.ts or in lazy-loaded routes.
 * @param registrations List of parsers to register
 * @returns Angular providers
 */
export function provideParsers(...registrations: IParserRegistration[]): EnvironmentProviders {
  const parserProviders: Provider[] = registrations.map((r) => r.parser);

  const config: IParserConfig = {
    parsers: registrations,
  };

  return makeEnvironmentProviders([
    ...parserProviders,
    {
      provide: PARSER_CONFIG,
      useValue: config,
    },
  ]);
}
