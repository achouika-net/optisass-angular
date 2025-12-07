import { Component, OnInit, OnDestroy, ViewChild, ElementRef, Output, EventEmitter, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
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
export class CameraViewComponent implements OnInit, OnDestroy {
    @ViewChild('videoElement') videoElement!: ElementRef<HTMLVideoElement>;
    @ViewChild('overlayCanvas') overlayCanvas!: ElementRef<HTMLCanvasElement>;

    @Output() measurementChange = new EventEmitter<Measurement>();

    cardWidthPx: number = 0;
    pixelsPerMm: number | null = null;
    isCalibrated = false;
    isReady = false;
    latestMeasurement: Measurement | null = null;

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

    ngAfterViewInit(): void {
        if (this.isReady && this.videoElement) {
            setTimeout(() => {
                this.startCamera();
            }, 500);
        }
    }

    ngOnDestroy(): void {
        this.mpEngine.stop();
    }

    startCamera(): void {
        if (!this.videoElement) return;

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
