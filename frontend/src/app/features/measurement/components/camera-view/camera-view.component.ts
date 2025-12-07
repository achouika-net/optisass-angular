import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef, Output, EventEmitter, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MediaPipeEngineService } from '../../services/mediapipe-engine.service';
import { CalibrationService } from '../../services/calibration.service';
import { CardDetectionService } from '../../services/card-detection.service';
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

    cardWidthPx: number = 0;
    pixelsPerMm: number | null = null;
    isCalibrated = false;
    isReady = false;
    latestMeasurement: Measurement | null = null;

    // Auto card detection
    autoDetectCard = true;
    detectedCard: { width: number; height: number; x: number; y: number } | null = null;
    isDetectingCard = false;

    private smootherLeft = new ExpSmoother(0.35);
    private smootherRight = new ExpSmoother(0.35);

    constructor(
        private mpEngine: MediaPipeEngineService,
        private calibrationService: CalibrationService,
        private cardDetection: CardDetectionService,
        private cdr: ChangeDetectorRef
    ) { }

    async ngOnInit(): Promise<void> {
        // Load saved calibration
        const savedCalibration = this.calibrationService.loadCalibration();
        if (savedCalibration && this.calibrationService.isCalibrationValid()) {
            this.pixelsPerMm = savedCalibration.pixelsPerMm;
            this.cardWidthPx = savedCalibration.cardWidthPx;
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

    async ngAfterViewInit(): Promise<void> {
        console.log('CameraView ngAfterViewInit called');

        // Wait for MediaPipe to be ready if not already
        if (!this.isReady) {
            console.log('Waiting for MediaPipe to initialize...');
            // Wait up to 5 seconds for MediaPipe to initialize
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

    async detectCardAutomatically(): Promise<void> {
        if (!this.autoDetectCard || this.isDetectingCard || this.isCalibrated) {
            return;
        }

        this.isDetectingCard = true;

        try {
            if (this.videoElement && this.cardDetection.isReady()) {
                const card = await this.cardDetection.detectCard(this.videoElement.nativeElement);

                if (card) {
                    console.log('Card detected:', card);
                    this.detectedCard = card;

                    // Auto-calibrate with detected card width
                    this.cardWidthPx = card.width;
                    this.pixelsPerMm = this.calibrationService.pixelsPerMmFromCardWidth(card.width);
                    this.isCalibrated = true;

                    // Save calibration
                    this.calibrationService.saveCalibration({
                        pixelsPerMm: this.pixelsPerMm,
                        cardWidthPx: this.cardWidthPx,
                        deviceId: navigator.userAgent,
                        timestamp: Date.now()
                    });

                    console.log(`Auto-calibrated: ${this.pixelsPerMm.toFixed(2)} px/mm`);
                    this.cdr.markForCheck();
                } else {
                    this.detectedCard = null;
                }
            }
        } catch (error) {
            console.error('Auto card detection error:', error);
        } finally {
            this.isDetectingCard = false;

            // Try again in 2 seconds if not calibrated
            if (!this.isCalibrated && this.autoDetectCard) {
                setTimeout(() => this.detectCardAutomatically(), 2000);
            }
        }
    }

    calibrate(): void {
        if (!this.cardWidthPx || this.cardWidthPx <= 0) {
            alert('Veuillez entrer une largeur de carte valide en pixels');
            return;
        }

        try {
            this.pixelsPerMm = this.calibrationService.pixelsPerMmFromCardWidth(this.cardWidthPx);
            this.isCalibrated = true;

            // Save calibration
            this.calibrationService.saveCalibration({
                pixelsPerMm: this.pixelsPerMm,
                cardWidthPx: this.cardWidthPx,
                deviceId: navigator.userAgent,
                timestamp: Date.now()
            });

            this.cdr.markForCheck();
        } catch (error) {
            console.error('Calibration error:', error);
            alert('Erreur de calibration');
        }
    }

    private calculateMeasurement(pupils: { left: Point; right: Point }): Measurement {
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

        return {
            pdMm,
            pdLeftMm,
            pdRightMm,
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

        // Draw detected card rectangle if available
        if (this.detectedCard) {
            ctx.strokeStyle = 'rgba(0, 255, 0, 0.8)';
            ctx.lineWidth = 3;
            ctx.strokeRect(
                this.detectedCard.x,
                this.detectedCard.y,
                this.detectedCard.width,
                this.detectedCard.height
            );

            // Draw "CARTE DÉTECTÉE" label
            ctx.fillStyle = 'rgba(0, 255, 0, 0.9)';
            ctx.font = 'bold 16px Inter, Arial';
            ctx.fillText('✓ CARTE DÉTECTÉE', this.detectedCard.x, this.detectedCard.y - 10);
        }

        // Draw pupils
        ctx.fillStyle = 'rgba(0, 200, 0, 0.9)';
        ctx.beginPath();
        ctx.arc(pupils.left.x, pupils.left.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(pupils.right.x, pupils.right.y, 6, 0, Math.PI * 2);
        ctx.fill();

        // Draw line between pupils
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(pupils.left.x, pupils.left.y);
        ctx.lineTo(pupils.right.x, pupils.right.y);
        ctx.stroke();

        // Draw measurement text
        if (this.latestMeasurement) {
            ctx.fillStyle = '#fff';
            ctx.font = '16px Inter, Arial';
            ctx.fillText(`PD: ${this.latestMeasurement.pdMm.toFixed(1)} mm`, 10, 30);
            ctx.fillText(`PD L: ${this.latestMeasurement.pdLeftMm.toFixed(1)} mm`, 10, 55);
            ctx.fillText(`PD R: ${this.latestMeasurement.pdRightMm.toFixed(1)} mm`, 10, 80);
        }
    }
}
