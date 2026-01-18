import { Component, ChangeDetectionStrategy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatListModule } from '@angular/material/list';
import { MatDividerModule } from '@angular/material/divider';
import { ISupplierInvoice, IParseResult } from '@optisaas/opti-saas-lib';
import { SupplierInvoiceParser } from '../../parsers/supplier-invoice.parser';

/**
 * Component for testing invoice OCR parsing.
 * Allows uploading an invoice image and displays extracted data.
 */
@Component({
  selector: 'app-invoice-upload',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatCardModule,
    MatChipsModule,
    MatExpansionModule,
    MatListModule,
    MatDividerModule,
  ],
  template: `
    <mat-card>
      <mat-card-header>
        <mat-card-title>Test OCR Facture Fournisseur</mat-card-title>
        <mat-card-subtitle>Upload une image de facture pour tester l'extraction</mat-card-subtitle>
      </mat-card-header>

      <mat-card-content>
        <div class="upload-zone" (drop)="onDrop($event)" (dragover)="onDragOver($event)">
          <input
            type="file"
            #fileInput
            (change)="onFileSelected($event)"
            accept="image/jpeg,image/png,image/webp,image/tiff"
            hidden
          />

          @if (!isProcessing()) {
            <mat-icon class="upload-icon">cloud_upload</mat-icon>
            <p>Glissez une image ici ou</p>
            <button mat-raised-button color="primary" (click)="fileInput.click()">
              Sélectionner un fichier
            </button>
          } @else {
            <mat-spinner diameter="48"></mat-spinner>
            <p>Analyse en cours...</p>
          }
        </div>

        @if (error()) {
          <div class="error-message">
            <mat-icon>error</mat-icon>
            {{ error() }}
          </div>
        }

        @if (result()) {
          <div class="results">
            <div class="stats">
              <mat-chip-set>
                <mat-chip [class.low-confidence]="result()!.confidence < 0.7">
                  Confiance: {{ (result()!.confidence * 100).toFixed(0) }}%
                </mat-chip>
                <mat-chip> Temps: {{ result()!.processingTime.toFixed(0) }}ms </mat-chip>
                <mat-chip [class.invalid]="!validation()?.isValid">
                  {{ validation()?.isValid ? 'Valide' : 'Invalide' }}
                </mat-chip>
              </mat-chip-set>
            </div>

            @if (result()!.warnings.length > 0) {
              <mat-expansion-panel>
                <mat-expansion-panel-header>
                  <mat-panel-title>
                    <mat-icon>warning</mat-icon>
                    Avertissements ({{ result()!.warnings.length }})
                  </mat-panel-title>
                </mat-expansion-panel-header>
                <mat-list>
                  @for (warning of result()!.warnings; track warning) {
                    <mat-list-item>{{ warning }}</mat-list-item>
                  }
                </mat-list>
              </mat-expansion-panel>
            }

            @if (validation() && !validation()!.isValid) {
              <mat-expansion-panel>
                <mat-expansion-panel-header>
                  <mat-panel-title>
                    <mat-icon>error</mat-icon>
                    Erreurs de validation ({{ validation()!.errors.length }})
                  </mat-panel-title>
                </mat-expansion-panel-header>
                <mat-list>
                  @for (err of validation()!.errors; track err.field) {
                    <mat-list-item>
                      <strong>{{ err.field }}:</strong> {{ err.message }}
                    </mat-list-item>
                  }
                </mat-list>
              </mat-expansion-panel>
            }

            <mat-expansion-panel expanded>
              <mat-expansion-panel-header>
                <mat-panel-title>Données extraites</mat-panel-title>
              </mat-expansion-panel-header>

              <div class="data-section">
                <h4>Informations générales</h4>
                <mat-list>
                  <mat-list-item>
                    <strong>N° Facture:</strong> {{ invoice()?.invoiceNumber || 'Non trouvé' }}
                  </mat-list-item>
                  <mat-list-item>
                    <strong>Date:</strong> {{ formatDate(invoice()?.invoiceDate) }}
                  </mat-list-item>
                  <mat-list-item>
                    <strong>Échéance:</strong> {{ formatDate(invoice()?.dueDate) }}
                  </mat-list-item>
                  <mat-list-item>
                    <strong>Devise:</strong> {{ invoice()?.currency }}
                  </mat-list-item>
                </mat-list>
              </div>

              <mat-divider></mat-divider>

              <div class="data-section">
                <h4>Fournisseur</h4>
                <mat-list>
                  <mat-list-item>
                    <strong>Nom:</strong> {{ invoice()?.supplier?.name || 'Non trouvé' }}
                  </mat-list-item>
                  <mat-list-item>
                    <strong>ICE:</strong> {{ invoice()?.supplier?.ice || 'Non trouvé' }}
                  </mat-list-item>
                  <mat-list-item>
                    <strong>IF:</strong> {{ invoice()?.supplier?.fiscalId || 'Non trouvé' }}
                  </mat-list-item>
                  <mat-list-item>
                    <strong>RC:</strong> {{ invoice()?.supplier?.tradeRegister || 'Non trouvé' }}
                  </mat-list-item>
                </mat-list>
              </div>

              <mat-divider></mat-divider>

              <div class="data-section">
                <h4>Lignes ({{ invoice()?.lines?.length || 0 }})</h4>
                @if (invoice()?.lines?.length) {
                  <table class="lines-table">
                    <thead>
                      <tr>
                        <th>Réf</th>
                        <th>Désignation</th>
                        <th>Qté</th>
                        <th>PU HT</th>
                        <th>Total HT</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (line of invoice()?.lines; track $index) {
                        <tr>
                          <td>{{ line.reference || '-' }}</td>
                          <td>{{ line.designation }}</td>
                          <td>{{ line.quantity }} {{ line.unit || '' }}</td>
                          <td>{{ line.unitPriceHT | number: '1.2-2' }}</td>
                          <td>{{ line.totalHT | number: '1.2-2' }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                } @else {
                  <p>Aucune ligne détectée</p>
                }
              </div>

              <mat-divider></mat-divider>

              <div class="data-section">
                <h4>Totaux</h4>
                <mat-list>
                  <mat-list-item>
                    <strong>Total HT:</strong>
                    {{ invoice()?.totals?.totalHT | number: '1.2-2' }} {{ invoice()?.currency }}
                  </mat-list-item>
                  <mat-list-item>
                    <strong>TVA:</strong>
                    {{ invoice()?.totals?.totalVAT | number: '1.2-2' }} {{ invoice()?.currency }}
                  </mat-list-item>
                  <mat-list-item>
                    <strong>Total TTC:</strong>
                    {{ invoice()?.totals?.totalTTC | number: '1.2-2' }} {{ invoice()?.currency }}
                  </mat-list-item>
                </mat-list>
              </div>
            </mat-expansion-panel>

            <mat-expansion-panel>
              <mat-expansion-panel-header>
                <mat-panel-title>Texte brut (OCR)</mat-panel-title>
              </mat-expansion-panel-header>
              <pre class="raw-text">{{ invoice()?.rawText }}</pre>
            </mat-expansion-panel>
          </div>
        }
      </mat-card-content>
    </mat-card>
  `,
  styles: `
    :host {
      display: block;
      padding: 16px;
      max-width: 900px;
      margin: 0 auto;
    }

    .upload-zone {
      border: 2px dashed #ccc;
      border-radius: 8px;
      padding: 40px;
      text-align: center;
      margin-bottom: 16px;
      transition: border-color 0.2s;

      &:hover {
        border-color: #1976d2;
      }
    }

    .upload-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      color: #666;
    }

    .error-message {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #f44336;
      padding: 16px;
      background: #ffebee;
      border-radius: 4px;
      margin-bottom: 16px;
    }

    .stats {
      margin-bottom: 16px;
    }

    .low-confidence {
      background-color: #ff9800 !important;
    }

    .invalid {
      background-color: #f44336 !important;
      color: white !important;
    }

    .data-section {
      padding: 16px 0;

      h4 {
        margin: 0 0 8px 0;
        color: #666;
      }
    }

    .lines-table {
      width: 100%;
      border-collapse: collapse;

      th,
      td {
        padding: 8px;
        text-align: left;
        border-bottom: 1px solid #eee;
      }

      th {
        background: #f5f5f5;
        font-weight: 500;
      }
    }

    .raw-text {
      white-space: pre-wrap;
      word-break: break-word;
      background: #f5f5f5;
      padding: 16px;
      border-radius: 4px;
      font-size: 12px;
      max-height: 300px;
      overflow: auto;
    }

    mat-expansion-panel {
      margin-bottom: 8px;
    }
  `,
})
export class InvoiceUploadComponent {
  readonly #parser = inject(SupplierInvoiceParser);

