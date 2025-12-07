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

    // Capture State
    capturedImage: HTMLImageElement | null = null;
    isCaptured = false;

    // Height Measurement (Bottom of frame lines)
    frameBottomLeftY: number = 0;
    frameBottomRightY: number = 0;
    isDraggingLeft = false;
    isDraggingRight = false;

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
        const y = event.clientY - rect.top;
        const scaleY = this.overlayCanvas.nativeElement.height / rect.height;
        const canvasY = y * scaleY;

        // Check proximity to lines (threshold 20px)
        if (Math.abs(canvasY - this.frameBottomLeftY) < 20) {
            this.isDraggingLeft = true;
        } else if (Math.abs(canvasY - this.frameBottomRightY) < 20) {
            this.isDraggingRight = true;
        }
    }

    onMouseMove(event: MouseEvent): void {
        if (!this.isDraggingLeft && !this.isDraggingRight) return;

        const rect = this.overlayCanvas.nativeElement.getBoundingClientRect();
        const y = event.clientY - rect.top;
        const scaleY = this.overlayCanvas.nativeElement.height / rect.height;
        const canvasY = y * scaleY;

        if (this.isDraggingLeft) {
            this.frameBottomLeftY = canvasY;
        }
        if (this.isDraggingRight) {
            this.frameBottomRightY = canvasY;
        }

        // If in captured mode/static image, we must manually trigger redraw when dragging
        if (this.isCaptured && this.latestMeasurement?.pupils) {
            this.drawOverlay(this.latestMeasurement.pupils);
            // Also update measurement values live
            const newMeasurement = this.calculateMeasurement(this.latestMeasurement.pupils);
            this.latestMeasurement = newMeasurement;
            this.measurementChange.emit(newMeasurement);
        }
    }

    onMouseUp(): void {
        this.isDraggingLeft = false;
        this.isDraggingRight = false;
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
                if (result.pupils) {
                    // Apply smoothing
                    const smoothedLeft = this.smootherLeft.next(result.pupils.left);
                    const smoothedRight = this.smootherRight.next(result.pupils.right);

                    result.pupils.left = smoothedLeft;
                    result.pupils.right = smoothedRight;

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
     * Calculate face width using landmarks (temple to temple)
     */
    private calculateFaceWidth(): void {
        if (!this.currentLandmarks || this.currentLandmarks.length < 454) return;

        // Use landmarks 234 (left temple) and 454 (right temple)
        const leftTemple = this.currentLandmarks[234];
        const rightTemple = this.currentLandmarks[454];

        if (leftTemple && rightTemple) {
            this.faceWidth = Math.hypot(
                rightTemple.x - leftTemple.x,
                rightTemple.y - leftTemple.y
            );
        }
    }

    /**
     * Calibrate using frame width
     */
    calibrateWithFrame(): void {
        if (!this.frameWidthMm || this.frameWidthMm <= 0) {
            alert('Veuillez entrer une largeur de monture valide');
            return;
        }

        if (this.faceWidth <= 0) {
            alert('Aucun visage détecté. Assurez-vous d\'être bien visible dans la caméra.');
            return;
        }

        try {
            // Calculate pixels per mm based on face width
            // Assuming frame width ≈ face width when wearing glasses
            this.pixelsPerMm = this.faceWidth / this.frameWidthMm;
            this.isCalibrated = true;

            // Save calibration
            this.calibrationService.saveCalibration({
                pixelsPerMm: this.pixelsPerMm,
                cardWidthPx: this.faceWidth, // Store face width as reference
                deviceId: navigator.userAgent,
                timestamp: Date.now()
            });

            console.log(`Calibrated: ${this.pixelsPerMm.toFixed(2)} px/mm`);
            this.cdr.markForCheck();
        } catch (error) {
            console.error('Calibration error:', error);
            alert('Erreur de calibration');
        }
    }

    resetCalibration(): void {
        this.isCalibrated = false;
        this.pixelsPerMm = null;
        localStorage.removeItem('calibration_data');
        this.cdr.markForCheck();
    }

    private calculateMeasurement(pupils: { left: Point; right: Point }): Measurement {
        // Initialize lines if not set (e.g. 50px below pupils initially)
        if (this.frameBottomLeftY === 0) this.frameBottomLeftY = pupils.left.y + 100;
        if (this.frameBottomRightY === 0) this.frameBottomRightY = pupils.right.y + 100;

        const pdPx = Math.hypot(
            pupils.right.x - pupils.left.x,
            pupils.right.y - pupils.left.y
        );
        const pdMm = this.calibrationService.pxToMm(pdPx, this.pixelsPerMm!);

        const midX = (pupils.left.x + pupils.right.x) / 2;
        const midY = (pupils.left.y + pupils.right.y) / 2;

        const pdLeftPx = Math.hypot(pupils.left.x - midX, pupils.left.y - midY);
        const pdRightPx = Math.hypot(pupils.right.x - midX, pupils.right.y - midY);

        const pdLeftMm = this.calibrationService.pxToMm(pdLeftPx, this.pixelsPerMm!);
        const pdRightMm = this.calibrationService.pxToMm(pdRightPx, this.pixelsPerMm!);

        // Height Calculation: Distance Y from Pupil to Bottom Line
        // We take vertical difference
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
            ctx.fillText(`PD Total: ${this.latestMeasurement.pdMm.toFixed(1)} mm`, 10, 30);

            ctx.font = '14px Inter, Arial';
            ctx.fillText(`OD - PD: ${this.latestMeasurement.pdRightMm.toFixed(1)} | H: ${this.latestMeasurement.heightRightMm?.toFixed(1) ?? '?'}`, 10, 60);
            ctx.fillText(`OG - PD: ${this.latestMeasurement.pdLeftMm.toFixed(1)} | H: ${this.latestMeasurement.heightLeftMm?.toFixed(1) ?? '?'}`, 10, 90);

            ctx.font = 'italic 12px Arial';
            ctx.fillStyle = '#aaa';
            ctx.fillText('Ajustez les lignes bleues pour la hauteur', 10, 120);
        }
    }
}
