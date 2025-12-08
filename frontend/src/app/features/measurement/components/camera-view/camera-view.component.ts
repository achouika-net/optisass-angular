import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef, Output, EventEmitter, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
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

    frameWidthMm: number = 140; // Default frame width
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

    private smootherLeft = new ExpSmoother(0.35);
    private smootherRight = new ExpSmoother(0.35);

    constructor(
        private mpEngine: MediaPipeEngineService,
        private calibrationService: CalibrationService,
        private cdr: ChangeDetectorRef
    ) { }

    async ngOnInit(): Promise<void> {
        // Load saved calibration
        const savedCalibration = this.calibrationService.loadCalibration();
        if (savedCalibration && this.calibrationService.isCalibrationValid()) {
            this.pixelsPerMm = savedCalibration.pixelsPerMm;
            this.isCalibrated = true;
        }

        // Initialize MediaPipe engine
        try {
            await this.mpEngine.init();
            this.isReady = true;
            this.cdr.markForCheck();
        } catch (error) {
            console.error('Failed to initialize MediaPipe:', error);
        }
    }

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

        // 2. Check Height Horizontal Lines (Y-axis)
        if (Math.abs(canvasY - this.frameBottomLeftY) < PROXIMITY_THRESHOLD) {
            this.isDraggingLeft = true;
        } else if (Math.abs(canvasY - this.frameBottomRightY) < PROXIMITY_THRESHOLD) {
            this.isDraggingRight = true;
        }
    }

    onMouseMove(event: MouseEvent): void {
        if (!this.isDraggingLeft && !this.isDraggingRight && !this.isDraggingFrameLeft && !this.isDraggingFrameRight) return;

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
    }

    async ngAfterViewInit(): Promise<void> {
        console.log('CameraView ngAfterViewInit called');

        // Wait for MediaPipe to be ready if not already
        if (!this.isReady) {
            console.log('Waiting for MediaPipe to initialize...');
            for (let i = 0; i < 50; i++) {
                if (this.isReady) break;
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        if (this.isReady && this.videoElement) {
            console.log('Starting camera...');
            setTimeout(() => {
                this.startCamera();
            }, 500);
        } else {
            console.error('MediaPipe not ready or video element not found');
        }
    }

    ngOnDestroy(): void {
        this.mpEngine.stop();
    }

    async startCamera(): Promise<void> {
        console.log('startCamera called');

        if (!this.videoElement) {
            console.error('Video element not found');
            return;
        }

        try {
            // Request camera permissions first
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user', width: 1280, height: 720 },
                audio: false
            });

            console.log('Camera stream obtained:', stream);

            // Set video source
            this.videoElement.nativeElement.srcObject = stream;

            // Start MediaPipe detection
            this.mpEngine.start(this.videoElement.nativeElement, (result) => {
                // If captured, do NOT update landmarks/pupils from stream
                if (this.isCaptured) return;

                if (result.pupils) {
                    // Apply smoothing
                    const smoothedLeft = this.smootherLeft.next(result.pupils.left);
                    const smoothedRight = this.smootherRight.next(result.pupils.right);

                    result.pupils.left = smoothedLeft;
                    result.pupils.right = smoothedRight;

                    // Initialize height lines if not set (Default to 50px below pupils)
                    if (this.frameBottomLeftY === 0) {
                        this.frameBottomLeftY = result.pupils.left.y + 50;
                    }
                    if (this.frameBottomRightY === 0) {
                        this.frameBottomRightY = result.pupils.right.y + 50;
                    }

                    // Store landmarks for calibration
                    if (result.landmarks) {
                        this.currentLandmarks = result.landmarks;
                        this.calculateFaceWidth();
                    }

                    // Draw overlay
                    this.drawOverlay(result.pupils);

                    // Calculate measurement if calibrated
                    if (this.pixelsPerMm) {
                        const measurement = this.calculateMeasurement(result.pupils);
                        this.latestMeasurement = measurement;
                        this.measurementChange.emit(measurement);
                        this.cdr.markForCheck();
                    }
                }
            });

            console.log('MediaPipe engine started');
        } catch (error) {
            console.error('Failed to start camera:', error);
            alert('Impossible d\'accéder à la caméra. Vérifiez les permissions.');
        }
    }

    /**
     * Capture the current frame and freeze for editing
     */
    capture(): void {
        if (!this.videoElement || !this.latestMeasurement || !this.latestMeasurement.pupils) return;

        const video = this.videoElement.nativeElement;
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            this.capturedImage = new Image();
            this.capturedImage.src = canvas.toDataURL('image/png');
            this.capturedPupils = this.latestMeasurement.pupils;
            // Deep copy landmarks to prevent reference updates
            this.capturedLandmarks = [...this.currentLandmarks];

            this.isCaptured = true;
            this.isDraggingFrameLeft = false;
            this.isDraggingFrameRight = false;

            console.log('Image Captured');

            // Force a redraw with static data
            this.drawOverlay(this.capturedPupils);
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
        console.log('Retaking...');
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
        const pdMm = this.calibrationService.pxToMm(pdPx, this.pixelsPerMm!);

        // 3. Calculate Half-PDs from Frame Center
        // We project pupils onto the horizontal axis of the frame to measure horizontal distance from center
        const pdLeftPx = Math.abs(pupils.left.x - frameCenterX);
        const pdRightPx = Math.abs(pupils.right.x - frameCenterX);

        const pdLeftMm = this.calibrationService.pxToMm(pdLeftPx, this.pixelsPerMm!);
        const pdRightMm = this.calibrationService.pxToMm(pdRightPx, this.pixelsPerMm!);

        // Height Calculation
        const heightLeftPx = Math.max(0, this.frameBottomLeftY - pupils.left.y);
        const heightRightPx = Math.max(0, this.frameBottomRightY - pupils.right.y);

        const heightLeftMm = this.calibrationService.pxToMm(heightLeftPx, this.pixelsPerMm!);
        const heightRightMm = this.calibrationService.pxToMm(heightRightPx, this.pixelsPerMm!);

        return {
            pdMm,
            pdLeftMm,
            pdRightMm,
            heightLeftMm,
            heightRightMm,
            pupils,
            timestamp: Date.now()
        };
    }

    private drawOverlay(pupils: { left: Point; right: Point }): void {
        if (!this.overlayCanvas) return;

        const canvas = this.overlayCanvas.nativeElement;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // 0. Draw Captured Image Background (if captured)
        if (this.isCaptured && this.capturedImage) {
            ctx.drawImage(this.capturedImage, 0, 0, canvas.width, canvas.height);
        }

        // Use Captured landmarks if frozen, otherwise live landmarks
        const sourceLandmarks = this.isCaptured ? this.capturedLandmarks : this.currentLandmarks;

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
        ctx.fillStyle = 'rgba(0, 255, 0, 0.9)'; // Brighter green
        ctx.beginPath();
        ctx.arc(pupils.left.x, pupils.left.y, 2, 0, Math.PI * 2); // Reduced size
        ctx.fill();
        ctx.beginPath();
        ctx.arc(pupils.right.x, pupils.right.y, 2, 0, Math.PI * 2); // Reduced size
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

        // Draw measurement text panel (Updated)
        if (this.latestMeasurement) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            ctx.fillRect(0, 0, 220, 130);

            ctx.fillStyle = '#fff';
            ctx.font = 'bold 16px Inter, Arial';
            ctx.fillText(`Largeur Ref: ${this.frameWidthMm}mm`, 10, 25);
            ctx.fillText(`PD Total: ${this.latestMeasurement.pdMm.toFixed(1)}mm`, 10, 50);

            ctx.font = '14px Inter, Arial';
            ctx.fillText(`OD: ${this.latestMeasurement.pdRightMm.toFixed(1)} | H: ${this.latestMeasurement.heightRightMm?.toFixed(1) || '-'}`, 10, 80);
            ctx.fillText(`OG: ${this.latestMeasurement.pdLeftMm.toFixed(1)} | H: ${this.latestMeasurement.heightLeftMm?.toFixed(1) || '-'}`, 10, 105);

            ctx.font = 'italic 12px Arial';
            ctx.fillStyle = '#aaa';
            ctx.fillText('Ajustez les lignes oranges pour calibrer la largeur', 10, 125);
        }
    }
}
