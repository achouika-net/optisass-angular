import {
  ChangeDetectionStrategy,
  Component,
  forwardRef,
  signal,
  inject,
  ChangeDetectorRef,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-photo-upload',
  imports: [MatIconModule, MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => PhotoUploadComponent),
      multi: true,
    },
  ],
  template: `
    <div class="flex flex-col items-center gap-2">
      <div
        class="relative flex h-32 w-32 items-center justify-center rounded-full border-2 border-gray-300 overflow-hidden bg-gray-100"
      >
        @if (previewUrl()) {
        <img [src]="previewUrl()" alt="Profile photo" class="h-full w-full object-cover" />
        } @else {
        <mat-icon class="text-6xl text-gray-400">account_circle</mat-icon>
        }
      </div>
      <div class="flex gap-2">
        <button mat-icon-button type="button" (click)="fileInput.click()" [disabled]="disabled()">
          <mat-icon>{{ previewUrl() ? 'edit' : 'upload' }}</mat-icon>
        </button>
        @if (previewUrl()) {
        <button mat-icon-button type="button" (click)="removePhoto()" [disabled]="disabled()">
          <mat-icon>photo_camera</mat-icon>
        </button>
        }
      </div>
      <input
        #fileInput
        type="file"
        accept="image/*"
        class="hidden"
        (change)="onFileSelected($event)"
      />
    </div>
  `,
})
export class PhotoUploadComponent implements ControlValueAccessor {
  #cdr = inject(ChangeDetectorRef);

  previewUrl = signal<string | null>(null);
  disabled = signal(false);

  onChange: (value: File | null) => void = () => {};
  onTouched: () => void = () => {};

  writeValue(value: File | string | null): void {
    if (typeof value === 'string') {
      this.previewUrl.set(value);
    } else if (value instanceof File) {
      this.createPreviewUrl(value);
    } else {
      this.previewUrl.set(null);
    }
    this.#cdr.markForCheck();
  }

  registerOnChange(fn: (value: File | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (file) {
      this.createPreviewUrl(file);
      this.onChange(file);
      this.onTouched();
    }
  }

  removePhoto(): void {
    this.previewUrl.set(null);
    this.onChange(null);
    this.onTouched();
  }

  private createPreviewUrl(file: File): void {
    const reader = new FileReader();
    reader.onload = () => {
      this.previewUrl.set(reader.result as string);
      this.#cdr.markForCheck();
    };
    reader.readAsDataURL(file);
  }
}
