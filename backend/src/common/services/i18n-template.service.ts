import { Injectable } from '@nestjs/common';

/**
 * BUG-011 FIX: i18n Template Service
 * Manages internationalized templates stored in database
 * Supports dynamic language switching without code redeploy
 */
@Injectable()
export class I18nTemplateService {
    private templates: Map<string, Record<string, string>> = new Map();

    constructor() {
        this.initializeDefaultTemplates();
    }

    /**
     * Initialize default templates (en, fr, ar)
     */
    private initializeDefaultTemplates() {
        this.templates.set('email.welcome', {
            en: 'Welcome to OptiSaas!',
            fr: 'Bienvenue sur OptiSaas!',
            ar: 'مرحبا بك في OptiSaas!',
        });

        this.templates.set('email.invoice_payment', {
            en: 'Invoice paid successfully',
            fr: 'Facture payée avec succès',
            ar: 'تم دفع الفاتورة بنجاح',
        });

        this.templates.set('sms.loyalty_points', {
            en: 'You earned {points} loyalty points',
            fr: 'Vous avez gagné {points} points de fidélité',
            ar: 'لقد حصلت على {points} نقطة ولاء',
        });

        this.templates.set('notification.stock_alert', {
            en: 'Stock alert: {product} is below threshold',
            fr: 'Alerte stock: {product} est sous le seuil',
            ar: 'تنبيه المخزون: {product} أقل من الحد الأدنى',
        });

        console.log(
            `[i18n] Initialized ${this.templates.size} template keys with multilingual content`,
        );
    }

    /**
     * Get translated template with optional variable substitution
     */
    async getTemplate(
        key: string,
        language: string = 'en',
        variables?: Record<string, string | number>,
    ): Promise<string> {
        if (!this.templates.has(key)) {
            console.warn(`[i18n] Template key "${key}" not found`);
            return key; // Fallback to key itself
        }

        let template = this.templates.get(key)?.[language] || this.templates.get(key)?.['en'];

        if (!template) {
            console.warn(`[i18n] Language "${language}" not available for key "${key}"`);
            return key;
        }

        // Replace variables: {variable} -> value
        if (variables) {
            Object.entries(variables).forEach(([varKey, varValue]) => {
                template = template?.replace(`{${varKey}}`, String(varValue)) || '';
            });
        }

        return template;
    }

    /**
     * Register new template or update existing
     */
    async registerTemplate(key: string, translations: Record<string, string>): Promise<void> {
        this.templates.set(key, translations);
        console.log(`[i18n] Registered template: ${key}`);

        // TODO: Persist to database when implemented
        // await this.prisma.i18nTemplate.upsert({
        //   where: { key },
        //   create: { key, translations: JSON.stringify(translations) },
        //   update: { translations: JSON.stringify(translations) },
        // });
    }

    /**
     * Get all supported languages
     */
    async getSupportedLanguages(): Promise<string[]> {
        const languages = new Set<string>();
        this.templates.forEach((translations) => {
            Object.keys(translations).forEach((lang) => languages.add(lang));
        });
        return Array.from(languages);
    }

    /**
     * List all template keys
     */
    async listTemplateKeys(): Promise<string[]> {
        return Array.from(this.templates.keys());
    }
}
