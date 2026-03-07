import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ToastrService } from 'ngx-toastr';
import { DeviceCapabilitiesService } from '@app/core/services';

@Component({
  selector: 'app-camera-capture-dialog',
  templateUrl: './camera-capture-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    MatProgressSpinnerModule,
    TranslateModule,
  ],
})
export class CameraCaptureDialogComponent {
  readonly #dialogRef = inject(MatDialogRef<CameraCaptureDialogComponent, File | null>);
  readonly #deviceCapabilities = inject(DeviceCapabilitiesService);
  readonly #toastr = inject(ToastrService);
  readonly #translate = inject(TranslateService);
  readonly #destroyRef = inject(DestroyRef);

  readonly videoElement = viewChild<ElementRef<HTMLVideoElement>>('videoElement');
  readonly canvasElement = viewChild<ElementRef<HTMLCanvasElement>>('canvasElement');

  readonly isLoading = signal(true);
  readonly hasError = signal(false);
  readonly capturedImage = signal<string | null>(null);

  readonly #mediaStream = signal<MediaStream | null>(null);
  #isDestroyed = false;

  constructor() {
    this.#destroyRef.onDestroy(() => {
      this.#isDestroyed = true;
      this.#stopCamera();
    });

    void this.#requestCameraAccess();

    effect(() => {
      const video = this.videoElement()?.nativeElement;
      const stream = this.#mediaStream();

      untracked(() => {
        if (video && stream && !this.#isDestroyed) {
          this.#attachStreamToVideo(video, stream);
        }
      });
    });
  }

  /**
   * Requests camera access and stores the stream.
   */
  async #requestCameraAccess(): Promise<void> {
    const stream = await this.#deviceCapabilities.requestCameraAccess('environment');

    if (this.#isDestroyed) {
      this.#deviceCapabilities.stopMediaStream(stream);
      return;
    }

    if (!stream) {
      this.hasError.set(true);
      this.isLoading.set(false);
      this.#toastr.error(this.#translate.instant('commun.cameraAccessDenied'));
      return;
    }

    this.#mediaStream.set(stream);
  }

  /**
   * Attaches the media stream to the video element.
   * @param video The video HTML element
   * @param stream The media stream to attach
   */
  #attachStreamToVideo(video: HTMLVideoElement, stream: MediaStream): void {
    if (video.srcObject === stream) return;

    video.srcObject = stream;
    video.onloadedmetadata = () => {
      if (!this.#isDestroyed) {
        void video.play();
        this.isLoading.set(false);
      }
    };
  }

  /**
   * Stops all tracks of the current media stream.
   */
  #stopCamera(): void {
    this.#deviceCapabilities.stopMediaStream(this.#mediaStream());
    this.#mediaStream.set(null);
  }

  /**
   * Captures a photo from the video stream using canvas.
   */
  capturePhoto(): void {
    const video = this.videoElement()?.nativeElement;
    const canvas = this.canvasElement()?.nativeElement;

    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    this.capturedImage.set(canvas.toDataURL('image/jpeg', 0.9));
  }

  /**
   * Clears the captured image to allow retaking the photo.
   */
  retakePhoto(): void {
    this.capturedImage.set(null);
  }

  /**
   * Confirms the captured photo and closes the dialog with the File result.
   */
  confirmPhoto(): void {
    const imageData = this.capturedImage();
    if (!imageData) return;

    const file = this.#dataUrlToFile(imageData, `photo_${Date.now()}.jpg`);
    this.#dialogRef.close(file);
  }

  /**
   * Cancels the capture and closes the dialog without result.
   */
  cancel(): void {
    this.#dialogRef.close(null);
  }

  /**
   * Converts a data URL to a File object.
   * @param dataUrl The base64 data URL string
   * @param filename The desired filename for the File
   * @returns File object containing the image data
   */
  #dataUrlToFile(dataUrl: string, filename: string): File {
    const arr = dataUrl.split(',');
    const mimeMatch = arr[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);

    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }

    return new File([u8arr], filename, { type: mime });
  }
}
