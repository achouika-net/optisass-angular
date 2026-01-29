import { Injectable } from '@angular/core';
import { IOcrBlock, ISupplierInvoice } from '@optisaas/opti-saas-lib';
import { IPipelineParser } from '../ocr-pipeline';

/**
 * AI-based invoice parser.
 * Sends OCR text to backend LLM for structured extraction.
 *
 * NOTE: This is a placeholder implementation.
 * The backend endpoint needs to be implemented.
 */
@Injectable()
export class AiInvoiceParser implements IPipelineParser<ISupplierInvoice> {
  /**
   * Extracts invoice data using AI.
   * NOTE: Currently returns a placeholder. Full AI extraction would require
   * making extractData async or implementing a different pattern.
   *
   * @param rawText Raw text extracted by OCR
   * @param _blocks Text blocks (unused in AI extraction)
   * @returns Structured invoice data (placeholder for now)
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  extractData(rawText: string, _blocks: IOcrBlock[]): ISupplierInvoice {
    // TODO: Implement real AI extraction via backend
    // For now, return an empty structure with a warning
    console.warn('AI parser not fully implemented - returning empty invoice structure');
    return this.#createEmptyInvoice(rawText);
  }

  /**
   * Creates an empty invoice structure.
   */
  #createEmptyInvoice(rawText: string): ISupplierInvoice {
    return {
      invoiceNumber: null,
      invoiceDate: null,
      dueDate: null,
      supplier: {
        name: 'Unknown Supplier',
        ice: null,
        fiscalId: null,
        tradeRegister: null,
        cnss: null,
        patente: null,
        address: null,
        phone: null,
        email: null,
        bank: null,
        rib: null,
      },
      lines: [],
      totals: {
        totalHT: 0,
        totalVAT: 0,
        totalTTC: 0,
        discount: null,
      },
      paymentTerms: null,
      currency: 'MAD',
      rawText,
    };
  }
}
