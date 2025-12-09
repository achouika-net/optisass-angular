// lensLogic.ts
import { lensDatabase, LensOption, LensTreatment } from "./lensDatabase";

export interface Correction { sph: number; cyl: number; add?: number; }

export type CerclageType = 'cerclée' | 'nylor' | 'percée';

export interface FrameData {
    ed: number; // Effective diameter / calibre
    shape: "round" | "rectangular" | "cat-eye";
    mount: "full-rim" | "semi-rim" | "rimless";
    cerclage?: CerclageType; // Type de cerclage (optional for backward compatibility)
}

export interface LensSuggestion {
    option: LensOption;
    rationale: string;
    estimatedThickness: number;
    selectedTreatments: LensTreatment[];
    warnings?: string[]; // Frame compatibility warnings
}

/**
 * Calculate edge thickness for a lens
 * Based on sphere, cylinder, frame calibre, and lens index
 */
export function calculateEdgeThickness(
    corr: Correction,
    calibre: number,
    index: number
): number {
    const sph = corr.sph;
    const cyl = Math.abs(corr.cyl);

    let edgeThickness = 0;

    if (sph <= 0) {
        // Myope: edge is thicker
        edgeThickness = Math.abs(sph) * (calibre / 50) * (1.0 - (index - 1.5) * 0.4);
    } else {
        // Hypermetrope: center is thicker
        edgeThickness = Math.abs(sph) * 0.5 * (1.0 - (index - 1.5) * 0.4);
    }

    // Add cylinder effect
    edgeThickness *= (1 + cyl * 0.12);

    // Minimum thickness
    edgeThickness = Math.max(0.8, Math.round(edgeThickness * 10) / 10);

    return edgeThickness;
}

/**
 * Get frame constraints based on cerclage type
 */
export function getFrameConstraints(cerclage?: CerclageType): { maxThickness: number; warning: string } {
    switch (cerclage) {
        case 'percée':
            return { maxThickness: 3.5, warning: 'Monture percée: épaisseur max 3.5mm recommandée' };
        case 'nylor':
            return { maxThickness: 4.5, warning: 'Monture nylor: attention au-delà de 4.5mm' };
        case 'cerclée':
        default:
            return { maxThickness: Infinity, warning: '' };
    }
}

export function getLensSuggestion(
    corr: Correction,
    frame: FrameData,
    selectedTreatments: LensTreatment[] = []
): LensSuggestion {
    const warnings: string[] = [];

    // 1. Calculate Effective Power (considering Addition for Near Vision)
    const sph = corr.sph;
    const cyl = corr.cyl;
    const add = corr.add || 0;

    const distancePower = Math.abs(sph) + Math.abs(cyl);
    const nearPower = Math.abs(sph + add) + Math.abs(cyl);

    const effectivePower = Math.max(distancePower, nearPower);
    const usedNearVision = nearPower > distancePower;

    // 2. Material Selection based on Effective Power
    let option: LensOption = lensDatabase[0];
    if (effectivePower <= 2) option = lensDatabase.find(l => l.material === "CR-39")!;
    else if (effectivePower <= 4) option = lensDatabase.find(l => l.material === "1.60")!;
    else if (effectivePower <= 6) option = lensDatabase.find(l => l.material === "1.67")!;
    else option = lensDatabase.find(l => l.material === "1.74")!; // Default fallback for high power

    // Fallback if specific option not found
    if (!option) option = lensDatabase.find(l => l.material === "1.74") || lensDatabase[lensDatabase.length - 1];

    // 3. Frame Adjustments & Cerclage Constraints
    const cerclage = frame.cerclage || (frame.mount === 'rimless' ? 'percée' : frame.mount === 'semi-rim' ? 'nylor' : 'cerclée');

    // Increase index for nylor/percée or small frames
    if (cerclage === 'nylor' || cerclage === 'percée' || frame.ed < 50) {
        if (option.index < 1.67) {
            const higherOption = lensDatabase.find(l => l.index >= 1.67);
            if (higherOption) option = higherOption;
        }
    }

    if (frame.mount === "semi-rim" && option.index < 1.6)
        option = lensDatabase.find(l => l.material === "Polycarbonate") || option;
    if (frame.mount === "rimless" && option.index < 1.67)
        option = lensDatabase.find(l => l.material === "1.67") || option;

    // 4. Thickness Estimation
    const baseThickness = 1.2;
    // Thinner index -> lower factor
    const indexFactor = option.index < 1.6 ? 0.8 : option.index < 1.67 ? 0.6 : 0.45;
    const edgeFactor = effectivePower * indexFactor;

    let frameFactor = 1;
    if (frame.ed > 55) frameFactor += 0.2;
    else if (frame.ed >= 50) frameFactor += 0.1;
    if (frame.shape === "rectangular") frameFactor += 0.1;
    if (frame.shape === "cat-eye") frameFactor += 0.15;
    if (frame.mount === "semi-rim") frameFactor -= 0.1;
    if (frame.mount === "rimless") frameFactor -= 0.2;

    const estimatedThickness = parseFloat((baseThickness + edgeFactor * frameFactor).toFixed(2));

    // 6. Construct Rationale
    let powerMsg = `Puissance (Sph+Cyl): ${distancePower.toFixed(2)}D`;
    if (usedNearVision) {
        powerMsg = `Vision de Près (Sph+Add): ${nearPower.toFixed(2)}D (Utilisé pour le choix)`;
    }

    const rationale = `
Conditions: ${powerMsg}
Monture: ED=${frame.ed}mm, ${cerclage}
Recommandation: ${option.material} (Indice ${option.index})
Épaisseur estimée: ~${estimatedThickness}mm
  `.trim();

    return { option, rationale, estimatedThickness, selectedTreatments, warnings: warnings.length > 0 ? warnings : undefined };
}

