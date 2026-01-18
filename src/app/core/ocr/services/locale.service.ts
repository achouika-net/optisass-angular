import { Injectable, inject, signal, computed } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { IOcrLocale, FR_LOCALE, EN_LOCALE } from '@optisaas/opti-saas-lib';

/**
 * Supported OCR locales.
 */
const OCR_LOCALES: Record<string, IOcrLocale> = {
  fr: FR_LOCALE,
  en: EN_LOCALE,
};

/**
 * Mapping from app language to Tesseract language code.
 */
const TESSERACT_LANGUAGES: Record<string, string> = {
  fr: 'fra',
  en: 'eng',
};

/**
 * Service for managing OCR locales.
 * Provides the appropriate locale based on the app language.
 */
@Injectable({ providedIn: 'root' })
export class OcrLocaleService {
  readonly #translate = inject(TranslateService);

  /** Current locale code */
  readonly localeCode = signal<string>(this.#translate.currentLang || 'fr');

  /** Current OCR locale */
  readonly locale = computed<IOcrLocale>(() => {
    const code = this.localeCode();
    return OCR_LOCALES[code] ?? FR_LOCALE;
  });

  /** All available locales */
  readonly availableLocales = Object.keys(OCR_LOCALES);

  constructor() {
    this.#translate.onLangChange.subscribe((event) => {
      this.localeCode.set(event.lang);
    });
  }

  /**
   * Gets the Tesseract language code for the current app language.
   * @returns Tesseract language code (e.g., 'fra', 'eng')
   */
  getTesseractLanguage(): string {
    return TESSERACT_LANGUAGES[this.localeCode()] ?? 'fra';
  }

  /**
   * Gets a specific locale by code.
   * @param code Locale code
   * @returns The locale or default (FR)
   */
  getLocale(code: string): IOcrLocale {
    return OCR_LOCALES[code] ?? FR_LOCALE;
  }

  /**
   * Detects the locale from text content.
   * @param text Text to analyze
   * @returns Detected locale code
   */
  detectLocale(text: string): string {
    const lowerText = text.toLowerCase();

    // Count locale-specific keywords
    const scores: Record<string, number> = {};

    for (const [code, locale] of Object.entries(OCR_LOCALES)) {
      let score = 0;

      // Check months
      for (const month of locale.months) {
        if (lowerText.includes(month.toLowerCase())) {
          score += 2;
        }
      }

      // Check common keywords based on patterns
      if (code === 'fr') {
        if (lowerText.includes('facture')) score += 3;
        if (lowerText.includes('montant')) score += 2;
        if (lowerText.includes('total')) score += 1;
        if (lowerText.includes('hors taxes')) score += 2;
        if (lowerText.includes('toutes taxes')) score += 2;
        if (lowerText.includes('échéance')) score += 2;
      } else if (code === 'en') {
        if (lowerText.includes('invoice')) score += 3;
        if (lowerText.includes('amount')) score += 2;
        if (lowerText.includes('subtotal')) score += 2;
        if (lowerText.includes('excluding')) score += 2;
        if (lowerText.includes('including')) score += 2;
        if (lowerText.includes('due date')) score += 2;
      }

      scores[code] = score;
    }

    // Return locale with highest score
    let maxScore = 0;
    let detectedLocale = 'fr';

    for (const [code, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score;
        detectedLocale = code;
      }
    }

    return detectedLocale;
  }

  /**
   * Gets the locale for text, auto-detecting if needed.
   * @param text Text to analyze
   * @param preferredLocale Optional preferred locale
   * @returns The appropriate locale
   */
  getLocaleForText(text: string, preferredLocale?: string): IOcrLocale {
    if (preferredLocale && OCR_LOCALES[preferredLocale]) {
      return OCR_LOCALES[preferredLocale];
    }

    const detected = this.detectLocale(text);
    return OCR_LOCALES[detected] ?? FR_LOCALE;
  }
}
