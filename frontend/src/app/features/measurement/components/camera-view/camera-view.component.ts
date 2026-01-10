import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef, Output, EventEmitter, Input, ChangeDetectorRef, ChangeDetectionStrategy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MediaPipeEngineService } from '../../services/mediapipe-engine.service';
import { CalibrationService } from '../../services/calibration.service';
import { ExpSmoother } from '../../utils/smoothing.util';
import { Measurement, Point } from '../../models/measurement.model';

@Component({
    selector: 'app-camera-view',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './camera-view.component.html',
    styleUrls: ['./camera-view.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class CameraViewComponent implements OnInit, AfterViewInit, OnDestroy {
    @ViewChild('videoElement') videoElement!: ElementRef<HTMLVideoElement>;
    @ViewChild('overlayCanvas') overlayCanvas!: ElementRef<HTMLCanvasElement>;

    @Output() measurementChange = new EventEmitter<Measurement>();

    // Debug logging
    debugLog: string[] = [];
    private addDebugLog(msg: string): void {
        const time = new Date().toLocaleTimeString();
        this.debugLog.unshift(`[${time}] ${msg}`);
        if (this.debugLog.length > 10) this.debugLog.pop();
        this.cdr.markForCheck();
        console.log(msg);
    }

    // Frame data inputs for automatic width calculation
    @Input() caliber: number = 52; // Lens width in mm
    @Input() bridge: number = 18; // Bridge width in mm
    @Input() mountingType: string = ''; // Type de montage

    frameWidthMm: number = 140; // Will be calculated automatically
    pixelsPerMm: number | null = null;
    isCalibrated = false;
    isReady = false;
    latestMeasurement: Measurement | null = null;

    // Face landmarks for calibration
    faceWidth: number = 0; // Face width in pixels
    currentLandmarks: Point[] = [];

    // Height Measurement (Bottom of frame lines)
    frameBottomLeftY: number = 0;
    frameBottomRightY: number = 0;
    isDraggingLeft = false;
    isDraggingRight = false;

    // Frame Height (Red Lines)
    frameTopY: number = 0;
    frameBottomY: number = 0;
    isDraggingFrameTop = false;
    isDraggingFrameBottom = false;

    // Manual Pupil Adjustment
    isDraggingPupilLeft = false;
    isDraggingPupilRight = false;

    // Diagonal Measurement Tool
    diagonalP1: Point = { x: 0, y: 0 };
    diagonalP2: Point = { x: 0, y: 0 };
    isDraggingDiagP1 = false;
    isDraggingDiagP2 = false;

    // Frame Calibration (Adjustable Vertical Lines)
    frameLeftOffset: number = 0;
    frameRightOffset: number = 0;
    isDraggingFrameLeft: boolean = false;
    isDraggingFrameRight: boolean = false;
    hasManualFrameAdjustment: boolean = false;

    // Capture / Static Mode
    isCaptured: boolean = false;
    capturedImage: HTMLImageElement | null = null;
    capturedPupils: { left: Point; right: Point } | null = null;
    capturedLandmarks: Point[] = [];
    private captureFrameRequest?: number;

    private smootherLeft = new ExpSmoother(0.5); // Increased from 0.35
    private smootherRight = new ExpSmoother(0.5); // Increased from 0.35

    constructor(
        private mpEngine: MediaPipeEngineService,
        private calibrationService: CalibrationService,
        private cdr: ChangeDetectorRef
    ) { }

    async ngOnInit(): Promise<void> {
        this.addDebugLog('ngOnInit started');
        // Calculate frame width automatically based on inputs
        let frameAdjustment = 0;
        if (this.mountingType.includes('Percé') || this.mountingType.includes('Nylor')) {
            frameAdjustment = 0; // 0mm for rimless/drilled
        } else {
            frameAdjustment = 5; // +5mm for framed (Cerclé, Demi-Cerclé, Complet)
        }
        this.frameWidthMm = (this.caliber * 2) + this.bridge + frameAdjustment;

        // Load saved calibration
        const savedCalibration = this.calibrationService.loadCalibration();
        if (savedCalibration && this.calibrationService.isCalibrationValid()) {
            this.pixelsPerMm = savedCalibration.pixelsPerMm;
            this.isCalibrated = true;
            this.addDebugLog('Calibration loaded');
        }

        // Initialize MediaPipe engine
        try {
            this.addDebugLog('Initializing MediaPipe...');
            await this.mpEngine.init();
            this.isReady = true;
            this.addDebugLog('MediaPipe Ready');
            this.cdr.markForCheck();
        } catch (error) {
            console.error('Failed to initialize MediaPipe:', error);
            this.addDebugLog('MediaPipe Init Error: ' + error);
            this.cameraError = 'Erreur d\'initialisation du système de détection (MediaPipe). Vérifiez votre connexion internet.';
            this.cdr.markForCheck();
        }
    }

    // [Mouse Events omitted for brevity, they are unchanged]

    async ngAfterViewInit(): Promise<void> {
        console.log('CameraView ngAfterViewInit called');
        this.addDebugLog('ngAfterViewInit called');

        // Check straight away if we have an error from init
        if (this.cameraError) return;

        // Wait for MediaPipe to be ready if not already
        if (!this.isReady) {
            console.log('Waiting for MediaPipe to initialize...');
            this.addDebugLog('Waiting for MediaPipe...');
            for (let i = 0; i < 50; i++) {
                if (this.isReady) break;
                if (this.cameraError) return; // Stop if error occurred during wait
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        if (this.isReady && this.videoElement) {
            console.log('Starting camera...');
            this.addDebugLog('Starting camera sequence...');
            setTimeout(() => {
                this.startCamera();
            }, 500);
        } else {
            console.error('MediaPipe not ready or video element not found');
            this.addDebugLog('FAIL: MP not ready or No Video Element');
            if (!this.isReady) {
                this.cameraError = 'Le système de détection ne répond pas (Timeout). Vérifiez votre connexion.';
            } else {
                this.cameraError = 'Erreur interne: Élément vidéo introuvable.';
            }
            this.cdr.markForCheck();
        }
    }

    // Mouse/Touch events for dragging height lines (Moved down to preserve flow in file if needed, but here just replacing the init logic + afterViewInit)
    // Actually, I need to be careful not to delete the onMouseDown/Move methods which are between ngOnInit and ngAfterViewInit in the original file.
    // The previous tool call showed them between lines 110 and 278.
    // I should only target ngOnInit and ngAfterViewInit individually or carefuly.
    // Let's split this into two calls or target the specific blocks.

    // Changing Strategy: Target ngAfterViewInit specifically.
    // And ngOnInit separately.


    // Mouse/Touch events for dragging height lines
    onMouseDown(event: MouseEvent): void {
        const rect = this.overlayCanvas.nativeElement.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        const scaleX = this.overlayCanvas.nativeElement.width / rect.width;
        const scaleY = this.overlayCanvas.nativeElement.height / rect.height;

        const canvasX = x * scaleX;
        const canvasY = y * scaleY;

        const PROXIMITY_THRESHOLD = 20;

        // Use Captured landmarks if frozen, otherwise live landmarks
        const sourceLandmarks = this.isCaptured ? this.capturedLandmarks : this.currentLandmarks;

        // 1. Check Frame Vertical Lines (X-axis)
        // Need current landmark positions to check proximity
        if (sourceLandmarks && sourceLandmarks.length > 454) {
            const leftTempleX = sourceLandmarks[234].x + this.frameLeftOffset;
            const rightTempleX = sourceLandmarks[454].x + this.frameRightOffset;

            if (Math.abs(canvasX - leftTempleX) < PROXIMITY_THRESHOLD) {
                this.isDraggingFrameLeft = true;
                this.hasManualFrameAdjustment = true;
                return;
            } else if (Math.abs(canvasX - rightTempleX) < PROXIMITY_THRESHOLD) {
                this.isDraggingFrameRight = true;
                this.hasManualFrameAdjustment = true;
                return;
            }
        }

        // 2. Check Frame Top/Bottom Red Lines (Y-axis) - ONLY IF CAPTURED
        if (this.isCaptured) {
            if (this.frameTopY && Math.abs(canvasY - this.frameTopY) < PROXIMITY_THRESHOLD) {
                this.isDraggingFrameTop = true;
                return;
            }
            if (this.frameBottomY && Math.abs(canvasY - this.frameBottomY) < PROXIMITY_THRESHOLD) {
                this.isDraggingFrameBottom = true;
                return;
            }
        }

        // 3. Check Pupils (Prioritize this if Captured for manual correction)
        if (this.isCaptured && this.capturedPupils) {
            const pupils = this.capturedPupils;
            const PUPIL_THRESHOLD = 15; // Closer threshold for small points

            if (Math.hypot(canvasX - pupils.left.x, canvasY - pupils.left.y) < PUPIL_THRESHOLD) {
                this.isDraggingPupilLeft = true;
                return;
            }
            if (Math.hypot(canvasX - pupils.right.x, canvasY - pupils.right.y) < PUPIL_THRESHOLD) {
                this.isDraggingPupilRight = true;
                return;
            }
        }

        // 4. Check Height Horizontal Lines (Y-axis) (Blue lines for pupil height)
        if (Math.abs(canvasY - this.frameBottomLeftY) < PROXIMITY_THRESHOLD) {
            this.isDraggingLeft = true;
        } else if (Math.abs(canvasY - this.frameBottomRightY) < PROXIMITY_THRESHOLD) {
            this.isDraggingRight = true;
        }

        // 5. Check Diagonal Points (If Captured)
        if (this.isCaptured) {
            if (Math.hypot(canvasX - this.diagonalP1.x, canvasY - this.diagonalP1.y) < PROXIMITY_THRESHOLD) {
                this.isDraggingDiagP1 = true;
                return;
            }
            if (Math.hypot(canvasX - this.diagonalP2.x, canvasY - this.diagonalP2.y) < PROXIMITY_THRESHOLD) {
                this.isDraggingDiagP2 = true;
                return;
            }
        }
    }

    onMouseMove(event: MouseEvent): void {
        if (!this.isDraggingLeft && !this.isDraggingRight && !this.isDraggingFrameLeft && !this.isDraggingFrameRight && !this.isDraggingFrameTop && !this.isDraggingFrameBottom && !this.isDraggingPupilLeft && !this.isDraggingPupilRight && !this.isDraggingDiagP1 && !this.isDraggingDiagP2) return;

        const rect = this.overlayCanvas.nativeElement.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        const scaleX = this.overlayCanvas.nativeElement.width / rect.width;
        const scaleY = this.overlayCanvas.nativeElement.height / rect.height;

        const canvasX = x * scaleX;
        const canvasY = y * scaleY;

        // Height Dragging
        if (this.isDraggingLeft) {
            this.frameBottomLeftY = canvasY;
        }
        if (this.isDraggingRight) {
            this.frameBottomRightY = canvasY;
        }

        // Red Lines Dragging
        if (this.isDraggingFrameTop) {
            this.frameTopY = canvasY;
        }
        if (this.isDraggingFrameBottom) {
            this.frameBottomY = canvasY;
        }

        // Diagonal Dragging
        if (this.isDraggingDiagP1) {
            this.diagonalP1 = { x: canvasX, y: canvasY };
        }
        if (this.isDraggingDiagP2) {
            this.diagonalP2 = { x: canvasX, y: canvasY };
        }

        // Pupil Dragging (Manual Correction)
        if (this.isCaptured && this.capturedPupils) {
            if (this.isDraggingPupilLeft) {
                this.capturedPupils.left = { x: canvasX, y: canvasY };
            }
            if (this.isDraggingPupilRight) {
                this.capturedPupils.right = { x: canvasX, y: canvasY };
            }
        }

        // Frame Width Dragging (Update Offsets)
        // Use Captured landmarks if frozen, otherwise live landmarks
        const sourceLandmarks = this.isCaptured ? this.capturedLandmarks : this.currentLandmarks;

        if (sourceLandmarks && sourceLandmarks.length > 454) {
            if (this.isDraggingFrameLeft) {
                // Offset = New Position - Landmark Position
                this.frameLeftOffset = canvasX - sourceLandmarks[234].x;
            }
            if (this.isDraggingFrameRight) {
                this.frameRightOffset = canvasX - sourceLandmarks[454].x;
            }

            // Recalculate calibration in real-time if adjusted
            if (this.hasManualFrameAdjustment) {
                this.calibrateWithFrame(); // Re-trigger calibration with new positions
            }
        }

        // Handling in Captured Mode: Redraw overlay on drag
        if (this.isCaptured && this.capturedPupils) {
            if (this.pixelsPerMm) {
                this.latestMeasurement = this.calculateMeasurement(this.capturedPupils);
                this.measurementChange.emit(this.latestMeasurement);
            }
            this.drawOverlay(this.capturedPupils);
        }
    }

    onMouseUp(): void {
        this.isDraggingLeft = false;
        this.isDraggingRight = false;
        this.isDraggingFrameLeft = false;
        this.isDraggingFrameRight = false;
        this.isDraggingFrameTop = false;
        this.isDraggingFrameBottom = false;
        this.isDraggingPupilLeft = false;
        this.isDraggingPupilRight = false;
        this.isDraggingDiagP1 = false;
        this.isDraggingDiagP2 = false;
    }

    // Duplicate ngAfterViewInit removed.


    detectionFrameId: number | null = null;
    cameraError: string | null = null; // To display in UI

    async startCamera(): Promise<void> {
        this.addDebugLog('startCamera() invoked');
        this.cameraError = null;

        if (!this.videoElement) {
            console.error('Video element not found');
            this.addDebugLog('Error: Video element missing');
            this.cameraError = 'Erreur interne: Élément vidéo introuvable.';
            this.cdr.markForCheck();
            return;
        }

        try {
            this.addDebugLog('Requesting getUserMedia...');
            // Request camera permissions first
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user', width: 1280, height: 720 },
                audio: false
            });

            this.addDebugLog('Stream obtained. Setting srcObject...');

            // Set video source
            const video = this.videoElement.nativeElement;
            video.srcObject = stream;
            video.muted = true;
            video.playsInline = true;

            // Ensure video plays
            this.addDebugLog('Calling video.play()...');
            await video.play();
            this.addDebugLog('Video playing. Starting loop...');

            // Start detection loop manually
            this.startDetectionLoop();
        } catch (error: any) {
            console.error('Failed to start camera:', error);
            this.addDebugLog('Camera Error: ' + error.name + ' - ' + error.message);
            this.cameraError = 'Impossible d\'accéder à la caméra. Vérifiez les permissions et que la caméra n\'est pas utilisée ailleurs.';

            if (error.name === 'NotAllowedError') {
                this.cameraError = 'Accès à la caméra refusé. Veuillez autoriser l\'accès dans votre navigateur.';
            } else if (error.name === 'NotFoundError') {
                this.cameraError = 'Aucune caméra détectée.';
            }
            this.cdr.markForCheck();
        }
    }

    startDetectionLoop(): void {
        // Safety: Prevent multiple loops
        if (this.detectionFrameId) {
            cancelAnimationFrame(this.detectionFrameId);
            this.detectionFrameId = null;
        }

        let frames = 0;
        const loop = async () => {
            if (!this.videoElement || this.isCaptured) {
                if (this.isCaptured) {
                    this.detectionFrameId = null;
                    return;
                }
                if (!this.videoElement) {
                    this.detectionFrameId = requestAnimationFrame(loop);
                    return;
                }
            }

            const video = this.videoElement.nativeElement;

            // Safety: ensure video is actually playing and has data
            if (video.readyState >= 2 && !video.paused && !video.ended) {
                try {
                    await this.mpEngine.detectFrame(video, (result) => {
                        if (frames % 60 === 0) this.addDebugLog('Detection active (ping)');
                        frames++;

                        // [Existing Processing Logic]
                        if (result.pupils) {

                            // Smooth
                            const smoothedLeft = this.smootherLeft.next(result.pupils.left);
                            const smoothedRight = this.smootherRight.next(result.pupils.right);
                            result.pupils.left = smoothedLeft;
                            result.pupils.right = smoothedRight;

                            // Init Lines
                            if (this.frameBottomLeftY === 0) this.frameBottomLeftY = result.pupils.left.y + 50;
                            if (this.frameBottomRightY === 0) this.frameBottomRightY = result.pupils.right.y + 50;
                            if (this.frameTopY === 0) this.frameTopY = Math.max(20, result.pupils.left.y - 150);
                            if (this.frameBottomY === 0) this.frameBottomY = Math.min(700, result.pupils.left.y + 150);

                            // Calibration Landmarks
                            if (result.landmarks) {
                                this.currentLandmarks = result.landmarks;
                                this.calculateFaceWidth();
                            }

                            // Draw & Measure
                            this.drawOverlay(result.pupils);
                            const measurement = this.calculateMeasurement(result.pupils);
                            this.latestMeasurement = measurement;
                            this.measurementChange.emit(measurement);
                            this.cdr.markForCheck();
                        }
                    });
                } catch (err) {
                    console.warn('Frame detection failed (transient):', err);
                    // Do not crash loop
                }
            }

            this.detectionFrameId = requestAnimationFrame(loop);
        };
        this.detectionFrameId = requestAnimationFrame(loop);
    }

    /**
     * Capture the current frame and freeze for editing
     */
    capture(): void {
        const video = this.videoElement?.nativeElement;
        if (!video) return;

        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        this.capturedImage = new Image();
        this.capturedImage.src = canvas.toDataURL('image/png');

        // State updates
        this.isCaptured = true;

        // Ensure pupils are captured
        if (this.latestMeasurement?.pupils) {
            this.capturedPupils = JSON.parse(JSON.stringify(this.latestMeasurement.pupils));
        } else {
            // Absolute fallback center-screen
            this.capturedPupils = {
                left: { x: canvas.width * 0.4, y: canvas.height * 0.4 },
                right: { x: canvas.width * 0.6, y: canvas.height * 0.4 }
            };
        }
        this.capturedLandmarks = this.currentLandmarks.length > 0 ? [...this.currentLandmarks] : [];

        // Force diagonal points to be visible in center
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        this.diagonalP1 = { x: centerX - 100, y: centerY - 50 };
        this.diagonalP2 = { x: centerX + 100, y: centerY + 50 };

        console.log('Capture active - starting nuclear redraw loop');
        this.startCaptureRedrawLoop();
        this.cdr.detectChanges();
    }

    private startCaptureRedrawLoop(): void {
        if (this.captureFrameRequest) cancelAnimationFrame(this.captureFrameRequest);

        const loop = () => {
            if (!this.isCaptured) return;
            if (this.capturedPupils) {
                this.drawOverlay(this.capturedPupils);
            }
            this.captureFrameRequest = requestAnimationFrame(loop);
        };
        this.captureFrameRequest = requestAnimationFrame(loop);
    }

    ngOnDestroy(): void {
        this.mpEngine.stop();
        if (this.detectionFrameId) {
            cancelAnimationFrame(this.detectionFrameId);
        }
        // Stop stream tracks
        if (this.videoElement && this.videoElement.nativeElement.srcObject) {
            const stream = this.videoElement.nativeElement.srcObject as MediaStream;
            stream.getTracks().forEach(track => track.stop());
        }
    }

    /**
     * Retake / Resume live stream
     */
    retake(): void {
        this.isCaptured = false;
        this.capturedImage = null;
        this.capturedPupils = null;
        this.capturedLandmarks = [];
        console.log('Retaking - restarting loop...');
        this.startDetectionLoop();
    }

    /**
     * Calculate face width using landmarks (temple to temple) + Offsets
     */
    private calculateFaceWidth(): void {
        const sourceLandmarks = this.isCaptured ? this.capturedLandmarks : this.currentLandmarks;
        if (!sourceLandmarks || sourceLandmarks.length < 454) return;

        // Use landmarks 234 (left temple) and 454 (right temple) WITH OFFSETS
        const leftTempleX = sourceLandmarks[234].x + this.frameLeftOffset;
        const leftTempleY = sourceLandmarks[234].y;

        const rightTempleX = sourceLandmarks[454].x + this.frameRightOffset;
        const rightTempleY = sourceLandmarks[454].y;

        this.faceWidth = Math.hypot(
            rightTempleX - leftTempleX,
            rightTempleY - leftTempleY
        );
    }

    /**
     * Calibrate using frame width
     */
    calibrateWithFrame(): void {
        if (!this.frameWidthMm || this.frameWidthMm <= 0) {
            // Only alert if explicit user action, not during drag
            if (!this.isDraggingFrameLeft && !this.isDraggingFrameRight) {
                alert('Veuillez entrer une largeur de monture valide');
            }
            return;
        }

        if (this.faceWidth <= 0) {
            return;
        }

        try {
            // Calculate pixels per mm based on face width (Adjusted Width)
            this.pixelsPerMm = this.faceWidth / this.frameWidthMm;
            this.isCalibrated = true;

            // Save calibration
            this.calibrationService.saveCalibration({
                pixelsPerMm: this.pixelsPerMm,
                cardWidthPx: this.faceWidth, // Store adjusted width as reference
                deviceId: navigator.userAgent,
                timestamp: Date.now()
            });

            this.cdr.markForCheck();
        } catch (error) {
            console.error('Calibration error:', error);
        }
    }

    resetCalibration(): void {
        this.isCalibrated = false;
        this.pixelsPerMm = null;
        this.frameLeftOffset = 0;
        this.frameRightOffset = 0;
        this.hasManualFrameAdjustment = false;
        localStorage.removeItem('calibration_data');
        this.cdr.markForCheck();
    }

    calculateMeasurement(pupils: { left: Point; right: Point }): Measurement {
        // Use Captured landmarks if frozen, otherwise live landmarks (for frame center calculation)
        const sourceLandmarks = this.isCaptured ? this.capturedLandmarks : this.currentLandmarks;

        // 1. Calculate Frame Center (Bridge) using ADJUSTED POSITIONS
        let frameCenterX = (pupils.left.x + pupils.right.x) / 2; // Default to pupil center if no frame
        if (sourceLandmarks && sourceLandmarks.length > 454) {
            const leftTempleX = sourceLandmarks[234].x + this.frameLeftOffset;
            const rightTempleX = sourceLandmarks[454].x + this.frameRightOffset;
            frameCenterX = (leftTempleX + rightTempleX) / 2;
        }

        // 2. Calculate PD Total (Pupil to Pupil)
        const pdPx = Math.hypot(
            pupils.right.x - pupils.left.x,
            pupils.right.y - pupils.left.y
        );
        const pdMm = this.safePxToMm(pdPx);

        // 3. Calculate Half-PDs from Frame Center
        // We project pupils onto the horizontal axis of the frame to measure horizontal distance from center
        const pdLeftPx = Math.abs(pupils.left.x - frameCenterX);
        const pdRightPx = Math.abs(pupils.right.x - frameCenterX);

        const pdLeftMm = this.safePxToMm(pdLeftPx);
        const pdRightMm = this.safePxToMm(pdRightPx);

        // Height Calculation
        const heightLeftPx = Math.max(0, this.frameBottomLeftY - pupils.left.y);
        const heightRightPx = Math.max(0, this.frameBottomRightY - pupils.right.y);

        const heightLeftMm = this.safePxToMm(heightLeftPx);
        const heightRightMm = this.safePxToMm(heightRightPx);

        // Frame Height Calculation (Red Lines)
        let frameHeightMm = 0;
        if (this.frameTopY > 0 && this.frameBottomY > 0) {
            const hPx = Math.abs(this.frameBottomY - this.frameTopY);
            frameHeightMm = this.safePxToMm(hPx);
        }


        // --- MANUAL DIAGONAL MEASUREMENT (Must be calculated first) ---
        let diagonalMm = 0;
        if (this.diagonalP1.x !== 0 && this.diagonalP2.x !== 0) {
            const diagPx = Math.hypot(
                this.diagonalP2.x - this.diagonalP1.x,
                this.diagonalP2.y - this.diagonalP1.y
            );

            if (this.pixelsPerMm && this.pixelsPerMm > 0) {
                diagonalMm = diagPx / this.pixelsPerMm;
            }
        }

        // --- OPTICIAN'S EFFECTIVE DIAMETER (ED) CALCULATION (Lab Method from Image 2) ---
        // Formula: ED = (Écart monture/boxing) - (Plus petit écart pupillaire × 2) + Plus grande diagonale

        let edMm = 0;

        // Ensure inputs are numbers (handle potential string inputs from HTML attributes)
        const caliberNum = Number(this.caliber) || 0;
        const bridgeNum = Number(this.bridge) || 0;

        const usedCaliber = caliberNum > 0 ? caliberNum : 52;
        const usedBridge = bridgeNum > 0 ? bridgeNum : 18;

        // 1. Écart monture (boxing) = Frame width = caliber + bridge
        const frameBoxingWidth = usedCaliber + usedBridge;

        // 2. Plus petit écart pupillaire (smallest PD)
        // We use the calculated PDs from pixels to ensure consistency with the current measurement
        const pdRightVal = this.safePxToMm(pdRightPx);
        const pdLeftVal = this.safePxToMm(pdLeftPx);
        const minPD = Math.min(pdRightVal, pdLeftVal);

        // 3. Plus grande diagonale = Use manual diagonal measurement if available, otherwise calculate
        const largestDiagonal = diagonalMm > 0 ? diagonalMm : Math.sqrt(usedCaliber ** 2 + (frameHeightMm || 0) ** 2);

        // 4. Calculate ED
        // Correct Logic: FrameWidth - (2 * PD) equates to (2 * Decentration).
        // Then we add the diagonal.
        edMm = frameBoxingWidth - (minPD * 2) + largestDiagonal;

        // 5. Calculate Standard Supplier Diameter (Applying +2mm safety margin)
        const standardDiameterMm = this.getStandardDiameter(edMm + 2);

        // Debug logging with type check
        console.log('[ED CALC]', {
            inputs: { caliber: this.caliber, bridge: this.bridge },
            parsed: { usedCaliber, usedBridge },
            frameBoxingWidth,
            pdRightVal,
            pdLeftVal,
            minPD,
            largestDiagonal,
            diagonalMm,
            edMm,
            standardDiameterMm
        });

        return {
            pdMm: this.safePxToMm(pdPx),
            pdLeftMm: pdLeftVal,
            pdRightMm: pdRightVal,
            heightLeftMm: this.safePxToMm(heightLeftPx),
            heightRightMm: this.safePxToMm(heightRightPx),
            frameHeightMm: this.safePxToMm(this.frameTopY > 0 && this.frameBottomY > 0 ? Math.abs(this.frameBottomY - this.frameTopY) : 0),
            edMm,
            edRightMm: edMm, // Same value for both eyes with new formula
            edLeftMm: edMm,
            diagonalMm,
            standardDiameterMm,
            diagonalPoints: { p1: this.diagonalP1, p2: this.diagonalP2 },
            pupils,
            timestamp: Date.now()
        };
    }

    private getStandardDiameter(calcDiameter: number): number {
        const standards = [55, 60, 65, 70, 75, 80, 85];
        for (const s of standards) {
            if (s >= calcDiameter) return s;
        }
        return 85;
    }

    private safePxToMm(px: number): number {
        if (!this.pixelsPerMm || this.pixelsPerMm <= 0) return 0;
        return px / this.pixelsPerMm;
    }

    private drawOverlay(pupils: { left: Point; right: Point }): void {
        const canvas = this.overlayCanvas?.nativeElement;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // --- NUCLEAR DEBUG: ALWAYS SHOW RED TOP-LEFT BOX TO PROVE RENDERING ---
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'red';
        ctx.fillRect(0, 0, 40, 40);
        ctx.fillStyle = 'white';
        ctx.font = 'bold 10px Arial';
        ctx.fillText('LIVE', 5, 25);

        // Use Captured landmarks if frozen, otherwise live landmarks
        let sourceLandmarks: any[] | null = null; // Declare here to be accessible outside try/catch if needed

        try {
            sourceLandmarks = this.isCaptured ? this.capturedLandmarks : this.currentLandmarks;

            // 0. Background
            if (this.isCaptured && this.capturedImage) {
                ctx.drawImage(this.capturedImage, 0, 0, canvas.width, canvas.height);
            }

            // 1. Draw Frame Guides (ALWAYS VISIBLE for verification)
            if (sourceLandmarks && sourceLandmarks.length > 454) {
                const leftTempleX = sourceLandmarks[234].x + this.frameLeftOffset;
                const leftTempleY = sourceLandmarks[234].y;

                const rightTempleX = sourceLandmarks[454].x + this.frameRightOffset;
                const rightTempleY = sourceLandmarks[454].y;

                const frameCenterX = (leftTempleX + rightTempleX) / 2;

                // --- FRAME EXTREMITIES (Adjustable Vertical Lines) ---

                // Left Limit
                ctx.strokeStyle = this.isDraggingFrameLeft ? 'rgba(255, 200, 0, 1)' : 'rgba(255, 140, 0, 0.9)';
                ctx.lineWidth = this.isDraggingFrameLeft ? 3 : 2;
                ctx.beginPath();
                ctx.moveTo(leftTempleX, 0);
                ctx.lineTo(leftTempleX, canvas.height);
                ctx.stroke();

                // Right Limit
                ctx.strokeStyle = this.isDraggingFrameRight ? 'rgba(255, 200, 0, 1)' : 'rgba(255, 140, 0, 0.9)';
                ctx.lineWidth = this.isDraggingFrameRight ? 3 : 2;
                ctx.beginPath();
                ctx.moveTo(rightTempleX, 0);
                ctx.lineTo(rightTempleX, canvas.height);
                ctx.stroke();

                // Points
                ctx.fillStyle = 'rgba(255, 140, 0, 1)';
                ctx.beginPath();
                ctx.arc(leftTempleX, leftTempleY, 5, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.arc(rightTempleX, rightTempleY, 5, 0, Math.PI * 2);
                ctx.fill();

                // --- FRAME CENTER ---
                ctx.strokeStyle = 'rgba(0, 255, 255, 0.8)'; // Cyan
                ctx.setLineDash([10, 5]);
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(frameCenterX, 0);
                ctx.lineTo(frameCenterX, canvas.height);
                ctx.stroke();
                ctx.setLineDash([]);

                ctx.fillStyle = 'rgba(0, 255, 255, 0.8)';
                ctx.fillText('Axe Central', frameCenterX + 5, 20);
            }

            // Draw pupils
            // Left
            ctx.fillStyle = this.isDraggingPupilLeft ? '#ffff00' : 'rgba(0, 255, 0, 1)';
            const rL = this.isDraggingPupilLeft ? 5 : 2;
            ctx.beginPath();
            ctx.arc(pupils.left.x, pupils.left.y, rL, 0, Math.PI * 2);
            ctx.fill();

            // Right
            ctx.fillStyle = this.isDraggingPupilRight ? '#ffff00' : 'rgba(0, 255, 0, 1)';
            const rR = this.isDraggingPupilRight ? 5 : 2;
            ctx.beginPath();
            ctx.arc(pupils.right.x, pupils.right.y, rR, 0, Math.PI * 2);
            ctx.fill();

            // Draw line between pupils
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.setLineDash([5, 5]);
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(pupils.left.x, pupils.left.y);
            ctx.lineTo(pupils.right.x, pupils.right.y);
            ctx.stroke();
            ctx.setLineDash([]);

            // --- DRAW RED FRAME HEIGHT LINES (ONLY IF CAPTURED) ---
            if (this.isCaptured) {
                if (this.frameTopY > 0) {
                    ctx.strokeStyle = '#FF0000';
                    ctx.lineWidth = 2; // Bold red
                    ctx.beginPath();
                    ctx.moveTo(0, this.frameTopY);
                    ctx.lineTo(canvas.width, this.frameTopY);
                    ctx.stroke();

                    // Draw small handle/label
                    ctx.fillStyle = '#FF0000';
                    ctx.fillText('Haut Verre', 10, this.frameTopY - 5);
                }

                if (this.frameBottomY > 0) {
                    ctx.strokeStyle = '#FF0000';
                    ctx.lineWidth = 2; // Bold red
                    ctx.beginPath();
                    ctx.moveTo(0, this.frameBottomY);
                    ctx.lineTo(canvas.width, this.frameBottomY);
                    ctx.stroke();

                    // Draw small handle/label
                    ctx.fillStyle = '#FF0000';
                    ctx.fillText('Bas Verre', 10, this.frameBottomY + 15);
                }
            }

            // DRAW HEIGHT LINES (Bottom of frame)
            // Left Eye Height Line
            if (this.frameBottomLeftY > 0) {
                ctx.fillStyle = this.isDraggingLeft ? 'rgba(255, 255, 0, 0.8)' : 'rgba(0, 200, 255, 0.8)';
                ctx.fillRect(pupils.left.x - 40, this.frameBottomLeftY, 80, 2);
                // Connect pupil to line
                ctx.strokeStyle = 'rgba(0, 200, 255, 0.5)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(pupils.left.x, pupils.left.y);
                ctx.lineTo(pupils.left.x, this.frameBottomLeftY);
                ctx.stroke();

                // Label
                if (this.latestMeasurement?.heightLeftMm) {
                    ctx.fillStyle = '#fff';
                    ctx.font = '12px Arial';
                    ctx.fillText(`H: ${this.latestMeasurement.heightLeftMm.toFixed(1)}mm`, pupils.left.x + 10, (pupils.left.y + this.frameBottomLeftY) / 2);
                }
            }

            // Right Eye Height Line
            if (this.frameBottomRightY > 0) {
                ctx.fillStyle = this.isDraggingRight ? 'rgba(255, 255, 0, 0.8)' : 'rgba(0, 200, 255, 0.8)';
                ctx.fillRect(pupils.right.x - 40, this.frameBottomRightY, 80, 2);
                // Connect pupil to line
                ctx.strokeStyle = 'rgba(0, 200, 255, 0.5)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(pupils.right.x, pupils.right.y);
                ctx.lineTo(pupils.right.x, this.frameBottomRightY);
                ctx.stroke();

                // Label
                if (this.latestMeasurement?.heightRightMm) {
                    ctx.fillStyle = '#fff';
                    ctx.font = '12px Arial';
                    ctx.fillText(`H: ${this.latestMeasurement.heightRightMm.toFixed(1)}mm`, pupils.right.x + 10, (pupils.right.y + this.frameBottomRightY) / 2);
                }
            }

            // --- DRAW EFFECTIVE DIAMETER CIRCLES ---
            if (this.isCaptured && this.latestMeasurement?.edMm && this.pixelsPerMm) {
                const m = this.latestMeasurement;
                const pxMm = this.pixelsPerMm;

                // OD Circle
                if (m.edRightMm) {
                    const radiusPx = (m.edRightMm / 2) * pxMm;
                    ctx.strokeStyle = 'rgba(74, 222, 128, 0.5)'; // Emerald
                    ctx.lineWidth = 2;
                    ctx.setLineDash([5, 5]);
                    ctx.beginPath();
                    ctx.arc(pupils.right.x, pupils.right.y, radiusPx, 0, Math.PI * 2);
                    ctx.stroke();
                }

                // OG Circle
                if (m.edLeftMm) {
                    const radiusPx = (m.edLeftMm / 2) * pxMm;
                    ctx.strokeStyle = 'rgba(74, 222, 128, 0.5)';
                    ctx.lineWidth = 2;
                    ctx.setLineDash([5, 5]);
                    ctx.beginPath();
                    ctx.arc(pupils.left.x, pupils.left.y, radiusPx, 0, Math.PI * 2);
                    ctx.stroke();
                }
                ctx.setLineDash([]);
            }

            // Draw measurement text panel (Professional Lab Version)
            if (this.latestMeasurement) {
                const m = this.latestMeasurement;

                // Background Card
                ctx.fillStyle = 'rgba(15, 23, 42, 0.85)'; // Modern Slate
                ctx.beginPath();
                if ((ctx as any).roundRect) {
                    (ctx as any).roundRect(10, 10, 260, 230, 12); // Slightly taller
                } else {
                    ctx.rect(10, 10, 260, 230);
                }
                ctx.fill();

                // Header: Lab Method
                ctx.fillStyle = '#38bdf8'; // Sky Blue
                ctx.font = 'bold 11px Inter, sans-serif';
                ctx.fillText('MÉTHODE LABORATOIRE (LAB)', 25, 30);

                // PD Total Section
                ctx.fillStyle = '#fff';
                ctx.font = 'bold 20px Inter, sans-serif';
                ctx.fillText(`PD Total: ${m.pdMm.toFixed(1)}mm`, 25, 55);

                ctx.font = '11px Inter, sans-serif';
                ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
                ctx.fillText(`Largeur Ref (Calibrage): ${this.frameWidthMm}mm`, 25, 73);

                // Separator
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
                ctx.beginPath();
                ctx.moveTo(25, 85);
                ctx.lineTo(245, 85);
                ctx.stroke();

                // Mono Mesures
                ctx.font = 'bold 14px Inter, sans-serif';
                ctx.fillStyle = '#fff';
                ctx.fillText(`OD: ${m.pdRightMm.toFixed(1)} | H: ${m.heightRightMm?.toFixed(1) || '-'} mm`, 25, 105);
                ctx.fillText(`OG: ${m.pdLeftMm.toFixed(1)} | H: ${m.heightLeftMm?.toFixed(1) || '-'} mm`, 25, 125);

                // Final Result: Effective Diameter
                // Adjusted positions and sizes for better hierarchy
                const labelX = 25;
                const valueX = 160; // Aligned right column
                let currentY = 160;

                // 1. Diamètre Utile (Attributes)
                ctx.fillStyle = '#4ade80'; // Emerald Green
                ctx.font = 'bold 12px Inter, sans-serif';
                ctx.fillText(`DIAMÈTRE UTILE (ED)`, labelX, currentY);

                ctx.font = 'bold 16px Inter, sans-serif'; // Reduced size slightly to fit two lines if needed or condense
                // Option: Show split if different
                // Format: "OD: 60.3 | OG: 58.1"
                const edR = m.edRightMm ? m.edRightMm.toFixed(1) : '-';
                const edL = m.edLeftMm ? m.edLeftMm.toFixed(1) : '-';

                // If strictly equal (rare with floats but possible if PDs are equal), show one.
                // But per user request "calcule pour chaque oeil", showing both is safer.
                ctx.fillText(`OD ${edR} | OG ${edL}`, 130, currentY);

                currentY += 25;

                // 2. Hauteur Verre
                if (m.frameHeightMm) {
                    ctx.fillStyle = '#FF0000'; // Red
                    ctx.font = 'bold 12px Inter, sans-serif';
                    ctx.fillText(`HAUTEUR VERRE`, labelX, currentY);

                    ctx.font = 'bold 18px Inter, sans-serif';
                    ctx.fillText(`${m.frameHeightMm.toFixed(1)} mm`, valueX, currentY);

                    currentY += 25;
                }

                // 3. Grand Diamètre (Diagonal)
                if (m.diagonalMm) {
                    ctx.fillStyle = '#fff'; // White for readability
                    ctx.font = 'bold 12px Inter, sans-serif';
                    ctx.fillText(`GRAND DIAMÈTRE (Ø)`, labelX, currentY);

                    ctx.font = 'bold 18px Inter, sans-serif';
                    ctx.fillText(`Ø ${m.diagonalMm.toFixed(2)} mm`, valueX, currentY);
                }
            }

            if (this.latestMeasurement) {
                ctx.font = 'italic 10px Arial';
                ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
                ctx.fillText('Ajustez les lignes pour le calibrage', 25, 235);
            }

        } catch (err) {
            console.error('Error drawing overlay:', err);
        }

        // --- FINAL FAIL-SAFE: DRAW DIAGONAL ON TOP OF EVERYTHING ---
        if (this.isCaptured && this.diagonalP1.x !== 0) {
            this.drawDiagonalFailSafe(ctx);
        }
    }

    private drawDiagonalFailSafe(ctx: CanvasRenderingContext2D): void {
        if (!this.isCaptured) return;

        ctx.save();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1.0;

        // Draw Cross-hair for the whole screen if points are missing (safety)
        if (this.diagonalP1.x === 0 || this.diagonalP2.x === 0) {
            this.diagonalP1 = { x: 100, y: 100 };
            this.diagonalP2 = { x: 300, y: 300 };
        }

        // Draw Main Line (Magenta, thinner)
        ctx.strokeStyle = '#FF00FF';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(this.diagonalP1.x, this.diagonalP1.y);
        ctx.lineTo(this.diagonalP2.x, this.diagonalP2.y);
        ctx.stroke();

        // Arrow heads (Pure White for extreme visibility)
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        const head = 20;
        const angle = Math.atan2(this.diagonalP2.y - this.diagonalP1.y, this.diagonalP2.x - this.diagonalP1.x);

        const drawHead = (x: number, y: number, a: number) => {
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x - head * Math.cos(a - Math.PI / 6), y - head * Math.sin(a - Math.PI / 6));
            ctx.moveTo(x, y);
            ctx.lineTo(x - head * Math.cos(a + Math.PI / 6), y - head * Math.sin(a + Math.PI / 6));
            ctx.stroke();
        };
        drawHead(this.diagonalP2.x, this.diagonalP2.y, angle);
        drawHead(this.diagonalP1.x, this.diagonalP1.y, angle + Math.PI);

        // No visible drag handles or label (removed for clean display)

        ctx.restore();
    }
}
