import { Component, Input, Output, EventEmitter, OnInit, ViewChild, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FactureService, Facture } from '../../services/facture.service';
import { InvoiceSelectionDialogComponent } from '../../factures/invoice-selection-dialog/invoice-selection-dialog.component';
import { PaymentDialogComponent, Payment } from '../../factures/payment-dialog/payment-dialog.component';
import { PaiementService, CreatePaiementDto } from '../../services/paiement.service';

interface PaymentRow {
    id?: string; // Payment ID if available, or generated
    date: Date;
    montant: number;
    mode: string;
    reference?: string;
    notes?: string;
    factureNumero: string;
    factureId: string;
    resteAPayer?: number;
    // New fields
    dateVersement?: Date | string;
    banque?: string;
    remarque?: string;
    tiersNom?: string;
}

@Component({
    selector: 'app-payment-list',
    standalone: true,
    imports: [CommonModule, MatTableModule, MatButtonModule, MatIconModule],
    template: `
    <div class="payment-list-container">
      <div class="header-actions">
        <h2>{{ ficheId ? 'Paiements de cette fiche' : 'Historique des Paiements' }}</h2>
        <button mat-raised-button color="primary" (click)="createNewPayment()">
          <mat-icon>add</mat-icon> Nouveau Paiement
        </button>
      </div>

      <div class="modern-table-container">
        <table mat-table [dataSource]="dataSource" class="mat-elevation-z0">
          
          <!-- Date Column -->
          <ng-container matColumnDef="date">
            <th mat-header-cell *matHeaderCellDef> Date </th>
            <td mat-cell *matCellDef="let element"> {{element.date | date:'dd/MM/yyyy'}} </td>
          </ng-container>

          <!-- Facture Column -->
          <ng-container matColumnDef="facture">
            <th mat-header-cell *matHeaderCellDef> Facture </th>
            <td mat-cell *matCellDef="let element"> {{element.factureNumero}} </td>
          </ng-container>

          <!-- Montant Column -->
          <ng-container matColumnDef="montant">
            <th mat-header-cell *matHeaderCellDef> Montant </th>
            <td mat-cell *matCellDef="let element"> {{element.montant | number:'1.2-2'}} DH </td>
          </ng-container>

          <!-- Mode Column -->
          <ng-container matColumnDef="mode">
            <th mat-header-cell *matHeaderCellDef> Mode </th>
            <td mat-cell *matCellDef="let element"> 
                <span class="badge badge-gray">{{ getPaymentModeLabel(element.mode) }}</span>
            </td>
          </ng-container>

          <!-- Reference Column -->
          <ng-container matColumnDef="reference">
            <th mat-header-cell *matHeaderCellDef> Réf / Banque </th>
            <td mat-cell *matCellDef="let element"> 
                <div>{{element.reference || '-'}}</div>
                <div *ngIf="element.banque" class="sub-text">{{element.banque}}</div>
            </td>
          </ng-container>

          <!-- Emetteur / Versement -->
          <ng-container matColumnDef="details">
            <th mat-header-cell *matHeaderCellDef> Émetteur / Versement </th>
            <td mat-cell *matCellDef="let element">
                <div *ngIf="element.tiersNom" class="text-bold">{{element.tiersNom}}</div>
                <div *ngIf="element.dateVersement" class="sub-text">Versé le: {{element.dateVersement | date:'dd/MM/yyyy'}}</div>
            </td>
          </ng-container>

          <!-- Actions Column -->
          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef> Actions </th>
            <td mat-cell *matCellDef="let element">
                <button mat-icon-button color="primary" *ngIf="element.pieceJointe" (click)="viewAttachment(element.pieceJointe)" title="Voir la pièce jointe">
                    <mat-icon>visibility</mat-icon>
                </button>
                <button mat-icon-button color="warn" (click)="deletePayment(element)" title="Supprimer le paiement">
                    <mat-icon>delete</mat-icon>
                </button>
            </td>
          </ng-container>

          <!-- Actions Column -->

          <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
        </table>
        
        <div *ngIf="dataSource.data.length === 0" class="empty-state">
             <mat-icon>payments</mat-icon>
             <p>Aucun paiement enregistré.</p>
        </div>
      </div>
    </div>
  `,
    styles: [`
    .payment-list-container {
        padding: 20px;
    }
    .header-actions {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
    }
    .modern-table-container {
        background: white;
        border-radius: 8px;
        overflow: hidden;
        border: 1px solid #e2e8f0;
    }
    table {
        width: 100%;
    }
    th {
        background-color: #f8fafc;
        color: #475569;
        font-weight: 500;
        text-transform: uppercase;
        font-size: 12px;
        letter-spacing: 0.5px;
        padding: 16px;
    }
    td {
        padding: 16px;
        border-bottom: 1px solid #e2e8f0;
        color: #1e293b;
    }
    .badge {
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 500;
    }
    .badge-gray {
        background-color: #f1f5f9;
        color: #475569;
    }
    .empty-state {
        padding: 40px;
        text-align: center;
        color: #94a3b8;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 16px;
        gap: 16px;
    }
    .sub-text {
        font-size: 11px;
        color: #64748b;
    }
    .text-bold {
        font-weight: 500;
    }
    .wrap-text {
        max-width: 150px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .empty-state mat-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
    }
    .text-success {
        color: #10b981;
        font-weight: 600;
    }
    .text-warning {
        color: #f59e0b;
        font-weight: 600;
    }
  `]
})
export class PaymentListComponent implements OnInit {
    @Input() clientId!: string;
    @Input() ficheId?: string; // Optional: filter payments by fiche
    @Output() paymentAdded = new EventEmitter<void>();
    dataSource = new MatTableDataSource<PaymentRow>([]);
    displayedColumns: string[] = ['date', 'facture', 'montant', 'mode', 'reference', 'details', 'actions'];

