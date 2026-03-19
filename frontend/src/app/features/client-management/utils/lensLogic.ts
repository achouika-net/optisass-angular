import { lensDatabase, LensOption, LensTreatment } from "./lensDatabase";
import { GlassParameters, GlassMaterial, GlassIndex, GlassTreatment } from "../../../core/models/glass-parameters.model";

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

/**
 * Determine lens type based on equipment type and addition
 * Implements intelligent type selection logic
 */
export function determineLensType(equipmentType: string, addition: number): string {
    const add = addition || 0;

    // Vision de loin: always unifocal
    if (equipmentType === 'Vision de loin') {
        return 'Unifocal';
    }

    // Vision de près: depends on addition
    if (equipmentType === 'Vision de près') {
        if (add === 0) return 'Unifocal';
        // With addition, recommend progressive
        if (add <= 1.0) return 'Progressif'; // Entry level
        if (add <= 2.0) return 'Progressif'; // Standard
        return 'Progressif'; // Premium (>2.0)
    }

    // Progressifs: always progressive
    if (equipmentType === 'Progressifs') {
        return 'Progressif';
    }

    // Vision intermédiaire
    if (equipmentType === 'Vision intermédiaire') {
        return 'Mi-distance';
    }

    // Monture générique ou autres: unifocal par défaut
    return 'Unifocal';
}

export function getLensSuggestion(
    corr: Correction,
    frame: FrameData,
    params?: GlassParameters,
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
    // Use dynamic params if available, otherwise fallback to local database
    const db = params ? params.materials.map(m => ({
        material: m.name,
        index: Math.max(...m.indices.map(i => i.value)) // Use max index for suggesting material
    })) : lensDatabase;

    let option: LensOption = db[0] as LensOption;
    
    // Logic to select "best" material based on power
    if (effectivePower <= 2) {
        option = (db.find(l => l.index >= 1.5 && l.index < 1.55) || db[0]) as LensOption;
    } else if (effectivePower <= 4) {
        option = (db.find(l => l.index >= 1.56 && l.index < 1.6) || db[0]) as LensOption;
    } else if (effectivePower <= 6) {
        option = (db.find(l => l.index >= 1.6 && l.index < 1.7) || db[0]) as LensOption;
    } else {
        option = (db.find(l => l.index >= 1.7) || db[db.length - 1]) as LensOption;
    }

    // Fallback if specific option not found
    if (!option) option = (db[db.length - 1] || lensDatabase[lensDatabase.length - 1]) as LensOption;

    // 3. Frame Adjustments & Cerclage Constraints
    const cerclage = frame.cerclage || (frame.mount === 'rimless' ? 'percée' : frame.mount === 'semi-rim' ? 'nylor' : 'cerclée');

    // Increase index for nylor/percée or small frames
    if (cerclage === 'nylor' || cerclage === 'percée' || frame.ed < 50) {
        if (option.index < 1.67) {
            const higherOption = db.find(l => l.index >= 1.67);
            if (higherOption) option = higherOption as LensOption;
        }
    }

    if (frame.mount === "semi-rim" && option.index < 1.6)
        option = lensDatabase.find(l => l.material === "Polycarbonate") || option;
    if (frame.mount === "rimless" && option.index < 1.67)
        option = lensDatabase.find(l => l.material === "1.67") || option;

    // 4. Calculate Edge Thickness using new function
    const estimatedThickness = calculateEdgeThickness(corr, frame.ed, option.index);

    // 5. Check Frame Constraints
    const constraints = getFrameConstraints(cerclage);
    if (estimatedThickness > constraints.maxThickness) {
        warnings.push(`⚠️ ${constraints.warning} - Épaisseur estimée: ${estimatedThickness}mm`);
        if (cerclage === 'percée') {
            warnings.push('Recommandation: Choisir un indice supérieur ou une autre monture');
        }
    }

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
 * Updated to use dynamic parameters if provided.
 */
export function calculateLensPrice(
    material: string,
    index: string,
    treatments: string[],
    params?: GlassParameters
): number {
    if (!material || !index) return 0;

    // Parse index from string (e.g., "1.50 (Standard)" -> 1.50)
    // Extract first numeric part
    const indexMatch = index.toString().match(/(\d+(\.\d+)?)/);
    const indexNum = indexMatch ? parseFloat(indexMatch[0]) : 1.50;

    let basePrice = 0;
    let treatmentCost = 0;

    if (params) {
        // --- 1. DYNAMIC CALCULATION ---
        
        // Find material
        const mat = params.materials.find((m: GlassMaterial) => 
            material.toLowerCase().includes(m.name.toLowerCase()) || 
            m.name.toLowerCase().includes(material.toLowerCase())
        );

        if (mat) {
            // Find index value
            const idxObj = mat.indices.find((i: GlassIndex) => Math.abs(i.value - indexNum) < 0.01);
            if (idxObj) {
                basePrice = idxObj.price;
            }
        }

        // If not found in materials, try searching all indices directly (fallback)
        if (basePrice === 0) {
            for (const m of params.materials) {
                const idxObj = m.indices.find((i: GlassIndex) => Math.abs(i.value - indexNum) < 0.01);
                if (idxObj) {
                    basePrice = idxObj.price;
                    break;
                }
            }
        }

        // Treatments
        if (treatments && Array.isArray(treatments)) {
            treatments.forEach(tName => {
                const treat = params.treatments.find((t: GlassTreatment) => 
                    tName.toLowerCase().includes(t.name.toLowerCase()) || 
                    t.name.toLowerCase().includes(tName.toLowerCase())
                );
                if (treat) {
                    treatmentCost += treat.price;
                }
            });
        }
    }

    // --- 2. HARDCODED FALLBACK (if params not provided or dynamic lookup failed) ---
    if (basePrice === 0) {
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
            if (matLower.includes(dbMatLower)) return true;

            return false;
        });

        // Default base price if not perfectly found
        if (lensOption) {
            basePrice = (lensOption.priceRangeMAD[0] + lensOption.priceRangeMAD[1]) / 2;
        } else {
            // Heuristic fallback based on index if DB mismatch
            if (indexNum >= 1.74) basePrice = 900;
            else if (indexNum >= 1.67) basePrice = 600;
            else if (indexNum >= 1.60) basePrice = 400;
            else if (indexNum >= 1.56) basePrice = 300;
            else basePrice = 200;
        }
    }

    // Add treatment costs if not already calculated dynamically
    if (treatmentCost === 0 && treatments && treatments.length > 0) {
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
