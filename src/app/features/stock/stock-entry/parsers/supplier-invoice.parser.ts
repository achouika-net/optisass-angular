import { Injectable, inject } from '@angular/core';
import {
  IOcrBlock,
  ISupplierInvoice,
  IInvoiceSupplier,
  IInvoiceTotals,
  IValidationResult,
  IValidationError,
  IOcrLocale,
  DateExtractor,
  AmountExtractor,
  IdentifierExtractor,
  ContactExtractor,
  LineItemExtractor,
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
  readonly #lineItemExtractor = new LineItemExtractor();

  /**
   * Extracts invoice data from OCR text.
   * @param rawText Raw text extracted by OCR
   * @param _blocks Text blocks with positions (unused but kept for interface)
   * @returns Structured invoice data
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  extractData(rawText: string, _blocks: IOcrBlock[]): ISupplierInvoice {
    const locale = this.#localeService.getLocaleForText(rawText);

    return {
      invoiceNumber: this.#identifierExtractor.extractInvoiceNumber(rawText, locale).value,
      invoiceDate: this.#dateExtractor.extract(rawText, locale, 'invoice').value,
      dueDate: this.#dateExtractor.extract(rawText, locale, 'due').value,
      supplier: this.#extractSupplier(rawText, locale),
      lines: this.#lineItemExtractor.extractLines(rawText, 0.2, locale.noiseKeywords),
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
   * Extracts supplier information from text.
   */
  #extractSupplier(text: string, locale: IOcrLocale): IInvoiceSupplier {
    const moroccanIds = this.#identifierExtractor.extractAllMoroccan(text);
    const contactInfo = this.#contactExtractor.extractAll(text, locale);

    return {
      name: contactInfo.name ?? 'Unknown Supplier',
      ice: moroccanIds.ice,
      fiscalId: moroccanIds.fiscalId,
      tradeRegister: moroccanIds.tradeRegister,
      address: contactInfo.address,
      phone: contactInfo.phone,
    };
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
