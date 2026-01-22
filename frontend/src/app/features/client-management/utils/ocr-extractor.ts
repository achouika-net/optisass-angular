import Tesseract from 'tesseract.js';

export async function extractTextFromImage(file: File | string): Promise<string> {
    // 1. Preprocess Image
    const processedImage = await preprocessImage(file);

    // 2. Run Tesseract with enhanced config
    const result = await Tesseract.recognize(processedImage, 'fra+eng', {
        logger: m => console.log(m),
        // tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz.,:()[]{}/°@+-= ', // Optional: restrict chars
        // tesseract parameters if needed
    });

    let text = result.data.text;

    console.log('=== TEXTE BRUT OCR ===');
    console.log(text);
    console.log('======================');

    // Basic cleanup for common OCR errors
    text = text.replace(/O\.?D\.?/gi, 'OD')   // Fix O.D. / 0.D
        .replace(/O\.?G\.?/gi, 'OG')   // Fix O.G. / 0.G
        .replace(/0D/gi, 'OD')         // Fix 0D
        .replace(/0G/gi, 'OG')         // Fix 0G
        .replace(/\|/g, 'I')           // Fix pipe treated as I
        .replace(/\n/g, ' ');          // Flatten to single line for easier regex

    // Advanced Normalization for medical shorthand
    text = text.toUpperCase()
        // Fix common OCR misreads for "Oeil Droit/Gauche"
        .replace(/OCIF[:\s]+DYOIT/gi, 'OD')      // "Ocif Dyoit" → "OD"
        .replace(/OEIL[:\s]+DYOIT/gi, 'OD')      // "Oeil Dyoit" → "OD"
        .replace(/OEIL[:\s]+DR(?:OIT)?/gi, 'OD')
        .replace(/OEIL[:\s]+GA(?:UCHE)?/gi, 'OG')
        .replace(/VISION[:\s]+DE[:\s]+LOIN/gi, 'VDL')
        .replace(/VISION[:\s]+DE[:\s]+PRES/gi, 'VDP')
        .replace(/(?:ECART|E\.?P\.?|P\.?D\.?)[:\s]+PUPILLAIRE/gi, 'EP')
        .replace(/EEN[:\s]+PUPILDAIRE/gi, 'EP')  // "Een pupildaire" → "EP"
        // Fix cylinder notation: "G0,75)" → "(-0,75)"
        .replace(/G(\d)/g, '(-$1')               // "G0" → "(-0"
        // Fix punctuation
        .replace(/!/g, ':')                      // "ADD !" → "ADD :"
        // Strip labels IN PARENTHESES ONLY (preserve standalone keywords like ADD)
        .replace(/\(SPH\)/gi, '')
        .replace(/\(CYL\)/gi, '')
        .replace(/\(AXE\)/gi, '')
        .replace(/\(ADD\)/gi, '')
        // Remove standalone label words ONLY when followed by colon (not ADD which needs to stay)
        .replace(/\bSPH\s*:/gi, '')
        .replace(/\bCYL\s*:/gi, '')
        .replace(/\bAXE\s*:/gi, '')
        .replace(/\s+/g, ' ');

    console.log('=== TEXTE NORMALISÉ ===');
    console.log(text);
    console.log('=======================');

    return text;
}

// Helper: Preprocess Image for OCR (Grayscale, Contrast, Binarize)
async function preprocessImage(file: File | string): Promise<string> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                resolve(img.src); // Fallback to original
                return;
            }

            // Scale up for better OCR (aim for high DPI logic approx)
            // If image is small (< 1000px width), double it.
            const scale = img.width < 1000 ? 2 : 1;
            canvas.width = img.width * scale;
            canvas.height = img.height * scale;

            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            // Get Image Data
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;

            // Apply Filters: Grayscale & Contrast
            // Simple thresholding
            // Apply Filters: Grayscale & Tighter Binarization
            for (let i = 0; i < data.length; i += 4) {
                // Grayscale
                const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;

                // Tighter Threshold for medical documents (often thin ink)
                // A value around 160-180 helps separate characters better on light backgrounds
                const threshold = 170;
                const color = avg > threshold ? 255 : 0;

                data[i] = color;     // R
                data[i + 1] = color; // G
                data[i + 2] = color; // B
            }

            ctx.putImageData(imageData, 0, 0);
            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = reject;

        if (file instanceof File) {
            const reader = new FileReader();
            reader.onload = (e) => (img.src = e.target?.result as string);
            reader.readAsDataURL(file);
        } else {
            img.src = file;
        }
    });
}

