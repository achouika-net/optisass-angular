import { Component, Inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { FactureService, Facture } from '../../services/facture.service';
import { timeout, finalize, catchError } from 'rxjs/operators';
import { of, throwError } from 'rxjs';

@Component({
  selector: 'app-invoice-selection-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatTableModule, MatButtonModule, MatIconModule],
  template: `
    <h2 mat-dialog-title>Sélectionner une facture à payer</h2>
    <mat-dialog-content>
      <div class="modern-table-container">
          <div *ngIf="loading" class="loading-state">
              Chargement des factures...
          </div>

          <table mat-table [dataSource]="invoices" class="mat-elevation-z0" *ngIf="!loading && invoices.length > 0">
            <!-- Numero Column -->
            <ng-container matColumnDef="numero">
              <th mat-header-cell *matHeaderCellDef> Numéro </th>
              <td mat-cell *matCellDef="let element"> {{element.numero}} </td>
            </ng-container>

            <!-- Date Column -->
            <ng-container matColumnDef="date">
              <th mat-header-cell *matHeaderCellDef> Date </th>
              <td mat-cell *matCellDef="let element"> {{element.dateEmission | date:'dd/MM/yyyy'}} </td>
            </ng-container>

            <!-- Total Column -->
            <ng-container matColumnDef="total">
              <th mat-header-cell *matHeaderCellDef> Reste à Payer </th>
              <td mat-cell *matCellDef="let element"> {{element.resteAPayer | number:'1.2-2'}} DH </td>
            </ng-container>

            <!-- Status Column -->
             <ng-container matColumnDef="status">
              <th mat-header-cell *matHeaderCellDef> Statut </th>
              <td mat-cell *matCellDef="let element"> 
                  <span [class]="'badge badge-' + element.statut.toLowerCase()">{{element.statut}}</span>
              </td>
            </ng-container>

            <!-- Action Column -->
            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef> </th>
              <td mat-cell *matCellDef="let element">
                <button mat-stroked-button color="primary" (click)="select(element)">
                  Sélectionner
                </button>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
          </table>

          <div *ngIf="!loading && invoices.length === 0" class="empty-state">
              <mat-icon>info</mat-icon>
              <p>{{message}}</p>
          </div>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Annuler</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .modern-table-container {
        width: 100%;
        max-height: 500px;
        overflow: auto;
    }
    table {
        width: 100%;
    }
    .empty-state {
        padding: 2rem;
        text-align: center;
        color: #64748b;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1rem;
    }
  `]
})
export class InvoiceSelectionDialogComponent implements OnInit {
  invoices: Facture[] = [];
  displayedColumns: string[] = ['numero', 'date', 'total', 'status', 'actions'];
  loading = false;
  message = '';

  constructor(
    private dialogRef: MatDialogRef<InvoiceSelectionDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { clientId: string, ficheId?: string },
    private factureService: FactureService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit() {
    console.log('InvoiceSelectionDialog initialized for client:', this.data.clientId);
    this.loadInvoices();
  }

  loadInvoices() {
    this.loading = true;
    console.log('Starting invoice load context:', this.data.ficheId ? 'Fiche ' + this.data.ficheId : 'Global');

    const failsafeTimeout = setTimeout(() => {
      console.log('failsafe stop');
      this.loading = false;
      this.cdr.detectChanges();
    }, 5000);

    this.factureService.findAll({
      clientId: this.data.clientId
    }).pipe(
      finalize(() => {
        clearTimeout(failsafeTimeout);
        this.loading = false;
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: (data: Facture[]) => {
        // Filter: We want documents with debt.
        // Statut: VALIDE, PARTIEL, BROUILLON (for direct pay), VENTE_EN_INSTANCE (for instance sales), ARCHIVE
        const allPayables = data.filter(f =>
          (f.resteAPayer || 0) > 0 &&
          (f.statut === 'VALIDE' || f.statut === 'PARTIEL' || f.statut === 'VENTE_EN_INSTANCE' || f.statut === 'BROUILLON' || f.statut === 'ARCHIVE')
        );

        // If ficheId is provided, focus ONLY on that fiche's documents
        if (this.data.ficheId) {
          this.invoices = allPayables.filter(f => f.ficheId === this.data.ficheId);

          // UX optimization: If there's exactly one payable for this fiche, auto-select it!
          if (this.invoices.length === 1) {
            console.log('Auto-selecting unique invoice for fiche:', this.invoices[0].numero);
            this.select(this.invoices[0]);
            return;
          }
        } else {
          this.invoices = allPayables;
        }

        if (this.invoices.length === 0) {
          this.message = this.data.ficheId
            ? 'Aucune dette trouvée pour ce dossier.'
            : 'Aucune facture ou vente en instance avec un reste à payer.';
        }
      },
      error: (err) => {
        console.error('Error loading invoices', err);
        this.message = 'Erreur lors du chargement des factures.';
      }
    });
  }

  select(invoice: any) {
    this.dialogRef.close(invoice);
  }
}
