import { Injectable } from '@angular/core';
import { FaceMesh, Results } from '@mediapipe/face_mesh';
import { Camera } from '@mediapipe/camera_utils';
import { Point, EngineResult, Pupils } from '../models/measurement.model';

@Injectable({
    providedIn: 'root'
})
export class MediaPipeEngineService {
    private faceMesh: FaceMesh | null = null;
    private camera: Camera | null = null;
    private onResultCallback?: (r: EngineResult) => void;

    constructor() { }

    async init(): Promise<void> {
        this.faceMesh = new FaceMesh({
            locateFile: (file: string) =>
                `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
        });

        this.faceMesh.setOptions({
            maxNumFaces: 1,
            refineLandmarks: true,
            minDetectionConfidence: 0.75, // Increased from 0.6
            minTrackingConfidence: 0.75   // Increased from 0.6
        });

        this.faceMesh.onResults((results: Results) => {
            const engineResult = this.resultsToEngineResult(results);
            if (this.onResultCallback) {
                this.onResultCallback(engineResult);
            }
        });
    }

    start(videoEl: HTMLVideoElement, onResult: (r: EngineResult) => void): void {
        this.onResultCallback = onResult;

        // Manual control preferred: If camera utility usage is desired, uncomment below.
        // For now, we allow the component to drive the loop using detectFrame.
        /*
        if (!this.faceMesh) throw new Error('MediaPipe engine not initialized.');
        this.camera = new Camera(videoEl, {
            onFrame: async () => {
                if (this.faceMesh) await this.faceMesh.send({ image: videoEl });
            },
            width: 1280,
            height: 720
        });
        this.camera.start();
        */
    }

    /**
     * Manual detection trigger
     */
    async detectFrame(videoEl: HTMLVideoElement, onResult?: (r: EngineResult) => void): Promise<void> {
        if (!this.faceMesh) return;
        if (onResult) this.onResultCallback = onResult;

        await this.faceMesh.send({ image: videoEl });
    }

    stop(): void {
        if (this.camera) {
            this.camera.stop();
            this.camera = null;
        }
        this.onResultCallback = undefined;
    }

    private resultsToEngineResult(results: Results): EngineResult {
        if (!results.multiFaceLandmarks || !results.multiFaceLandmarks.length) {
            return { confidence: 0, timestamp: Date.now() };
        }

        const lm = results.multiFaceLandmarks[0];
        const image = (results as any).image;
        const w = image?.width ?? 1280;
        const h = image?.height ?? 720;

        // Convert normalized coordinates to pixel coordinates
        const pts: Point[] = lm.map((p: any) => ({
            x: p.x * w,
            y: p.y * h,
            z: p.z,
            confidence: 1
        }));

        // High Accuracy Pupils: Average of iris contour points
        // Iris landmarks: 468 (center), 469 (top), 470 (right), 471 (bottom), 472 (left) for LEFT eye
        const leftIrisIdx = [468, 469, 470, 471, 472];
        const rightIrisIdx = [473, 474, 475, 476, 477];

        const leftIris = leftIrisIdx.map(i => pts[i]).filter(Boolean);
        const rightIris = rightIrisIdx.map(i => pts[i]).filter(Boolean);

        let pupils: Pupils;

        if (leftIris.length >= 3 && rightIris.length >= 3) {
            // Use average of iris points for a more stable center
            pupils = {
                left: this.averagePoints(leftIris),
                right: this.averagePoints(rightIris)
            };
        } else if (pts[468] && pts[473]) {
            // Fallback to single center point
            pupils = {
                left: pts[468],
                right: pts[473]
            };
        } else {
            // Extreme fallback to eye contour average
            const leftEyeIdx = [33, 160, 159, 158, 157, 173];
            const rightEyeIdx = [362, 385, 386, 387, 388, 263];
            const leftPts = leftEyeIdx.map(i => pts[i]).filter(Boolean);
            const rightPts = rightEyeIdx.map(i => pts[i]).filter(Boolean);
            pupils = {
                left: this.averagePoints(leftPts),
                right: this.averagePoints(rightPts)
            };
        }

        return {
            pupils,
            landmarks: pts,
            confidence: 0.8,
            timestamp: Date.now()
        };
    }

    private averagePoints(points: Point[]): Point {
        if (!points.length) {
            return { x: 0, y: 0, z: 0, confidence: 0 };
        }

        const sum = points.reduce((acc, p) => ({
            x: acc.x + p.x,
            y: acc.y + p.y,
            z: acc.z + (p.z ?? 0),
            confidence: acc.confidence + (p.confidence ?? 0)
        }), { x: 0, y: 0, z: 0, confidence: 0 });

        return {
            x: sum.x / points.length,
            y: sum.y / points.length,
            z: sum.z / points.length,
            confidence: sum.confidence / points.length
        };
    }
}
