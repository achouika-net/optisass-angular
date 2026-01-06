import { Injectable } from '@angular/core';
import { createWorker } from 'tesseract.js';
import * as pdfjsLib from 'pdfjs-dist';

@Injectable({
    providedIn: 'root'
})
export class OcrService {

    constructor() {
        // Configure PDF.js worker
        // vital: Ensure version matches the installed package. For now using a fixed recent version known to work.
        (pdfjsLib as any).GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;
    }

    async recognizeText(input: File | string): Promise<any> {
        try {
            let imageUrl: string;

            // 1. Determine Input Type and Convert to Image URL if needed
            if (input instanceof File) {
                if (input.type === 'application/pdf') {
                    console.log('📄 PDF detected. Converting to image...');
                    imageUrl = await this.convertPdfToImage(input);
                } else {
                    // Assume Image
                    imageUrl = URL.createObjectURL(input);
                }
            } else {
                // String URL (already an image URL assumed)
                imageUrl = input;
            }

            // 2. Pre-process Image (Grayscale + Contrast)
            const processedImage = await this.preprocessImage(imageUrl);

            // 3. OCR with French & English (for numbers/currency)
            const worker = await createWorker('fra+eng');

            const ret = await worker.recognize(processedImage);
            const text = ret.data.text;

            console.log('📝 Raw OCR Text:', text);

            // 4. Structured Data Extraction (Heuristics)
            const extracted = this.extractData(text);

            await worker.terminate();

            // Clean up created URLs to avoid leaks (if we created them)
            // Note: If we passed a string URL from outside, we shouldn't revoke it here strictly speaking, 
            // but if we created it from File, we should. 
            // For now, relying on the browser/component to handle major cleanup or just let it be for this session.

            return {
                rawText: text,
                ...extracted
            };
        } catch (error) {
            console.error('OCR Error:', error);
            return { rawText: '', error: 'Failed to process image' };
        }
    }

    private async convertPdfToImage(file: File): Promise<string> {
        return new Promise((resolve, reject) => {
            const fileReader = new FileReader();
            fileReader.onload = async (e: any) => {
                try {
                    const typedarray = new Uint8Array(e.target.result);
                    const pdf = await pdfjsLib.getDocument(typedarray).promise;

                    // Get first page
                    const page = await pdf.getPage(1);

                    // Render to Canvas
                    const scale = 3.0; // Higher scale for better OCR resolution
                    const viewport = page.getViewport({ scale });

                    const canvas = document.createElement('canvas');
                    const context = canvas.getContext('2d');
                    if (!context) throw new Error('Canvas context not available');

                    canvas.height = viewport.height;
                    canvas.width = viewport.width;

                    const renderContext: any = {
                        canvasContext: context,
                        viewport: viewport
                    };

                    await page.render(renderContext).promise;

                    // Convert to Image URL
                    resolve(canvas.toDataURL('image/jpeg'));
                } catch (err) {
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

        // B. Extract Date
        const dateRegex = /(\d{2}[/-]\d{2}[/-]\d{4})/;
        const dateMatch = cleanText.match(dateRegex);
        if (dateMatch) {
            const parts = dateMatch[1].split(/[-/]/);
            if (parts.length === 3) {
                result.date = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
            }
        }

        // C. Extract Product Lines (Specific Format)
        // Format: [Code] [Designation] [Qty] [PU] [Remise] [Montant]
        // Example: 197737121778 CH-HER 0298/G/S.807.55.HA 1 1 045.00 15.00% 888.25

        const lines = cleanText.split('\n');

        lines.forEach(line => {
            line = line.trim();
            if (line.length < 15) return; // Slightly more lenient

            // Exclude common footer keywords
            const lowerLine = line.toLowerCase();
            if (lowerLine.includes('total') || lowerLine.includes('reporter') || lowerLine.includes('tva') || lowerLine.includes('net à payer')) {
                return;
            }

            // Even more Robust Regex (removed strict $ anchor to allow trailing debris)
            // Pattern: [Code] [Designation] [Qty] [PU] [Remise] [Total]
            const lineRegex = /^(\d+)\s+(.+?)\s+(\d+)\s+([\d\s\.,\]\[\}\{\)\|]+)\s+([\d\.\s]+)%?\s+([\d\s\.,]+)/;
            const match = line.match(lineRegex);

            if (match) {
                const ref = match[1];
                const rawDesignation = match[2];
                const qty = parseInt(match[3], 10);

                // Clean numbers from noise like ']' or extra spaces or random letters
                const cleanNum = (s: string) => s.replace(/[^\d\.]/g, '');

                const puRaw = cleanNum(match[4]);
                const discountRaw = cleanNum(match[5]);

                const pu = parseFloat(puRaw) || 0;
                const discount = parseFloat(discountRaw) || 0;

                const netPrice = pu * (1 - (discount / 100));

                result.lines.push({
                    raw: line,
                    reference: ref,
                    designation: rawDesignation.trim(),
                    qty: qty,
                    priceCandidates: [pu],
                    discount: discount,
                    computedPrice: parseFloat(netPrice.toFixed(2))
                });
            } else {
                // Secondary check for lines that might have shifted layout
                // Example: "197737121334 CH-HER 0286.15G.53.18 1 1105.00) 15.00%"
                const refMatch = line.match(/^(\d{8,})/);
                if (refMatch) {
                    const ref = refMatch[1];
                    let remaining = line.substring(ref.length).trim();

                    // Try to find a decimal number at the end (the total or price)
                    const priceMatch = remaining.match(/([\d\s\.,]+)$/);
                    const price = priceMatch ? parseFloat(priceMatch[1].replace(/[^\d\.]/g, '')) : 0;

                    result.lines.push({
                        raw: line,
                        reference: ref,
                        designation: remaining.replace(/[\d\s\.,]+$/, '').trim(),
                        qty: 1,
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

        console.log(`🔍 OCR Extracted ${result.lines.length} lines.`);
        return result;
    }
}
