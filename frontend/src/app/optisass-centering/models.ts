export interface Point { x: number; y: number; z?: number; }
export interface Pupils { left: Point; right: Point; }
export interface FrameGeometry {
    leftPx: number; rightPx: number; topPx?: number; bottomPx?: number;
    centerXpx?: number; widthPx?: number;
}
export interface SimpleMeasureResult {
    pd: number; // mm
    pdLeft: number;
    pdRight: number;
    hpLeft: number; // mm height pupille-bas verre
    hpRight: number;
    shiftLeft: number; // mm (pupille -> centre verre)
    shiftRight: number;
    usableDiameterLeft?: number; // Diamètre utile calculé
    usableDiameterRight?: number;
    standardDiameterLeft?: number; // Diamètre standard fournisseur
    standardDiameterRight?: number;
    frameHeightMM?: number; // Hauteur totale du verre (B)
    diagonal?: number; // Diagonale du rectangle englobant (A x B)
    lensWidthMM?: number; // Largeur A
    pxPerMm: number;
    pupils: Pupils;
    frameGeom: FrameGeometry;
}
