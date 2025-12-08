import { Component, ChangeDetectionStrategy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { CameraViewComponent } from '../camera-view/camera-view.component';
import { Measurement } from '../../models/measurement.model';

@Component({
    selector: 'app-virtual-centering-modal',
    standalone: true,
    imports: [
        CommonModule,
        MatDialogModule,
        MatButtonModule,
        MatIconModule,
        CameraViewComponent
    ],
    templateUrl: './virtual-centering-modal.component.html',
    styleUrls: ['./virtual-centering-modal.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class VirtualCenteringModalComponent {
    @ViewChild(CameraViewComponent) cameraView!: CameraViewComponent;

    currentMeasurement: Measurement | null = null;
    isCaptured = false;

    constructor(
        private dialogRef: MatDialogRef<VirtualCenteringModalComponent>
    ) { }

    onMeasurementChange(measurement: Measurement): void {
        this.currentMeasurement = measurement;
    }

    captureMeasurement(): void {
        if (this.cameraView) {
            this.cameraView.capture();
            this.isCaptured = true;
        }
    }

    retakeMeasurement(): void {
        if (this.cameraView) {
            this.cameraView.retake();
            this.isCaptured = false;
        }
    }

    validateMeasurement(): void {
        // If we are in capture mode, logic is simple: currentMeasurement is already maintained by CameraView
        // even during static editing.
        if (this.currentMeasurement) {
            this.dialogRef.close(this.currentMeasurement);
        }
    }

    cancel(): void {
        this.dialogRef.close(null);
    }
}
