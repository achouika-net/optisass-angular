import { Injectable, inject } from '@angular/core';
import {
  IOcrBlock,
  ISupplierInvoice,
  IInvoiceSupplier,
  IInvoiceClient,
  IInvoiceTotals,
  IValidationResult,
  IValidationError,
  IOcrLocale,
  DateExtractor,
  AmountExtractor,
  IdentifierExtractor,
  ContactExtractor,
  LineItemExtractor,
  CustomerExtractor,
  LooseContactExtractor,
  EntityZoneDetector,
  detectCurrency,
} from '@optisaas/opti-saas-lib';
import { DocumentParser, OcrLocaleService } from '@app/core/ocr';

/**
 * Parser for supplier invoices.
 * Extracts structured data from Moroccan supplier invoices.
 * Uses extractors for multi-language, reusable parsing.
 */
@Injectable()
export class SupplierInvoiceParser extends DocumentParser<ISupplierInvoice> {
  readonly documentType = 'invoice' as const;

  readonly #localeService = inject(OcrLocaleService);
  readonly #dateExtractor = new DateExtractor();
  readonly #amountExtractor = new AmountExtractor();
  readonly #identifierExtractor = new IdentifierExtractor();
  readonly #contactExtractor = new ContactExtractor();
  readonly #customerExtractor = new CustomerExtractor();
  readonly #looseContactExtractor = new LooseContactExtractor();
  readonly #entityZoneDetector = new EntityZoneDetector();
  #lineItemExtractor: LineItemExtractor | null = null;

  /**
   * Extracts invoice data from OCR text.
   * @param rawText Raw text extracted by OCR
   * @param _blocks Text blocks with positions (unused but kept for interface)
   * @returns Structured invoice data
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  extractData(rawText: string, _blocks: IOcrBlock[]): ISupplierInvoice {
    const locale = this.#localeService.getLocaleForText(rawText);

    // Initialize extractor with noise keywords from locale
    if (!this.#lineItemExtractor) {
      this.#lineItemExtractor = new LineItemExtractor(locale.noiseKeywords);
    }

    const supplier = this.#extractSupplier(rawText, locale);
    const client = this.#extractClient(rawText, locale, supplier.name);

    return {
      invoiceNumber: this.#identifierExtractor.extractInvoiceNumber(rawText, locale).value,
      invoiceDate: this.#dateExtractor.extract(rawText, locale, 'invoice').value,
      dueDate: this.#dateExtractor.extract(rawText, locale, 'due').value,
      supplier,
      client,
      lines: this.#lineItemExtractor.extractLines(rawText, 0.2),
      totals: this.#extractTotals(rawText, locale),
      paymentTerms: this.#extractPaymentTerms(rawText, locale),
      currency: detectCurrency(rawText, 'MAD'),
      rawText,
    };
  }

  /**
   * Validates extracted invoice data.
   * @param data Invoice data to validate
   * @returns Validation result
   */
  validate(data: ISupplierInvoice): IValidationResult {
    const errors: IValidationError[] = [];

    if (!data.invoiceNumber) {
      errors.push({ field: 'invoiceNumber', message: 'Invoice number not found' });
    }

    if (!data.invoiceDate) {
      errors.push({ field: 'invoiceDate', message: 'Invoice date not found' });
    }

    if (!data.supplier.name) {
      errors.push({ field: 'supplier.name', message: 'Supplier name not found' });
    }

    if (data.lines.length === 0) {
      errors.push({ field: 'lines', message: 'No invoice lines found' });
    }

    if (data.totals.totalTTC <= 0) {
      errors.push({ field: 'totals.totalTTC', message: 'Total TTC must be positive' });
    }

    const validation = this.#lineItemExtractor.validateAgainstTotal(
      data.lines,
      data.totals.totalHT,
    );

    if (!validation.isValid) {
      errors.push({
        field: 'totals.totalHT',
        message: `Sum of lines (${validation.calculatedTotal.toFixed(2)}) differs from total HT (${data.totals.totalHT.toFixed(2)})`,
      });
    }