/**
 * Helper function to calculate lens price based on material, index, and treatments
 * Updated to correctly match "Organique 1.56" etc.
 */
export function calculateLensPrice(
    material: string,
    index: string,
    treatments: string[]
): number {
    if (!material || !index) return 0;

    // Parse index from string (e.g., "1.50 (Standard)" -> 1.50)
    // Extract first numeric part
    const indexMatch = index.toString().match(/(\d+(\.\d+)?)/);
    const indexNum = indexMatch ? parseFloat(indexMatch[0]) : 1.50;

    // Find matching lens option in DB
    const lensOption = lensDatabase.find(lens => {
        // 1. Check Index Match (allow small tolerance)
        if (Math.abs(lens.index - indexNum) > 0.01) return false;

        // 2. Check Material Type Hints
        const matLower = material.toLowerCase();
        const dbMatLower = lens.material.toLowerCase();

        // Specific mappings
        if (matLower.includes('cr-39')) return dbMatLower === 'cr-39';
        if (matLower.includes('poly')) return dbMatLower === 'polycarbonate';
        if (matLower.includes('trivex')) return dbMatLower === 'trivex';

        // For generic "Organique 1.xx", reliance on index check is usually sufficient if we ruled out the special ones
        // But let's be safe: if db is "1.60" and ui is "organique 1.60", it matches.
        if (matLower.includes(dbMatLower)) return true;

        return false;
    });

    // Default base price if not perfectly found
    let basePrice = 200;
    if (lensOption) {
        basePrice = (lensOption.priceRangeMAD[0] + lensOption.priceRangeMAD[1]) / 2;
    } else {
        // Heuristic fallback based on index if DB mismatch
        if (indexNum >= 1.74) basePrice = 900;
        else if (indexNum >= 1.67) basePrice = 600;
        else if (indexNum >= 1.60) basePrice = 400;
        else if (indexNum >= 1.56) basePrice = 300;
    }

    // Add treatment costs
    let treatmentCost = 0;
    if (treatments && treatments.length > 0) {
        treatments.forEach(treatment => {
            const t = treatment.toLowerCase();
            if (t.includes('anti-reflet') || t.includes('hmc')) treatmentCost += 100;
            else if (t.includes('shmc')) treatmentCost += 200;
            else if (t.includes('blue')) treatmentCost += 150;
            else if (t.includes('photo') || t.includes('transition')) treatmentCost += 400; // Expensive
            else if (t.includes('polar')) treatmentCost += 350;
            else if (t.includes('miroit')) treatmentCost += 200;
            else if (t.includes('solaire') || t.includes('teinté')) treatmentCost += 100;
            else if (t.includes('durci')) treatmentCost += 50;
            else if (t.includes('hydro')) treatmentCost += 100;
        });
    }

    return Math.round(basePrice + treatmentCost);
}
