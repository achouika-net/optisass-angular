import { Injectable } from '@angular/core';
import { createWorker } from 'tesseract.js';
import * as pdfjsLib from 'pdfjs-dist';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { firstValueFrom } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class OcrService {

    constructor(private http: HttpClient) {
        // Configure PDF.js worker
        // vital: Ensure version matches the installed package (5.4.530).
        (pdfjsLib as any).GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@5.4.530/build/pdf.worker.min.mjs`;
    }

    async recognizeText(input: File | string, forceLocal: boolean = false): Promise<any> {
        // TENTATIVE AVEC N8N SI CONFIGURÉ ET NON FORCÉ LOCAL
        if (!forceLocal && input instanceof File && environment.n8nWebhookUrl && !environment.n8nWebhookUrl.includes('REPLACE_WITH')) {
            try {
                console.log('🚀 OCR: Attempting intelligent extraction via n8n...');
                console.log('🔗 OCR: Webhook URL:', environment.n8nWebhookUrl);
                const n8nResponse = await this.recognizeWithN8n(input);
                console.log('✅ OCR: Result from n8n (Intelligent):', n8nResponse);
                // Si n8n renvoie un tableau (standard), on prend le premier élément
                const data = Array.isArray(n8nResponse) ? n8nResponse[0] : n8nResponse;
                return { ...data, source: 'n8n' };
            } catch (err: any) {
                console.warn('⚠️ OCR: n8n failed', err);
                return {
                    error: `n8n (500): ${err.message || 'Erreur interne'}. Vérifiez vos credentials OpenAI dans n8n local.`,
                    source: 'n8n_failed'
                };
            }
        }

        try {
            let imageUrls: string[] = [];
            // ... (reste de la logique locale existante)

            // 1. Determine Input Type and Convert to Image URLs
            if (input instanceof File) {
                if (input.type === 'application/pdf') {
                    console.log('📄 OCR: PDF detected. Rendering all pages...');
                    imageUrls = await this.convertPdfToImages(input);
                } else {
                    imageUrls = [URL.createObjectURL(input)];
                }
            } else {
                imageUrls = [input];
            }

            if (imageUrls.length === 0) throw new Error('Failed to generate image URLs');

            console.log(`🤖 OCR: Initializing Tesseract (fra+eng) for ${imageUrls.length} page(s)...`);
            const worker = await createWorker('fra+eng', 1, {
                logger: m => console.log('🤖 Tesseract Progress:', m)
            });

            let combinedText = '';

            for (let i = 0; i < imageUrls.length; i++) {
                console.log(`🖼️ OCR: Processing page ${i + 1}/${imageUrls.length}...`);
                const processedImage = await this.preprocessImage(imageUrls[i]);
                const ret = await worker.recognize(processedImage);
                combinedText += ret.data.text + '\n---\n';
            }

            console.log('✅ OCR: Total Raw Text Length:', combinedText.length);

            // 4. Structured Data Extraction
            const extracted = this.extractData(combinedText);

            await worker.terminate();

            return {
                rawText: combinedText || '[No text detected]',
                ...extracted
            };
        } catch (error: any) {
            console.error('❌ OCR Fatal Error:', error);
            return {
                rawText: '',
                error: `Erreur: ${error.message || 'Échec du traitement'}.`,
                lines: []
            };
        }
    }

    private async convertPdfToImages(file: File): Promise<string[]> {
        return new Promise((resolve, reject) => {
            const fileReader = new FileReader();
            fileReader.onload = async (e: any) => {
                try {
                    console.log('📄 PDF: Starting full document conversion...');
                    const typedarray = new Uint8Array(e.target.result);
                    const pdf = await pdfjsLib.getDocument(typedarray).promise;
                    const pages: string[] = [];

                    console.log(`📄 PDF: ${pdf.numPages} pages found.`);

                    for (let i = 1; i <= pdf.numPages; i++) {
                        console.log(`📄 PDF: Rendering page ${i}...`);
                        const page = await pdf.getPage(i);
                        const scale = 4.0;
                        const viewport = page.getViewport({ scale });

                        const canvas = document.createElement('canvas');
                        const context = canvas.getContext('2d', { willReadFrequently: true });
                        if (!context) throw new Error('Canvas context not available');

                        canvas.height = viewport.height;
                        canvas.width = viewport.width;

                        const renderContext: any = {
                            canvasContext: context,
                            viewport: viewport,
                            enableWebGL: true
                        };

                        await page.render(renderContext).promise;
                        pages.push(canvas.toDataURL('image/png'));
                    }

                    console.log('📄 PDF: All pages rendered.');
                    resolve(pages);
                } catch (err) {
                    console.error('❌ PDF Conversion Error:', err);
                    reject(err);
                }
            };
            fileReader.readAsArrayBuffer(file);
        });
    }

    private async preprocessImage(imageUrl: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                if (!ctx) return resolve(imageUrl);

                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);

                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageData.data;

                // Improved Grayscale & Contrast
                for (let i = 0; i < data.length; i += 4) {
                    const r = data[i];
                    const g = data[i + 1];
                    const b = data[i + 2];

                    // Grayscale (Luminance)
                    let gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;

                    // Contrast Increase (Factor 1.2 = 20% boost)
                    const factor = 1.2;
                    gray = factor * (gray - 128) + 128;

                    // Clamp
                    gray = Math.max(0, Math.min(255, gray));

                    // REMOVED BINARIZATION: 
                    // Tesseract handles grayscale better than a bad binary threshold.
                    // Especially for light blue text which might be lost.

                    // Write back
                    data[i] = gray;
                    data[i + 1] = gray;
                    data[i + 2] = gray;
                }
                ctx.putImageData(imageData, 0, 0);
                resolve(canvas.toDataURL('image/jpeg', 1.0));
            };
            // If image fails to load (e.g. it was a raw PDF url), strict reject
            img.onerror = (e) => {
                console.error('Image Load Error', e);
                reject(e);
            };
            img.src = imageUrl;
        });
    }

    private extractData(text: string) {
        // Normalize text
        // Replace commas with dots for decimals
        let cleanText = text.replace(/,/g, '.');

        const result: any = {
            total: null,
            date: null,
            lines: []
        };

        // A. Extract Total
        const totalRegex = /(?:Total|TTC|Net|Montant).*?(\d+(?:\.\d{2})?).*?(?:DH|MAD|€)?/i;
        const totalMatch = cleanText.match(totalRegex);
        if (totalMatch) result.total = parseFloat(totalMatch[1].replace(/\s/g, ''));

        // B. Extract Headers (Invoice Num, Date, Supplier)
        // 1. Invoice Number
        // Relaxed regex to handle "Facture N°", "Facture No", "Facture N", and OCR noise like "N0"
        const invoiceNumRegex = /(?:Facture|Ref|Fc)\s*(?:N°|No|N\.|N0|N|#)?\s*[:.]?\s*([A-Za-z0-9\-\/]+)/i;
        // Fallback specifically for the "FA+Year..." pattern seen in the user's document
        const faFallbackRegex = /(FA\d{6,}[A-Za-z0-9]*)/;

        let invMatch = cleanText.match(invoiceNumRegex);
        // If main regex fails or finds something too short (< 4 chars), try fallback
        if (!invMatch || (invMatch && invMatch[1].length <= 3)) {
            invMatch = cleanText.match(faFallbackRegex);
        }

        if (invMatch) {
            // Filter out false positives (too short)
            if (invMatch[1].length > 3) result.invoiceNumber = invMatch[1].trim();
        }

        // 2. Date - Multiple attempts with different patterns
        console.log('[OCR] Starting date extraction...');

        // Pattern 1: Standard labels (Date:, Le:, Du:, etc.)
        const dateRegex1 = /(?:Date|Du|Le|Facture du)\s*:?\s*(\d{1,2})\s*[\/\-\.]\s*(\d{1,2})\s*[\/\-\.]\s*(\d{2,4})/i;
        // Pattern 2: City + "le," pattern (Rabat le, Casablanca le,)
        const dateRegex2 = /(?:Rabat|Casablanca|Marrakech|Fes|Tanger|Agadir)?\s*le,?\s*(\d{1,2})\s*[\/\-\.]\s*(\d{1,2})\s*[\/\-\.]\s*(\d{2,4})/i;
        // Pattern 3: Just "le," followed by date (very permissive)
        const dateRegex3 = /le[,\s]*(\d{1,2})\s*[\/\-\.]\s*(\d{1,2})\s*[\/\-\.]\s*(\d{2,4})/i;
        // Pattern 4: Any "Rabat" followed by date within reasonable distance
        const dateRegex4 = /Rabat[\s\S]{0,20}(\d{1,2})\s*[\/\-\.]\s*(\d{1,2})\s*[\/\-\.]\s*(\d{2,4})/i;
        // Pattern 5: Fallback - any date pattern DD/MM/YYYY
        const dateRegex5 = /(\d{1,2})\s*[\/\-\.]\s*(\d{1,2})\s*[\/\-\.]\s*(\d{2,4})/;

        let dateMatch = cleanText.match(dateRegex1);
        let matchedPattern = dateMatch ? 'Pattern 1 (Date/Le/Du)' : null;

        if (!dateMatch) {
            dateMatch = cleanText.match(dateRegex2);
            matchedPattern = dateMatch ? 'Pattern 2 (City + le)' : null;
        }
        if (!dateMatch) {
            dateMatch = cleanText.match(dateRegex3);
            matchedPattern = dateMatch ? 'Pattern 3 (le + date)' : null;
        }
        if (!dateMatch) {
            dateMatch = cleanText.match(dateRegex4);
            matchedPattern = dateMatch ? 'Pattern 4 (Rabat proximity)' : null;
        }
        if (!dateMatch) {
            dateMatch = cleanText.match(dateRegex5);
            matchedPattern = dateMatch ? 'Pattern 5 (Fallback any date)' : null;
        }

        if (dateMatch) {
            console.log(`[OCR] Date pattern matched: ${matchedPattern}, captured: "${dateMatch[0]}"`);
            const day = parseInt(dateMatch[1], 10);
            const month = parseInt(dateMatch[2], 10);
            let year = parseInt(dateMatch[3], 10);

            console.log(`[OCR] Parsed date components: day=${day}, month=${month}, year=${year}`);

            // Handle 2-digit years (e.g. 25 -> 2025)
            if (year < 100) {
                year += 2000;
            }

            // Basic validation
            if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 2000 && year <= 2100) {
                const detectedDate = new Date(year, month - 1, day);
                const now = new Date();
                const oneYearFromNow = new Date();
                oneYearFromNow.setFullYear(now.getFullYear() + 1);

                console.log(`[OCR] Date validation: detectedDate=${detectedDate.toISOString()}, now=${now.toISOString()}, oneYearFromNow=${oneYearFromNow.toISOString()}`);

                // Validation: Avoid obvious future junk dates (e.g. > 1 year in the future)
                if (!isNaN(detectedDate.getTime()) && detectedDate <= oneYearFromNow) {
                    result.date = detectedDate;
                    console.log(`✅ [OCR] Valid date detected: ${detectedDate.toLocaleDateString()} from ${matchedPattern}`);
                } else {
                    console.warn(`❌ [OCR] Ignored suspicious future date: ${dateMatch[0]} (${detectedDate.toLocaleDateString()})`);
                }
            } else {
                console.warn(`❌ [OCR] Date components out of range: day=${day}, month=${month}, year=${year}`);
            }
        } else {
            console.warn('❌ [OCR] No date pattern matched in text');
            // Log first 500 chars to help debug
            console.log('[OCR] Text sample for debugging:', cleanText.substring(0, 500));
        }

        // 3. Supplier (Heuristic)
        // Look for "DK DISTRIBUTION" or lines with "SARL", "DISTRIBUTION", "OPTICAL"
        const supplierRegex = /^.*(?:DISTRIBUTION|SOCIETE|OPTICAL|VISION|LUNETTES|EYEWEAR).*$/im;
        const supplierMatch = cleanText.match(supplierRegex);
        if (supplierMatch) {
            result.supplierName = supplierMatch[0].trim();
        }

        // C. Extract Product Lines (Specific Format)
        // Format: [Code] [Designation] [Qty] [PU] [Remise] [Montant]
        // Example: 197737121778 CH-HER 0298/G/S.807.55.HA 1 1 045.00 15.00% 888.25

        const lines = cleanText.split('\n');

        lines.forEach(line => {
            line = line.trim();
            if (line.length < 15) return;

            const lowerLine = line.toLowerCase();
            const noiseKeywords = [
                'a reporter', 'net à payer', 'tva ', 't.v.a', 'montant h.t', 'total h.t',
                'facture n', 'date :', 'tél :', 'fixe :', 'site :', 'email :', 'rib :', 'if :', 'rc :',
                'arrêtée la présente', 'page ', 'somme ttc', 'dirhams', 'modèle'
            ];
            if (noiseKeywords.some(k => lowerLine.includes(k))) return;
            if (/^total/i.test(lowerLine) && !lowerLine.includes('total 1')) return;

            // Updated Regex:
            // 1. Code: Alphanumeric
            // 2. Designation: Text
            // 3. Qty: Number (integer or decimal like 1,00)
            // 4. Price Block: Allowing malformed delimiters like f, ], }, etc.
            const lineRegex = /^([a-z0-9\-\.]+)\s+(.+?)\s+(\d+(?:[\.,]\d+)?)\s+([\d\s\.,\]\[\}\{\)\|f]+)\s+([\d\.\s]+)%?\s+([\d\s\.,]+)/i;
            const match = line.match(lineRegex);

            if (match) {
                // Raw captured fields
                const rawRef = match[1]; // Captured as first token (was code)
                const rawDesc = match[2];
                const qtyRaw = match[3].replace(',', '.');
                const qty = parseFloat(qtyRaw) || 1;

                const cleanNum = (s: string) => s.replace(/[^\d\.]/g, '');
                const puRaw = cleanNum(match[4].replace(',', '.'));
                const discountRaw = cleanNum(match[5].replace(',', '.'));

                const pu = parseFloat(puRaw) || 0;
                const discount = parseFloat(discountRaw) || 0;
                const netPrice = pu * (1 - (discount / 100));

                // Designation Logic: Full line string (Ref + Desc)
                // User requested: "colonne designation on va affiche la ligne complet la marque la reference"
                const fullDesignation = `${rawRef} ${rawDesc}`.trim();

                // Brand Extraction (Simple heuristic)
                // If the description starts with an uppercase word?
                const parts = rawDesc.split(/\s+/);
                let brand = parts[0];
                if (brand.length < 3) brand = ''; // Too short, likely noise

                result.lines.push({
                    raw: line,
                    code: '', // Explicitly empty as requested ("document has no code", use system code later)
                    reference: rawRef, // The document reference/model (first token)
                    brand: brand,
                    designation: fullDesignation, // Full designation including ref/brand/model
                    qty: qty,
                    priceCandidates: [pu],
                    discount: discount,
                    computedPrice: parseFloat(netPrice.toFixed(2))
                });
            } else {
                // MODERATE FALLBACK
                const fallbackRegex = /^([a-z0-9\-\.]{4,})\s+(.+?)\s+(\d+(?:[\.,]\d+)?)\s+([\d\s\.,]+)$/i;
                const fMatch = line.match(fallbackRegex);
                if (fMatch) {
                    const ref = fMatch[1];
                    const text = fMatch[2];
                    const qtyRaw = fMatch[3].replace(',', '.');
                    const qty = parseFloat(qtyRaw) || 1;
                    const price = parseFloat(fMatch[4].replace(/[^\d\.]/g, '').replace(',', '.')) || 0;

                    result.lines.push({
                        raw: line,
                        reference: ref,
                        designation: text.trim(),
                        qty: qty,
                        priceCandidates: [price],
                        computedPrice: price,
                        rawFallback: true
                    });
                }
            }
        });

        // Safe filter: remove any line that captured header keywords by mistake
        result.lines = result.lines.filter((l: any) =>
            !l.designation.toLowerCase().includes('designation') &&
            !l.designation.toLowerCase().includes('montant')
        );

        return result;
    }

    /**
     * Appelle le workflow n8n pour une extraction intelligente par IA
     */
    async recognizeWithN8n(file: File): Promise<any> {
        const formData = new FormData();
        formData.append('file', file); // Use 'file' to match n8n default property name

        // Native fetch bypasses Angular interceptors and provides clearer CORS errors
        const response = await fetch(environment.n8nWebhookUrl, {
            method: 'POST',
            body: formData,
            mode: 'cors',
            credentials: 'omit' // Vital: specific fix for your CORS error
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Serveur (n8n): ${response.status} ${errorText}`);
        }

        return await response.json();
    }
}
