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
    frameHeightMM?: number; // Hauteur totale du verre (B)
    pxPerMm: number;
    pupils: Pupils;
    frameGeom: FrameGeometry;
}