    return { isValid: errors.length === 0, errors };
  }

  /**
   * Extracts supplier information using multi-layer strategy.
   * Layer 1: Strict extraction (ContactExtractor + EntityZoneDetector)
   * Layer 2: Footer extraction (legal info: ICE, IF, RC, RIB, bank)
   * Layer 3: Fallback (LooseContactExtractor - optisass-angular patterns)
   */
  #extractSupplier(text: string, locale: IOcrLocale): IInvoiceSupplier {
    const moroccanIds = this.#identifierExtractor.extractAllMoroccan(text);

    // Layer 1: Strict extraction from header
    const contactInfo = this.#contactExtractor.extractAllDetailed(text, locale);
    const entityBlocks = this.#entityZoneDetector.detectEntityBlocks(text);

    // Layer 2: Footer extraction (legal info)
    const footerInfo = entityBlocks.vendorFooter
      ? this.#entityZoneDetector.extractVendorFromFooter(entityBlocks.vendorFooter.text)
      : null;

    // Merge footer info with moroccanIds (footer takes priority for legal fields)
    const mergedIds = {
      ice: footerInfo?.ice ?? moroccanIds.ice,
      fiscalId: footerInfo?.fiscalId ?? moroccanIds.fiscalId,
      tradeRegister: footerInfo?.tradeRegister ?? moroccanIds.tradeRegister,
      cnss: footerInfo?.cnss ?? null,
      patente: footerInfo?.patente ?? null,
      bank: footerInfo?.bank ?? null,
      rib: footerInfo?.rib ?? null,
    };

    // Check if strict extraction succeeded
    const strictConfidence = contactInfo.name ? 0.8 : 0;

    if (strictConfidence >= 0.5) {
      return {
        name: contactInfo.name ?? 'Fournisseur non identifié',
        ice: mergedIds.ice,
        fiscalId: mergedIds.fiscalId,
        tradeRegister: mergedIds.tradeRegister,
        cnss: mergedIds.cnss,
        patente: mergedIds.patente,
        address: contactInfo.address,
        phone: contactInfo.phone,
        email: contactInfo.email,
        bank: mergedIds.bank,
        rib: mergedIds.rib,
        addressDetails: contactInfo.addressDetails,
        _source: entityBlocks.vendor?.source ?? 'header_left',
        _confidence: strictConfidence,
      };
    }

    // Layer 3: Fallback to loose extraction (optisass-angular patterns)
    const looseResult = this.#looseContactExtractor.extractFullSupplier(text, locale);

    return {
      name: looseResult.name ?? 'Fournisseur non identifié',
      ice: looseResult.ice ?? mergedIds.ice,
      fiscalId: looseResult.fiscalId ?? mergedIds.fiscalId,
      tradeRegister: looseResult.tradeRegister ?? mergedIds.tradeRegister,
      cnss: mergedIds.cnss,
      patente: mergedIds.patente,
      address: contactInfo.address,
      phone: looseResult.phone ?? contactInfo.phone,
      email: looseResult.email ?? contactInfo.email,
      bank: mergedIds.bank,
      rib: mergedIds.rib,
      addressDetails: contactInfo.addressDetails,
      _source: 'inferred',
      _confidence: looseResult._confidence,
    };
  }

  /**
   * Extracts client/customer information from invoice.
   * Uses CustomerExtractor with multi-strategy approach.
   * @param text Raw text
   * @param locale OCR locale
   * @param vendorName Vendor name to avoid confusion
   * @returns Client info or undefined if not found
   */
  #extractClient(text: string, locale: IOcrLocale, vendorName: string): IInvoiceClient | undefined {
    const result = this.#customerExtractor.extractCustomer(text, locale, vendorName);

    if (result.customer && result.confidence >= 0.5) {
      return result.customer;
    }

    return undefined;
  }

  /**
   * Extracts invoice totals.
   */
  #extractTotals(text: string, locale: IOcrLocale): IInvoiceTotals {
    const amounts = this.#amountExtractor.extractAllLabeled(text, locale);

    const totalHT = amounts.totalHT.value ?? 0;
    const totalTTC = amounts.totalTTC.value ?? 0;
    const extractedVAT = amounts.vat.value;

    const calculatedVAT = extractedVAT ?? this.#amountExtractor.calculateVAT(totalHT, totalTTC);

    return {
      totalHT,
      totalVAT: calculatedVAT,
      totalTTC,
      discount: amounts.discount.value,
    };
  }

  /**
   * Extracts payment terms.
   */
  #extractPaymentTerms(text: string, locale: IOcrLocale): string | null {
    for (const pattern of locale.paymentTerms) {
      const match = text.match(pattern);
      if (match) {
        return match[1]?.trim() ?? match[0].trim();
      }
    }
    return null;
  }
}