/**
 * Parse prescription text to extract values
 * Reworked to share logic with manual paste if needed, but keeping this simple for now.
 */
export function parsePrescriptionText(text: string): {
    od?: { sphere?: string; cylinder?: string; axis?: string; addition?: string; rayon?: string; diametre?: string };
    og?: { sphere?: string; cylinder?: string; axis?: string; addition?: string; rayon?: string; diametre?: string };
    ep?: string;
} {
    const result: any = { od: {}, og: {} };

    // Use text as provided (should be pre-normalized by extractTextFromImage)
    const normalized = text.toUpperCase();

    // --- REFINED REGEX PATTERNS ---
    // Matches: OD +1.50 (-0.75) 100 or OD -2.00 or OD: +1.25 (SPH) -0.50 (CYL)
    // We handle optional labels and varied separators
    const numPattern = '([+-]?\\d+[.,]?\\d*)';
    const optLabels = '(?:SPH|CYL|AXE|[:\\s])*';

    // Better eye regex: Find OD/OG then look for numbers skipping common text
    const eyeRegex = /(OD|OG)[\s:]+(?:SPH[\s:]*)?([+-]?\d+[.,]?\d*)[\s:]*(?:CYL[\s:]*)?\(?([+-]?\d+[.,]?\d*)?\)?[\s:]*(?:AXE[\s:]*)?(\d+)?/gi;

    let match;
    while ((match = eyeRegex.exec(normalized)) !== null) {
        const eye = match[1].toUpperCase() === 'OD' ? 'od' : 'og';
        if (match[2]) result[eye].sphere = match[2].replace(',', '.');
        if (match[3]) result[eye].cylinder = match[3].replace(',', '.');
        if (match[4]) result[eye].axis = match[4];
    }

    // Look for Addition (Common)
    // Matches: ADD: 1.50 or ADDITION 1.50
    const addMatch = normalized.match(/(?:ADD|ADDITION)[:\s]+([+-]?\d+[.,]?\d*)/i);
    if (addMatch) {
        const addition = addMatch[1].replace(',', '.');
        if (result.od && !result.od.addition) result.od.addition = addition;
        if (result.og && !result.og.addition) result.og.addition = addition;
    }

    // Look for EP (Ecart Pupillaire)
    // Matches: EP: 62 or EP 31/31 or EP 62 mm
    const epMatch = normalized.match(/(?:EP|ECART)[:\s]+(\d+[.,]?\d*)(?:\s*\/\s*(\d+[.,]?\d*))?/i);
    if (epMatch) {
        if (epMatch[2]) {
            // Split EP (e.g. 31/31)
            result.ep = (parseFloat(epMatch[1].replace(',', '.')) + parseFloat(epMatch[2].replace(',', '.'))).toString();
        } else {
            result.ep = epMatch[1].replace(',', '.');
        }
    }

    // --- Contact Lens Parameters (BC/DIA) ---
    const bcMatch = normalized.match(/(?:BC|RAYON|R|K)[:\s]+(\d+[.,]?\d*)/i);
    if (bcMatch) {
        const rayon = bcMatch[1].replace(',', '.');
        if (result.od) result.od.rayon = rayon;
        if (result.og) result.og.rayon = rayon;
    }

    const diaMatch = normalized.match(/(?:DIA|DIAM|Ø)[:\s]+(\d+[.,]?\d*)/i);
    if (diaMatch) {
        const diametre = diaMatch[1].replace(',', '.');
        if (result.od) result.od.diametre = diametre;
        if (result.og) result.og.diametre = diametre;
    }

    return result;
}