    constructor(
        private factureService: FactureService,
        private paiementService: PaiementService,
        private dialog: MatDialog,
        private snackBar: MatSnackBar
    ) { }

    ngOnInit() {
        this.loadPayments();
    }

    ngOnChanges(changes: SimpleChanges) {
        if (changes['clientId'] && this.clientId) {
            this.loadPayments();
        }
        if (changes['ficheId']) {
            this.loadPayments();
        }
    }

    loadPayments() {
        if (!this.clientId) return;

        this.factureService.findAll({ clientId: this.clientId, type: 'FACTURE' }).subscribe(factures => {
            // Filter factures by ficheId if provided
            const filteredFactures = this.ficheId
                ? factures.filter(f => f.ficheId === this.ficheId)
                : factures;

            const allPayments: PaymentRow[] = [];

            filteredFactures.forEach(facture => {
                if (facture.paiements && Array.isArray(facture.paiements)) {
                    facture.paiements.forEach((p: any) => {
                        allPayments.push({
                            ...p,
                            factureNumero: facture.numero,
                            factureId: facture.id,
                            resteAPayer: facture.resteAPayer || 0
                        });
                    });
                }
            });

            // Sort by date desc
            allPayments.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            this.dataSource.data = allPayments;
        });
    }

    createNewPayment() {
        // 1. Select Invoice
        const dialogRef = this.dialog.open(InvoiceSelectionDialogComponent, {
            width: '1000px',
            maxWidth: '95vw',
            data: { clientId: this.clientId }
        });

        dialogRef.afterClosed().subscribe((facture: Facture) => {
            if (facture) {
                // Check if invoice is already paid
                if (facture.statut === 'PAYEE') {
                    this.snackBar.open('Cette facture est déjà payée.', 'OK', { duration: 3000 });
                    return;
                }

                // 2. Open Payment Dialog
                this.openPaymentForm(facture);
            }
        });
    }

    openPaymentForm(facture: Facture) {
        const resteAPayer = facture.resteAPayer || (facture.totalTTC - (facture.paiements?.reduce((sum: number, p: any) => sum + p.montant, 0) || 0));

        const dialogRef = this.dialog.open(PaymentDialogComponent, {
            width: '800px',
            maxWidth: '90vw',
            data: {
                resteAPayer: resteAPayer
            }
        });

        dialogRef.afterClosed().subscribe((payment: Payment) => {
            if (payment) {
                this.savePayment(facture, payment);
            }
        });
    }

    savePayment(facture: Facture, payment: Payment) {
        const payload: CreatePaiementDto = {
            factureId: facture.id,
            montant: payment.montant,
            mode: payment.mode,
            date: payment.date ? payment.date.toISOString() : new Date().toISOString(),
            reference: payment.reference,
            notes: payment.notes,
            // New fields
            dateVersement: payment.dateVersement ? (typeof payment.dateVersement === 'string' ? payment.dateVersement : payment.dateVersement.toISOString()) : undefined,
            banque: payment.banque,
            remarque: payment.remarque,
            tiersNom: payment.tiersNom,
            tiersCin: payment.tiersCin,
            pieceJointe: payment.pieceJointe
        };

        this.paiementService.create(payload).subscribe({
            next: () => {
                this.snackBar.open('Paiement enregistré avec succès', 'Fermer', { duration: 3000 });
                this.loadPayments(); // Reload list
                this.paymentAdded.emit();
            },
            error: (err) => {
                console.error('Error saving payment', err);
                this.snackBar.open('Erreur lors de l\'enregistrement du paiement', 'Fermer', { duration: 3000 });
            }
        });
    }

    viewAttachment(base64Content: string) {
        if (!base64Content) return;

        // Open image in new window
        const win = window.open('');
        if (win) {
            win.document.write(`<img src="${base64Content}" style="max-width: 100%; height: auto;">`);
        }
    }

    deletePayment(payment: PaymentRow) {
        if (confirm('Êtes-vous sûr de vouloir supprimer ce paiement ?')) {
            if (payment.id) {
                this.paiementService.delete(payment.id).subscribe({
                    next: () => {
                        this.snackBar.open('Paiement supprimé', 'Fermer', { duration: 3000 });
                        this.loadPayments();
                        this.paymentAdded.emit();
                    },
                    error: (err: any) => {
                        console.error('Error deleting payment', err);
                        this.snackBar.open('Erreur lors de la suppression', 'Fermer', { duration: 3000 });
                    }
                });
            }
        }
    }

    getPaymentModeLabel(mode: string): string {
        const modes: any = {
            'ESPECES': 'Espèces',
            'CARTE': 'Carte',
            'CHEQUE': 'Chèque',
            'VIREMENT': 'Virement',
            'AUTRE': 'Autre'
        };
        return modes[mode] || mode;
    }
}
