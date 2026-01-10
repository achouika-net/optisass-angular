import { Injectable } from '@angular/core';
import { Pupils, FrameGeometry, SimpleMeasureResult } from '../models';

@Injectable({ providedIn: 'root' })
export class GeometryService {

    /**
     * Compute ratio px->mm using frame real width (mm) and detected pixel extents
     * frameWidthMM: largeur réelle fournie (par fiche monture)
     * frameGeom.widthPx: largeur détectée en px (leftPx->rightPx)
     */
    computePxPerMm(frameWidthMM: number, frameGeom: FrameGeometry): number {
        const widthPx = frameGeom.widthPx ?? Math.abs(frameGeom.rightPx - frameGeom.leftPx);
        if (!widthPx || widthPx <= 0) return 1;
        return widthPx / frameWidthMM;
    }

    computeMeasures(pupils: Pupils, frameGeom: FrameGeometry, frameWidthMM: number, bottomGlassYpx: number, glassLeftCenterXpx: number, glassRightCenterXpx: number, topGlassYpx?: number): SimpleMeasureResult {
        const pxPerMm = this.computePxPerMm(frameWidthMM, frameGeom);

        // Total PD (inter-pupillary distance)
        const dx = pupils.right.x - pupils.left.x;
        const pd = Math.abs(dx) / pxPerMm;

        // Center of the frame (bridge center)
        // If centerXpx is not explicitly provided in geometry, estimate it from left/right
        const centerX = frameGeom.centerXpx ?? ((frameGeom.leftPx + frameGeom.rightPx) / 2);

        // PD per eye (distance from pupil to center)
        // Note: 'left' pupil is usually at smaller x than 'right' pupil in image coordinates? 
        // Wait, in image coords (0,0 is top-left):
        // Right Eye of person (on left of image) -> x is small
        // Left Eye of person (on right of image) -> x is large
        // BUT! MediaPipe 'left' usually refers to the person's left eye (which is on the right side of the image if not mirrored).
        // Let's assume standard image: Person's Right Eye is on Image Left (small X). Person's Left Eye is on Image Right (large X).
        // So pupils.right (Person Right) .x < pupils.left (Person Left) .x.
        // Let's re-verify MediaPipe indices. 
        // 33 (left eye inner corner) is on the person's left eye? No.
        // MediaPipe defines left/right relative to the PERSON.
        // So 'left eye' keypoints are for the person's left eye.
        // Start of the day, simpler to check X coords.

        const p1 = pupils.left;
        const p2 = pupils.right;
        const realLeftPupil = p1.x > p2.x ? p1 : p2; // Person Left Eye (Image Right)
        const realRightPupil = p1.x > p2.x ? p2 : p1; // Person Right Eye (Image Left)

        const pdRight = Math.abs(realRightPupil.x - centerX) / pxPerMm; // Person Right PD
        const pdLeft = Math.abs(realLeftPupil.x - centerX) / pxPerMm;   // Person Left PD

        const hpRight = Math.abs(bottomGlassYpx - realRightPupil.y) / pxPerMm;
        const hpLeft = Math.abs(bottomGlassYpx - realLeftPupil.y) / pxPerMm;

        const shiftRight = (realRightPupil.x - glassRightCenterXpx) / pxPerMm;
        const shiftLeft = (realLeftPupil.x - glassLeftCenterXpx) / pxPerMm;

        let frameHeightMM: number | undefined;
        let diagonal: number | undefined;
        let lensWidthMM: number | undefined;

        if (topGlassYpx !== undefined) {
            frameHeightMM = Math.abs(bottomGlassYpx - topGlassYpx) / pxPerMm;

            // Calculate A (Lens Width)
            // A = (Total Frame Width - Bridge) / 2 ... wait, we don't have bridge specifically here.
            // But we have centerX and outerX.
            // Lens Width L = |outerX_L - centerX_L| ... no, usually outer to inner edge.
            // Let's use the detected frame geom width for one eye if possible.
            // For now, let's estimate lens width from bridge center to outer edge, minus half-bridge if we knew it.
            // Safer: Lens Width A = Detected Width of one lens.
            // frameGeom.widthPx is total. Let's assume lensWidthPx is roughly (totalWidth - bridge)/2.
            // If bridge is ~18mm (default in many places), we'll assume a standard bridge of 18mm for this estimate if not provided.
            const estimatedBridgeMm = 18;
            lensWidthMM = (frameWidthMM - estimatedBridgeMm) / 2;

            // Box Diagonal = sqrt(A^2 + B^2)
            diagonal = Math.sqrt(lensWidthMM * lensWidthMM + frameHeightMM * frameHeightMM);
        }

        // Calculate Usable Diameters (Diametre Utile)
        // For each eye, it's roughly 2 * max distance from pupil to any corner of the lens box
        const dLeft = this.calculateUsableDiameter(realLeftPupil, frameGeom.rightPx, centerX, topGlassYpx || 0, bottomGlassYpx);
        const dRight = this.calculateUsableDiameter(realRightPupil, frameGeom.leftPx, centerX, topGlassYpx || 0, bottomGlassYpx);

        const usableDiameterLeft = dLeft / pxPerMm;
        const usableDiameterRight = dRight / pxPerMm;

        // Apply +2mm safety margin before rounding to standard supplier sizes
        const standardDiameterLeft = this.getStandardDiameter(usableDiameterLeft + 2);
        const standardDiameterRight = this.getStandardDiameter(usableDiameterRight + 2);

        // We return consistent referencing
        return {
            pd, pdLeft, pdRight, hpLeft, hpRight, shiftLeft, shiftRight, frameHeightMM,
            diagonal, lensWidthMM,
            usableDiameterLeft, usableDiameterRight,
            standardDiameterLeft, standardDiameterRight,
            pxPerMm, pupils, frameGeom
        };
    }

    /**
     * Calculates usable diameter (pixels) for a single lens
     * Simply 2 * max distance from pupil to corners
     * Lens Box defined by [outerX, innerX] x [topY, bottomY]
     */
    private calculateUsableDiameter(pupil: { x: number, y: number }, outerX: number, innerX: number, topY: number, bottomY: number): number {
        const corners = [
            { x: outerX, y: topY },
            { x: innerX, y: topY },
            { x: outerX, y: bottomY },
            { x: innerX, y: bottomY }
        ];

        let maxDistSq = 0;
        for (const c of corners) {
            const dx = c.x - pupil.x;
            const dy = c.y - pupil.y;
            const distSq = dx * dx + dy * dy;
            if (distSq > maxDistSq) maxDistSq = distSq;
        }

        return 2 * Math.sqrt(maxDistSq);
    }

    /**
     * Map calculated diameter to nearest UPPER standard supplier diameter
     * List: 55, 60, 65, 70, 75, 80, 85
     */
    private getStandardDiameter(calcDiameter: number): number {
        const standards = [55, 60, 65, 70, 75, 80, 85];
        // Find first standard >= calculated
        // If calculated > 85, cap at 85 or return calculated? 
        // User request implies selection from list. Let's return 85 or custom if huge.
        // Assuming we always want one from list if possible.

        for (const s of standards) {
            if (s >= calcDiameter) return s;
        }
        return 85; // Max standard or fallback
    }
}
