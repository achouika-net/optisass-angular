import { Component, ElementRef, ViewChild, AfterViewInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
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
        <div *ngIf="error" class="error-overlay">
            <div class="error-content">
                <mat-icon color="warn">info</mat-icon>
                <span>{{ error }}</span>
            </div>
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
      overflow: hidden;
    }
    .video-container {
      width: 100%;
      height: 100%;
      display: flex;
      justify-content: center;
      align-items: center;
      position: relative;
      background: #000;
    }
    video {
      width: 100%;
      max-width: 100%;
      max-height: 60vh;
      object-fit: contain;
    }
    .hidden {
      display: none;
    }
    .error-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(0, 0, 0, 0.7);
        z-index: 10;
    }
    .error-content {
        color: white;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 16px;
        padding: 24px;
        background: rgba(50, 50, 50, 0.9);
        border-radius: 8px;
        text-align: center;
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

  constructor(
    public dialogRef: MatDialogRef<CameraCaptureDialogComponent>,
    private cdr: ChangeDetectorRef
  ) { }

  ngAfterViewInit() {
    this.initCamera();
  }

  ngOnDestroy() {
    this.stopStream();
  }

  async initCamera() {
    this.error = 'Recherche de caméras...';
    this.cdr.detectChanges();
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        throw new Error('L\'API MediaDevices n\'est pas supportée par ce navigateur (ou contexte non sécurisé/HTTP).');
      }

      // List cameras
      const devices = await navigator.mediaDevices.enumerateDevices();
      this.videoDevices = devices.filter(device => device.kind === 'videoinput');
      console.log('Video devices found:', this.videoDevices.length);

      if (this.videoDevices.length === 0) {
        this.error = 'Aucune caméra détectée.';
        this.cdr.detectChanges();
      }

      // Start stream
      await this.startStream();
    } catch (err: any) {
      console.error('Error accessing camera:', err);
      this.error = 'Erreur d\'accès caméra: ' + (err.message || err);
      this.cdr.detectChanges();
    }
  }

  async startStream() {
    this.stopStream(); // Stop any existing
    this.error = null;

    const constraints: MediaStreamConstraints = {
      video: this.videoDevices.length > 0 && this.videoDevices[this.currentDeviceIndex]?.deviceId
        ? { deviceId: { exact: this.videoDevices[this.currentDeviceIndex].deviceId } }
        : { facingMode: 'environment' }
    };

    try {
      console.log('Requesting stream with constraints:', constraints);
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.videoElement.nativeElement.srcObject = this.stream;
      console.log('Stream started:', this.stream.active);

      // Critical: Force update so template sees stream is not null
      this.cdr.detectChanges();
    } catch (err: any) {
      console.error('Stream error:', err);
      this.error = 'Impossible de démarrer la vidéo: ' + (err.message || err);
      this.cdr.detectChanges();
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
