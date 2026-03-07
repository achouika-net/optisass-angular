import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ToastrService } from 'ngx-toastr';
import { IParseResult, ISupplierInvoice } from '@app/models';
import { SupplierInvoiceParser } from '../../parsers/supplier-invoice.parser';
import { IOcrUploadDialogData, IOcrUploadResult } from '../../models';

@Component({
  selector: 'app-ocr-upload-dialog',
  templateUrl: './ocr-upload-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    MatProgressSpinnerModule,
    TranslateModule,
  ],
  providers: [SupplierInvoiceParser],
})
export class OcrUploadDialogComponent implements OnInit {
  readonly #dialogRef = inject(MatDialogRef<OcrUploadDialogComponent, IOcrUploadResult | null>);
  readonly #data = inject<IOcrUploadDialogData | null>(MAT_DIALOG_DATA, { optional: true });
  readonly #parser = inject(SupplierInvoiceParser);
  readonly #toastr = inject(ToastrService);
  readonly #translate = inject(TranslateService);
  readonly #destroyRef = inject(DestroyRef);

  readonly isProcessing = signal(false);
  readonly selectedFile = signal<File | null>(null);
  readonly previewUrl = signal<string | null>(null);

  #isDestroyed = false;

  constructor() {
    this.#destroyRef.onDestroy(() => {
      this.#isDestroyed = true;
    });
  }

  ngOnInit(): void {
    if (this.#data?.file) {
      this.selectedFile.set(this.#data.file);
      this.#loadPreview(this.#data.file);
    }
  }

  /**
   * Handles file selection from input.
   * @param event File input change event
   */
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.[0]) return;

    const file = input.files[0];
    if (!this.#isValidFile(file)) {
      this.#toastr.error(this.#translate.instant('stock.entry.ocr.invalidFileType'));
      return;
    }

    this.selectedFile.set(file);
    this.#loadPreview(file);
  }

  /**
   * Handles file drop from drag and drop.
   * @param event Drop event
   */
  onFileDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();

    const file = event.dataTransfer?.files[0];
    if (!file) return;

    if (!this.#isValidFile(file)) {
      this.#toastr.error(this.#translate.instant('stock.entry.ocr.invalidFileType'));
      return;
    }

    this.selectedFile.set(file);
    this.#loadPreview(file);
  }

  /**
   * Prevents default drag over behavior.
   * @param event Drag event
   */
  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
  }

  /**
   * Processes the selected file with OCR.
   */
  async processFile(): Promise<void> {
    const file = this.selectedFile();
    if (!file) return;

    this.isProcessing.set(true);

    try {
      const result: IParseResult<ISupplierInvoice> = await this.#parser.parse(file);
      const validation = this.#parser.validate(result.data);

      if (!validation.isValid) {
        const errorMessages = validation.errors.map((e) => e.message).join(', ');
        this.#toastr.warning(
          this.#translate.instant('stock.entry.ocr.validationWarnings', { errors: errorMessages }),
        );
      }

      this.#dialogRef.close({
        invoice: result.data,
        confidence: result.confidence,
        warnings: result.warnings,
      });
    } catch (error) {
      console.error('OCR processing error:', error);
      this.#toastr.error(this.#translate.instant('stock.entry.ocr.processingError'));
      this.isProcessing.set(false);
    }
  }

  /**
   * Cancels and closes the dialog.
   */
  cancel(): void {
    this.#dialogRef.close(null);
  }

  /**
   * Removes the selected file.
   */
  removeFile(): void {
    this.selectedFile.set(null);
    this.previewUrl.set(null);
  }

  /**
   * Validates file type.
   */
  #isValidFile(file: File): boolean {
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    return validTypes.includes(file.type);
  }

  /**
   * Loads file preview for images.
   * @param file File to preview
   */
  #loadPreview(file: File): void {
    if (!file.type.startsWith('image/')) {
      this.previewUrl.set(null);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      if (!this.#isDestroyed) {
        this.previewUrl.set(e.target?.result as string);
      }
    };
    reader.readAsDataURL(file);
  }
}
