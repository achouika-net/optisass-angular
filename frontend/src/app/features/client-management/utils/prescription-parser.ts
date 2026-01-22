export interface ParsedPrescription {
    OD: { sph: number; cyl: number; axis?: number; add?: number; prism?: number; base?: string };
    OG: { sph: number; cyl: number; axis?: number; add?: number; prism?: number; base?: string };
    EP: { val: number; od?: number; og?: number };
    date?: string;  // Date de prescription (format DD/MM/YYYY)
    prescripteur?: string;  // Nom du prescripteur
}

export function parsePrescription(text: string): ParsedPrescription {
    // Helper to parse numbers " + 2.50 " => 2.5
    const parseNum = (val: string | undefined): number => {
        if (!val) return 0;
        return parseFloat(val.replace(/\s+/g, '').replace(',', '.'));
    };

    const parseOptNum = (val: string | undefined): number | undefined => {
        if (!val) return undefined;
        return parseFloat(val.replace(/\s+/g, '').replace(',', '.'));
    };

    // 1. Clean up and Normalize
    // Standardize labels and shorthand
    const normalized = text.toUpperCase()
        .replace(/\bOEIL[:\s]+DR(?:OIT)?\b/gi, 'OD')
        .replace(/\bOEIL[:\s]+GA(?:UCHE)?\b/gi, 'OG')
        .replace(/\bVISION[:\s]+DE[:\s]+LOIN\b/gi, 'VDL')
        .replace(/\bVISION[:\s]+DE[:\s]+PRES\b/gi, 'VDP')
        .replace(/\s+/g, ' ');

    // 2. Fragment selection (Split by OD/OG to isolate data)
    // Use word boundaries \b to avoid matching "ORDONNANCE"
    const findSegment = (eye: string) => {
        const regex = new RegExp(`\\b${eye}\\b`, 'i');
        const match = normalized.match(regex);
        if (!match || match.index === undefined) return '';

        const start = match.index + match[0].length;
        const rest = normalized.substring(start);

        // Find next identifier to close the segment (OD, OG, or ADD)
        // Use a simpler regex without word boundaries for ADD
        const nextEye = rest.match(/\b(OD|OG)\b|\sADD\s/i);
        return nextEye ? rest.substring(0, nextEye.index) : rest.substring(0, 150);
    };

    const odText = findSegment('OD');
    const ogText = findSegment('OG');

    // 3. Extraction Helper (Keyword or Position-based)
    const extractFromSegment = (seg: string) => {
        if (!seg) return { sph: 0, cyl: 0 };

        // Match decimals or integers with optional signs
        const numbers = seg.match(/[+-]?\s*\d+[.,]?\d*/g);
        if (!numbers || numbers.length === 0) return { sph: 0, cyl: 0 };

        // Pre-filter/Clean numbers: remove spaces, fix comma
        const cleanNumbers = numbers
            .map(v => v.replace(/\s/g, '').replace(',', '.'))
            .filter(v => v.length > 0 && v !== '+' && v !== '-');

        if (cleanNumbers.length === 0) return { sph: 0, cyl: 0 };

        // SANITY CHECKS: 
        // 1. A sphere/cyl > 30 is likely a misread ID or date (e.g. 75010)
        // 2. We take the first 3 logical values (Sph, Cyl, Axe)
        const vals: number[] = [];
        for (const s of cleanNumbers) {
            const n = parseFloat(s);
            if (isNaN(n)) continue;
            // Filter out clearly corrupted data (very high numbers)
            if (Math.abs(n) > 30 && Math.abs(n) <= 180) {
                // Potential Axis? Let's keep it if it looks like one
                vals.push(n);
            } else if (Math.abs(n) <= 30) {
                vals.push(n);
            } else {
                console.warn(`[OCR] Filtered out aberrant value: ${n}`);
            }
        }

        const sph = vals[0] || 0;
        let cyl = 0;
        let axis = undefined;

        if (vals.length > 1) {
            // If the second value is very high, it might be an axis directly
            if (Math.abs(vals[1]) > 30 && Math.abs(vals[1]) <= 180) {
                axis = Math.round(vals[1]);
            } else {
                cyl = vals[1];
            }
        }

        if (vals.length > 2 && axis === undefined) {
            const v2 = Math.round(vals[2]);
            if (v2 >= 0 && v2 <= 180) axis = v2;
        }

        // Addition lookup (ADD keyword is robust)
        const addMatch = seg.match(/ADD[\s:]*([+-]?\d+[.,]?\d*)/);
        const add = addMatch ? parseOptNum(addMatch[1]) : undefined;

        return { sph, cyl, axis, add };
    };

    // EP Parser (Standalone)
    const regexEP = /(?:EP|PD|Ecart|E\.P|P\.D)[:\s]*(\d+(?:[.,]\d+)?)(?:\s*\/\s*(\d+(?:[.,]\d+)?))?/i;
    const epMatch = normalized.match(regexEP);

    // Global Addition lookup if not found in eye segments
    const regexGlobalADD = /ADD[\s:]*([+-]?\d+[.,]?\d*)/i;
    const globalAddMatch = normalized.match(regexGlobalADD);
    const globalAdd = globalAddMatch ? parseOptNum(globalAddMatch[1]) : undefined;

    const odRes = extractFromSegment(odText);
    const ogRes = extractFromSegment(ogText);

    // Extract date (format: DD.MM.YYYY or DD/MM/YYYY)
    const dateRegex = /(?:LE\s+)?(\d{1,2})[./](\d{1,2})[./](\d{4})/i;
    const dateMatch = text.match(dateRegex);
    let prescriptionDate: string | undefined;
    if (dateMatch) {
        const day = dateMatch[1].padStart(2, '0');
        const month = dateMatch[2].padStart(2, '0');
        const year = dateMatch[3];
        prescriptionDate = `${day}/${month}/${year}`;
    }

    // Extract prescriber (look for "Ophtalmologue" or doctor name before the date)
    const prescripteurRegex = /(?:VOTRE\s+)?(\w+(?:\s+\w+)?)\s+(?=\d+\s+RUE|LE\s+\d)/i;
    const prescripteurMatch = text.match(prescripteurRegex);
    const prescripteur = prescripteurMatch ? prescripteurMatch[1].trim() : undefined;

    return {
        OD: { ...odRes, add: odRes.add || globalAdd },
        OG: { ...ogRes, add: ogRes.add || globalAdd },
        EP: {
            val: epMatch ? (epMatch[2] ? parseFloat(epMatch[1].replace(',', '.')) + parseFloat(epMatch[2].replace(',', '.')) : parseNum(epMatch[1])) : 0,
            od: epMatch ? parseOptNum(epMatch[1]) : undefined,
            og: epMatch ? parseOptNum(epMatch[2]) : undefined
        },
        date: prescriptionDate,
        prescripteur: prescripteur
    };
}
