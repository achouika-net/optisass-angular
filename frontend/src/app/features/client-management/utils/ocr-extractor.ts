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

    // Basic cleanup for common OCR errors
    text = text.replace(/O\.?D\.?/gi, 'OD')   // Fix O.D. / 0.D
        .replace(/O\.?G\.?/gi, 'OG')   // Fix O.G. / 0.G
        .replace(/0D/gi, 'OD')         // Fix 0D
        .replace(/0G/gi, 'OG')         // Fix 0G
        .replace(/\|/g, 'I')           // Fix pipe treated as I
        .replace(/\n/g, ' ');          // Flatten to single line for easier regex

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
            for (let i = 0; i < data.length; i += 4) {
                // Grayscale
                const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;

                // Binarize (Threshold) - hard cutoff at 128 often works for text
                // Adjust threshold or add contrast logic if needed. 
                // A slightly higher contrast logic:
                const threshold = 140;
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

    // Normalize text
    const normalized = text.toUpperCase().replace(/\s+/g, ' ');

    // Look for OD (Oeil Droit / Right Eye) values
    const odMatch = normalized.match(/OD[:\s]+([+-]?\d+[.,]?\d*)\s*([+-]?\d+[.,]?\d*)?\s*(\d+)?/);
    if (odMatch) {
        result.od.sphere = odMatch[1]?.replace(',', '.');
        if (odMatch[2]) result.od.cylinder = odMatch[2].replace(',', '.');
        if (odMatch[3]) result.od.axis = odMatch[3];
    }

    // Look for OG (Oeil Gauche / Left Eye) values
    const ogMatch = normalized.match(/OG[:\s]+([+-]?\d+[.,]?\d*)\s*([+-]?\d+[.,]?\d*)?\s*(\d+)?/);
    if (ogMatch) {
        result.og.sphere = ogMatch[1]?.replace(',', '.');
        if (ogMatch[2]) result.og.cylinder = ogMatch[2].replace(',', '.');
        if (ogMatch[3]) result.og.axis = ogMatch[3];
    }

    // Look for Addition (Common)
    const addMatch = normalized.match(/ADD[:\s]+([+-]?\d+[.,]?\d*)/);
    if (addMatch) {
        const addition = addMatch[1].replace(',', '.');
        result.od.addition = addition;
        result.og.addition = addition;
    }

    // Look for EP
    const epMatch = normalized.match(/EP[:\s]+(\d+[.,]?\d*)/);
    if (epMatch) {
        result.ep = epMatch[1].replace(',', '.');
    }

    // --- Contact Lens Parameters ---

    // BC / Rayon (Search for BC or Rayon or K patterns)
    // Matches: BC 8.6, r:8.4, 8.60 mm
    const bcMatch = normalized.match(/(?:BC|RAYON|R|K)[:\s]+(\d+[.,]?\d*)/);
    if (bcMatch) {
        const rayon = bcMatch[1].replace(',', '.');
        result.od.rayon = rayon;
        result.og.rayon = rayon; // Assuming symmetric unless specified otherwise
    }

    // DIA / Diameter
    // Matches: DIA 14.0, Ø 14.2, Diam 14.0
    const diaMatch = normalized.match(/(?:DIA|DIAM|Ø)[:\s]+(\d+[.,]?\d*)/);
    if (diaMatch) {
        const diametre = diaMatch[1].replace(',', '.');
        result.od.diametre = diametre;
        result.og.diametre = diametre;
    }

    return result;
}
