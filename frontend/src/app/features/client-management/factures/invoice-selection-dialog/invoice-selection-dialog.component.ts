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
    @Inject(MAT_DIALOG_DATA) public data: { clientId: string },
    private factureService: FactureService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit() {
    console.log('InvoiceSelectionDialog initialized for client:', this.data.clientId);
    this.loadInvoices();
  }

  loadInvoices() {
    this.loading = true;
    console.log('Starting invoice load...');

    const failsafeTimeout = setTimeout(() => {
      console.error('FAILSAFE TIMEOUT TRIGGERED - Force stopping loader');
      this.loading = false;
      if (this.invoices.length === 0) {
        this.message = 'Délai d\'attente dépassé. Le serveur ne répond pas.';
      }
      this.cdr.detectChanges();
    }, 5000);

    this.factureService.findAll({
      clientId: this.data.clientId,
      type: 'FACTURE',
      // @ts-ignore
      _cb: new Date().getTime() // Cache buster
    }).pipe(
      timeout(10000),
      finalize(() => {
        console.log('Finalize called - stopping loader');
        clearTimeout(failsafeTimeout);
        this.loading = false;
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: (data: Facture[]) => {
        console.log('Invoices loaded:', data.length);
        clearTimeout(failsafeTimeout);
        // Only show invoices that can be paid (VALIDE or PARTIEL or BROUILLON)
        // PAYEE invoices usually don't need payment unless we allow overpayment or adjustments
        this.invoices = data.filter(f => f.statut === 'VALIDE' || f.statut === 'PARTIEL' || f.statut === 'BROUILLON');

        if (this.invoices.length === 0) {
          this.message = 'Aucune facture en attente de paiement (statut VALIDE, PARTIEL ou BROUILLON).';
        }
      },
      error: (err) => {
        console.error('Error loading invoices', err);
        clearTimeout(failsafeTimeout);
        if (err.name === 'TimeoutError') {
          this.message = 'Le serveur ne répond pas (Délai d\'attente dépassé). Veuillez réessayer.';
        } else {
          this.message = 'Erreur lors du chargement des factures. Vérifiez que le serveur est démarré.';
        }
      }
    });
  }

  select(invoice: any) {
    this.dialogRef.close(invoice);
  }
}
