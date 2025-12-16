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
        if (topGlassYpx !== undefined) {
            frameHeightMM = Math.abs(bottomGlassYpx - topGlassYpx) / pxPerMm;
        }

        // We return consistent referencing
        return {
            pd, pdLeft, pdRight, hpLeft, hpRight, shiftLeft, shiftRight, frameHeightMM,
            pxPerMm, pupils, frameGeom
        };
    }
}