  readonly isProcessing = signal(false);
  readonly error = signal<string | null>(null);
  readonly result = signal<IParseResult<ISupplierInvoice> | null>(null);

  readonly invoice = computed(() => this.result()?.data ?? null);
  readonly validation = computed(() => {
    const data = this.invoice();
    return data ? this.#parser.validate(data) : null;
  });

  /**
   * Handles file selection from input.
   * @param event File input change event
   */
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      this.processFile(input.files[0]);
    }
  }

  /**
   * Handles file drop.
   * @param event Drop event
   */
  onDrop(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer?.files?.length) {
      this.processFile(event.dataTransfer.files[0]);
    }
  }

  /**
   * Handles drag over.
   * @param event Drag event
   */
  onDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  /**
   * Processes the uploaded file.
   * @param file Image file to process
   */
  async processFile(file: File): Promise<void> {
    this.isProcessing.set(true);
    this.error.set(null);
    this.result.set(null);

    try {
      const parseResult = await this.#parser.parse(file);
      this.result.set(parseResult);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Processing failed');
    } finally {
      this.isProcessing.set(false);
    }
  }

  /**
   * Formats a date for display.
   * @param date Date to format
   * @returns Formatted date string
   */
  formatDate(date: Date | null | undefined): string {
    if (!date) return 'Non trouvé';
    return new Date(date).toLocaleDateString('fr-FR');
  }
}
