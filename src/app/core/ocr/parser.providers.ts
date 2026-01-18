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
 * Validates parser registrations for duplicates.
 * @param registrations Parser registrations to validate
 * @throws Error if duplicate document types are found
 */
function validateRegistrations(registrations: IParserRegistration[]): void {
  const types = registrations.map((r) => r.documentType);
  const duplicates = types.filter((type, index) => types.indexOf(type) !== index);

  if (duplicates.length > 0) {
    const uniqueDuplicates = [...new Set(duplicates)];
    throw new Error(
      `Duplicate parser registrations for document types: ${uniqueDuplicates.join(', ')}. ` +
        'Each document type can only have one parser registered.',
    );
  }
}

/**
 * Configures document parsers.
 * Call in app.config.ts or in lazy-loaded routes.
 * Validates that no duplicate document types are registered.
 * @param registrations List of parsers to register
 * @returns Angular providers
 * @throws Error if duplicate document types are found
 */
export function provideParsers(...registrations: IParserRegistration[]): EnvironmentProviders {
  validateRegistrations(registrations);

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
