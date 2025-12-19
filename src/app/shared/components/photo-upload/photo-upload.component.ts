import { ChangeDetectionStrategy, Component, model, linkedSignal } from '@angular/core';
import { FormValueControl } from '@angular/forms/signals';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-photo-upload',
  templateUrl: './photo-upload.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule, MatButtonModule],
})
export class PhotoUploadComponent implements FormValueControl<File | string> {
  value = model<File | string>(null);

  // Derives preview URL from value, handles async File reading via writable linkedSignal
  previewUrl = linkedSignal({
    source: () => this.value(),
    computation: (val) => {
      if (typeof val === 'string') return val;
      if (val instanceof File) {
        // FileReader is async, so we update via the writable signal
        this.#loadFilePreview(val);
        return null; // Return null initially, will be updated async
      }
      return null;
    },
  });

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (file) {
      this.value.set(file);
      // Reset input value to allow re-uploading the same file
      input.value = '';
    }
  }

  removePhoto(): void {
    this.value.set(null);
  }

  #loadFilePreview(file: File): void {
    const reader = new FileReader();
    reader.onload = () => {
      this.previewUrl.set(reader.result as string);
    };
    reader.readAsDataURL(file);
  }
}
