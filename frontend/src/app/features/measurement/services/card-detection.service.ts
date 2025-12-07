import { Injectable } from '@angular/core';

declare const cv: any;

@Injectable({
    providedIn: 'root'
})
export class CardDetectionService {
    private cvReady = false;
    private cvLoadPromise: Promise<void> | null = null;

    constructor() {
        this.loadOpenCV();
    }

    private loadOpenCV(): Promise<void> {
        if (this.cvLoadPromise) {
            return this.cvLoadPromise;
        }

        this.cvLoadPromise = new Promise((resolve, reject) => {
            // Check if already loaded
            if (typeof cv !== 'undefined' && cv.Mat) {
                this.cvReady = true;
                resolve();
                return;
            }

            // Load OpenCV.js from CDN
            const script = document.createElement('script');
            script.src = 'https://docs.opencv.org/4.8.0/opencv.js';
            script.async = true;

            script.onload = () => {
                // Wait for cv to be ready
                const checkCV = setInterval(() => {
                    if (typeof cv !== 'undefined' && cv.Mat) {
                        clearInterval(checkCV);
                        this.cvReady = true;
                        console.log('OpenCV.js loaded successfully');
                        resolve();
                    }
                }, 100);

                // Timeout after 10 seconds
                setTimeout(() => {
                    clearInterval(checkCV);
                    if (!this.cvReady) {
                        reject(new Error('OpenCV.js failed to load'));
                    }
                }, 10000);
            };

            script.onerror = () => {
                reject(new Error('Failed to load OpenCV.js script'));
            };

            document.head.appendChild(script);
        });

        return this.cvLoadPromise;
    }

    async detectCard(videoElement: HTMLVideoElement): Promise<{ width: number; height: number; x: number; y: number } | null> {
        if (!this.cvReady) {
            await this.loadOpenCV();
        }

        try {
            // Create canvas to capture video frame
            const canvas = document.createElement('canvas');
            canvas.width = videoElement.videoWidth;
            canvas.height = videoElement.videoHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) return null;

            ctx.drawImage(videoElement, 0, 0);

            // Convert to OpenCV Mat
            const src = cv.imread(canvas);
            const gray = new cv.Mat();
            const blurred = new cv.Mat();
            const edges = new cv.Mat();
            const hierarchy = new cv.Mat();
            const contours = new cv.MatVector();

            // Convert to grayscale
            cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

            // Blur to reduce noise
            cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);

            // Detect edges
            cv.Canny(blurred, edges, 50, 150);

            // Find contours
            cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

            // Find largest rectangular contour (likely the card)
            let maxArea = 0;
            let cardRect = null;

            for (let i = 0; i < contours.size(); i++) {
                const contour = contours.get(i);
                const area = cv.contourArea(contour);

                // Card should be reasonably large (at least 10000 pixels²)
                if (area > 10000) {
                    const peri = cv.arcLength(contour, true);
                    const approx = new cv.Mat();
                    cv.approxPolyDP(contour, approx, 0.02 * peri, true);

                    // Check if it's a rectangle (4 corners)
                    if (approx.rows === 4 && area > maxArea) {
                        const rect = cv.boundingRect(contour);
                        const aspectRatio = rect.width / rect.height;

                        // Credit card aspect ratio is approximately 1.586 (85.6mm x 53.98mm)
                        // Allow some tolerance: 1.4 to 1.8
                        if (aspectRatio >= 1.4 && aspectRatio <= 1.8) {
                            maxArea = area;
                            cardRect = rect;
                        }
                    }

                    approx.delete();
                }
            }

            // Cleanup
            src.delete();
            gray.delete();
            blurred.delete();
            edges.delete();
            hierarchy.delete();
            contours.delete();

            return cardRect;
        } catch (error) {
            console.error('Card detection error:', error);
            return null;
        }
    }

    isReady(): boolean {
        return this.cvReady;
    }
}
