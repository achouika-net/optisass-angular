import { Component, ElementRef, ViewChild, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
    selector: 'app-camera-capture-dialog',
    standalone: true,
    imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
    template: `
    <h2 mat-dialog-title>Prendre une photo</h2>
    <mat-dialog-content class="camera-content">
      <div class="video-container">
        <video #video autoplay playsinline muted></video>
        <canvas #canvas class="hidden"></canvas>
        <div *ngIf="error" class="error-message">
            <mat-icon color="warn">error</mat-icon>
            {{ error }}
        </div>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="cancel()">Annuler</button>
      <button mat-icon-button (click)="switchCamera()" *ngIf="videoDevices.length > 1" title="Changer de caméra">
        <mat-icon>cameraswitch</mat-icon>
      </button>
      <button mat-raised-button color="primary" (click)="capture()" [disabled]="!stream">
        <mat-icon>camera</mat-icon> Capturer
      </button>
    </mat-dialog-actions>
  `,
    styles: [`
    .camera-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 300px;
      padding: 0;
      background: #000;
    }
    .video-container {
      width: 100%;
      height: 100%;
      display: flex;
      justify-content: center;
      align-items: center;
      position: relative;
    }
    video {
      width: 100%;
      max-width: 500px; /* Limit size */
      height: auto;
      border-radius: 4px;
    }
    .hidden {
      display: none;
    }
    .error-message {
        color: white;
        display: flex;
        align-items: center;
        gap: 8px;
    }
  `]
})
export class CameraCaptureDialogComponent implements AfterViewInit, OnDestroy {
    @ViewChild('video') videoElement!: ElementRef<HTMLVideoElement>;
    @ViewChild('canvas') canvasElement!: ElementRef<HTMLCanvasElement>;

    stream: MediaStream | null = null;
    error: string | null = null;
    videoDevices: MediaDeviceInfo[] = [];
    currentDeviceIndex = 0;

    constructor(public dialogRef: MatDialogRef<CameraCaptureDialogComponent>) { }

    ngAfterViewInit() {
        this.initCamera();
    }

    ngOnDestroy() {
        this.stopStream();
    }

    async initCamera() {
        try {
            // List cameras
            const devices = await navigator.mediaDevices.enumerateDevices();
            this.videoDevices = devices.filter(device => device.kind === 'videoinput');

            // Start stream
            await this.startStream();
        } catch (err) {
            console.error('Error accessing camera:', err);
            this.error = 'Impossible d\'accéder à la caméra. Vérifiez les permissions.';
        }
    }

    async startStream() {
        this.stopStream(); // Stop any existing
        this.error = null;

        const constraints: MediaStreamConstraints = {
            video: this.videoDevices.length > 0
                ? { deviceId: { exact: this.videoDevices[this.currentDeviceIndex].deviceId } }
                : { facingMode: 'environment' }
        };

        try {
            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.videoElement.nativeElement.srcObject = this.stream;
        } catch (err) {
            console.error('Stream error:', err);
            this.error = 'Erreur lors du démarrage du flux vidéo.';
        }
    }

    stopStream() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
    }

    switchCamera() {
        if (this.videoDevices.length > 1) {
            this.currentDeviceIndex = (this.currentDeviceIndex + 1) % this.videoDevices.length;
            this.startStream();
        }
    }

    capture() {
        if (!this.stream) return;

        const video = this.videoElement.nativeElement;
        const canvas = this.canvasElement.nativeElement;

        // Set canvas dimensions to match video
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        // Draw
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            // Get data URL
            const dataUrl = canvas.toDataURL('image/jpeg', 0.85); // 85% quality JPEG
            this.dialogRef.close(dataUrl);
        }
    }

    cancel() {
        this.dialogRef.close();
    }
}
