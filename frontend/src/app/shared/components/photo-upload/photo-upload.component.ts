import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  linkedSignal,
  model,
  signal,
  viewChild,
} from '@angular/core';
import { FormValueControl } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ToastrService } from 'ngx-toastr';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import {
  captureVideoFrame,
  compressImage,
  isValidFileSize,
  isValidImageType,
  loadFileAsDataUrl,
} from './photo-upload.helper';

@Component({
  selector: 'app-photo-upload',
  templateUrl: './photo-upload.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule, MatButtonModule, MatTooltipModule, TranslateModule],
})
export class PhotoUploadComponent implements FormValueControl<File | string> {
  #toastr = inject(ToastrService);
  #translate = inject(TranslateService);
  #destroyRef = inject(DestroyRef);

  value = model<File | string>(null);

  previewUrl = linkedSignal<string | File, string>({
    source: () => this.value(),
    computation: (val) => {
      if (typeof val === 'string') return val;
      if (val instanceof File) {
        this.#loadFilePreview(val);
        return null;
      }
      return null;
    },
  });

  showCamera = signal(false);
  hasPhoto = computed(() => !!this.previewUrl());

  video = viewChild<ElementRef<HTMLVideoElement>>('video');

  constructor() {
    // Effect to manage camera lifecycle
    effect(() => {
      if (this.showCamera()) {
        this.#startCamera();
      } else {
        this.#stopCamera();
      }
    });

    // Cleanup on component destroy
    this.#destroyRef.onDestroy(() => {
      this.#stopCamera();
    });
  }

  async onPhotoSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files?.[0]) return;

    const file = input.files[0];

    if (!isValidImageType(file)) {
      this.#toastr.error(this.#translate.instant('error.invalidImageType'));
      return;
    }

    if (!isValidFileSize(file)) {
      this.#toastr.error(this.#translate.instant('error.fileSizeTooLarge'));
      return;
    }

    try {
      const originalDataUrl = await loadFileAsDataUrl(file);
      const compressedDataUrl = await compressImage(originalDataUrl);
      this.value.set(compressedDataUrl);
    } catch (error) {
      console.error('Error processing image:', error);
      this.#toastr.error(this.#translate.instant('error.imageProcessingFailed'));
    }
  }

  removePhoto(): void {
    this.showCamera.set(false);
    this.value.set(null);
  }

  openCamera(): void {
    this.showCamera.set(true);
  }

  async capturePhoto(): Promise<void> {
    const videoEl = this.video()?.nativeElement;
    if (!videoEl) return;

    try {
      const blob = await captureVideoFrame(videoEl);
      if (!blob) {
        this.#toastr.error(this.#translate.instant('error.capturePhotoFailed'));
        return;
      }

      const dataUrl = await loadFileAsDataUrl(blob);
      const compressedDataUrl = await compressImage(dataUrl);
      this.value.set(compressedDataUrl);
      this.closeCamera();
    } catch (error) {
      console.error('Error capturing photo:', error);
      this.#toastr.error(this.#translate.instant('error.capturePhotoFailed'));
    }
  }

  closeCamera(): void {
    this.showCamera.set(false);
  }

  async #startCamera(): Promise<void> {
    const videoEl = this.video()?.nativeElement;
    if (!videoEl) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
      });

      videoEl.srcObject = stream;
      videoEl.play();
    } catch (error) {
      console.error('Error accessing camera:', error);
      this.#toastr.error(this.#translate.instant('error.cameraAccessDenied'));
      this.showCamera.set(false);
    }
  }

  #stopCamera(): void {
    const videoEl = this.video()?.nativeElement;
    if (videoEl?.srcObject) {
      const stream = videoEl.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoEl.srcObject = null;
    }
  }

  #loadFilePreview(file: File): void {
    loadFileAsDataUrl(file)
      .then((dataUrl) => {
        this.previewUrl.set(dataUrl);
      })
      .catch((error) => {
        console.error('Error loading file preview:', error);
        this.#toastr.error(this.#translate.instant('error.imageProcessingFailed'));
      });
  }
}
