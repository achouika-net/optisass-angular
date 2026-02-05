import { Component, Input, Output, EventEmitter, OnInit, ViewChild, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FactureService, Facture } from '../../services/facture.service';
import { InvoiceSelectionDialogComponent } from '../../dialogs/invoice-selection-dialog/invoice-selection-dialog.component';
import { PaymentDialogComponent, Payment } from '../../dialogs/payment-dialog/payment-dialog.component';
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
    tiersCin?: string;
}

@Component({
    selector: 'app-payment-list',
    standalone: true,
    imports: [CommonModule, MatTableModule, MatButtonModule, MatIconModule, MatTabsModule],
    template: `
    <div class="payment-list-container">
      <mat-tab-group class="modern-tabs">
        <!-- TAB 1: Historique des Paiements -->
        <mat-tab>
          <ng-template mat-tab-label>
             <mat-icon class="mr-2">history</mat-icon> Historique des Paiements
          </ng-template>
          
          <div class="tab-content pt-4">
            <div class="header-actions">
              <h2>{{ ficheId ? 'Paiements de cette fiche' : 'Tous les paiements du client' }}</h2>
              <div class="action-buttons">
                  <button mat-stroked-button color="primary" (click)="printReceipt()" class="mr-2" *ngIf="dataSource.data.length > 0">
                    <mat-icon>print</mat-icon> Imprimer Reçu
                  </button>
                  <button mat-raised-button color="primary" (click)="createNewPayment()">
                    <mat-icon>add</mat-icon> Nouveau Paiement
                  </button>
              </div>
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
                  <th mat-header-cell *matHeaderCellDef> Facture / Document </th>
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

                <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
                <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
              </table>
              
              <div *ngIf="dataSource.data.length === 0" class="empty-state">
                   <mat-icon>payments</mat-icon>
                   <p>Aucun paiement enregistré.</p>
              </div>
            </div>
          </div>
        </mat-tab>

        <!-- TAB 2: Dettes et Impayés (Global Mode Only) -->
        <mat-tab *ngIf="!ficheId">
          <ng-template mat-tab-label>
             <mat-icon class="mr-2">monetization_on</mat-icon> Dettes et Impayés
          </ng-template>

          <div class="tab-content pt-4">
            <div class="header-actions">
              <h2>Documents avec reste à payer</h2>
              <div class="badge-count" *ngIf="impayes.length > 0">{{ impayes.length }} à régulariser</div>
            </div>

            <div class="modern-table-container">
              <table mat-table [dataSource]="impayesDataSource" class="mat-elevation-z0">
                  <!-- Numero Column -->
                  <ng-container matColumnDef="numero">
                      <th mat-header-cell *matHeaderCellDef> N° Document </th>
                      <td mat-cell *matCellDef="let element"> 
                          <span class="ref-bold">{{element.numero}}</span>
                          <span class="status-tag" [class]="element.statut.toLowerCase()">{{element.statut}}</span>
                      </td>
                  </ng-container>

                  <!-- Date Column -->
                  <ng-container matColumnDef="date">
                      <th mat-header-cell *matHeaderCellDef> Date </th>
                      <td mat-cell *matCellDef="let element"> {{element.dateEmission | date:'dd/MM/yyyy'}} </td>
                  </ng-container>

                  <!-- Total Column -->
                  <ng-container matColumnDef="total">
                      <th mat-header-cell *matHeaderCellDef> Total TTC </th>
                      <td mat-cell *matCellDef="let element"> {{element.totalTTC | number:'1.2-2'}} DH </td>
                  </ng-container>

                  <!-- Payé Column -->
                  <ng-container matColumnDef="paye">
                      <th mat-header-cell *matHeaderCellDef> Déjà Payé </th>
                      <td mat-cell *matCellDef="let element"> {{(element.totalTTC - element.resteAPayer) | number:'1.2-2'}} DH </td>
                  </ng-container>

                  <!-- Reste Column -->
                  <ng-container matColumnDef="reste">
                      <th mat-header-cell *matHeaderCellDef> Reste à Payer </th>
                      <td mat-cell *matCellDef="let element" class="text-danger font-bold"> {{element.resteAPayer | number:'1.2-2'}} DH </td>
                  </ng-container>

                  <!-- Actions Column -->
                  <ng-container matColumnDef="actions">
                      <th mat-header-cell *matHeaderCellDef> Actions </th>
                      <td mat-cell *matCellDef="let element">
                          <button mat-flat-button color="primary" size="small" (click)="payImpaye(element)">
                              <mat-icon>payment</mat-icon> Payer
                          </button>
                      </td>
                  </ng-container>

                  <tr mat-header-row *matHeaderRowDef="displayedColumnsImpayes"></tr>
                  <tr mat-row *matRowDef="let row; columns: displayedColumnsImpayes;"></tr>
              </table>

              <div *ngIf="impayes.length === 0" class="empty-state">
                   <mat-icon>check_circle</mat-icon>
                   <p>Aucun impayé pour ce client. Tout est en ordre !</p>
              </div>
            </div>
          </div>
        </mat-tab>
      </mat-tab-group>
    </div>

    <!-- PRINT RECEIPT TEMPLATE A5 -->
    <div class="print-receipt" *ngIf="printingPayment"> <!-- repurposed printingPayment as flag or holder for client info -->
        <div class="receipt-container">
            <div class="company-header">
                <h2>OPTISASS</h2>
                <p>Adresse de l'établissement - Ville, Maroc</p>
                <p>Tél: +212 X XX XX XX XX</p>
            </div>
            
            <div class="receipt-title">
                <h1>REÇU DE PAIEMENT</h1>
                <p class="receipt-ref">Date: {{ toDate | date:'dd/MM/yyyy HH:mm' }}</p>
            </div>

            <!-- Client Info -->
            <div class="info-grid">
                <div class="info-col">
                    <p><strong>Client:</strong> {{ clientName || 'Client' }}</p>
                    <p><strong>CIN:</strong> {{ clientCin || '-' }}</p>
                </div>
            </div>

            <hr class="divider">

            <!-- Payment History Table -->
            <div class="history-section">
                <table class="history-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Mode</th>
                            <th>Réf</th>
                            <th class="text-right">Montant</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr *ngFor="let p of dataSource.data">
                            <td>{{ p.date | date:'dd/MM/yyyy' }}</td>
                            <td>{{ getPaymentModeLabel(p.mode) }}</td>
                            <td>{{ p.reference || '-' }}</td>
                            <td class="text-right">{{ p.montant | number:'1.2-2' }} DH</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <!-- Financial Summary -->
            <div class="financial-summary">
                <div class="summary-row">
                    <span>Total Dossier:</span>
                    <span>{{ stats.totalTTC | number:'1.2-2' }} DH</span>
                </div>
                 <div class="summary-row">
                    <span>Total Payé:</span>
                    <span>{{ stats.totalPaye | number:'1.2-2' }} DH</span>
                </div>
                <div class="summary-row big-row">
                    <span>Reste à Payer:</span>
                    <span>{{ stats.resteAPayer | number:'1.2-2' }} DH</span>
                </div>
            </div>

            <div class="signatures">
                <div class="sig-box">
                    <p>Signature Client</p>
                </div>
                <div class="sig-box">
                    <p>Cachet et Signature</p>
                </div>
            </div>
            
            <div class="footer">
                <p>Merci de votre confiance !</p>
            </div>
        </div>
    </div>
  `,
    styles: [`
    /* PRINT STYLES */
    .print-receipt {
        display: none;
    }

    @media print {
        /* Hide everything else */
        .payment-list-container, 
        .modern-tabs,
        mat-tab-group,
        .header-actions,
        .modern-table-container {
            display: none !important;
        }

        .print-receipt {
            display: block !important;
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: white;
            padding: 10px; /* Smaller padding for A5 */
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            color: #000;
        }

        @page {
            size: A5 landscape; /* Or just A5. Using landscape as it usually fits tables well. */
            margin: 5mm;
        }

        .receipt-container {
            width: 100%;
            max-width: 100%;
            margin: 0;
            border: 2px solid #000;
            padding: 15px;
            box-sizing: border-box;
        }

        .company-header {
            text-align: center;
            border-bottom: 2px solid #000;
            padding-bottom: 10px;
            margin-bottom: 20px;
        }
        
        .company-header h2 {
            font-size: 18px;
            font-weight: bold;
            margin: 0 0 5px 0;
            text-transform: uppercase;
        }
        
        .receipt-title {
            text-align: center;
            margin-bottom: 20px;
        }

        .receipt-title h1 {
            font-size: 24px;
            font-weight: bold;
            margin: 0;
            border: 2px solid #000;
            display: inline-block;
            padding: 5px 20px;
        }

        .info-grid {
            display: flex;
            justify-content: space-between;
            margin-bottom: 20px;
            font-size: 14px;
        }

        .divider {
            border: 0;
            border-top: 1px solid #000;
            margin: 15px 0;
        }

        .current-payment-box {
            background: #f0f0f0;
            border: 1px solid #000;
            padding: 15px;
            text-align: center;
            margin-bottom: 20px;
            -webkit-print-color-adjust: exact;
        }

        .current-payment-box .label {
            font-size: 14px;
            font-weight: bold;
            text-transform: uppercase;
        }

        .current-payment-box .amount {
            font-size: 24px;
            font-weight: bold;
            margin-top: 5px;
        }

        .history-section h3 {
            font-size: 16px;
            border-bottom: 1px solid #000;
            padding-bottom: 5px;
            margin-bottom: 10px;
        }

        .history-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
            margin-bottom: 20px;
        }
        
        .history-table th {
            border-bottom: 1px solid #000;
            text-align: left;
            padding: 5px;
        }

        .history-table td {
            border-bottom: 1px dotted #ccc;
            padding: 5px;
        }
        
        .text-right { text-align: right; }

        .financial-summary {
            float: right;
            width: 50%;
            border: 1px solid #000;
            padding: 10px;
            margin-bottom: 30px;
        }

        .summary-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 5px;
            font-size: 14px;
        }

        .summary-row.big-row {
            font-weight: bold;
            font-size: 16px;
            border-top: 1px solid #000;
            padding-top: 5px;
            margin-top: 5px;
        }

        .signatures {
            clear: both;
            display: flex;
            justify-content: space-between;
            margin-top: 100px;
        }

        .sig-box {
            width: 200px;
            text-align: center;
            border-top: 1px solid #000;
            padding-top: 5px;
            font-weight: bold;
            font-size: 12px;
        }

        .footer {
            text-align: center;
            font-size: 10px;
            margin-top: 30px;
            font-style: italic;
        }
    }

    .payment-list-container {
        padding: 0;
    }
    .modern-tabs {
        background: white;
        border-radius: 8px;
    }
    .tab-content {
        padding: 16px 20px 20px 20px;
    }
    .badge-count {
        background: #fee2e2;
        color: #991b1b;
        padding: 4px 12px;
        border-radius: 20px;
        font-size: 13px;
        font-weight: 600;
    }
    .impayes-section {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 20px;
        margin-bottom: 32px;
    }
    .mr-2 { margin-right: 8px; }
    .pt-4 { padding-top: 16px; }

    .status-tag {
        font-size: 10px;
        padding: 2px 6px;
        border-radius: 4px;
        text-transform: uppercase;
        font-weight: 600;
        margin-left: 8px;
    }
    .status-tag.valide { background: #dcfce7; color: #166534; }
    .status-tag.vente_en_instance { background: #fef9c3; color: #854d0e; }
    .status-tag.archive { background: #f1f5f9; color: #475569; }
    .status-tag.partiel { background: #ffedd5; color: #9a3412; }

    .mb-6 { margin-bottom: 24px; }
    .text-danger { color: #ef4444; }
    .font-bold { font-weight: 600; }
    .ref-bold { font-weight: 600; color: #1e293b; }
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
    impayesDataSource = new MatTableDataSource<Facture>([]);
    impayes: Facture[] = []; // For visibility check
    displayedColumns: string[] = ['date', 'facture', 'montant', 'mode', 'reference', 'details', 'actions'];
    displayedColumnsImpayes: string[] = ['numero', 'date', 'total', 'paye', 'reste', 'actions'];

    printingPayment: PaymentRow | null = null;
    stats = { totalTTC: 0, totalPaye: 0, resteAPayer: 0 };
    clientName: string = '';
    clientCin: string = '';
    toDate = new Date(); // Used for header date in global print

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

        // Don't load payments for new fiches (not yet created)
        // But DO load when ficheId is undefined (Client Detail global view)
        if (this.ficheId === 'new') {
            this.dataSource.data = [];
            this.impayes = [];
            this.impayesDataSource.data = [];
            return;
        }

        // Fetch ALL types (Facture + Devis) to show full payment history
        // Pass ficheId to ensure we find documents even if center association is mismatched
        this.factureService.findAll({ clientId: this.clientId, ficheId: this.ficheId || undefined }).subscribe(factures => {
            // Filter fiches by ficheId if provided
            const isFicheMode = !!this.ficheId;
            const filteredFactures = isFicheMode
                ? factures.filter(f => f.ficheId === this.ficheId)
                : factures;

            // 1. Setup Impayés (Global View only)
            if (!isFicheMode) {
                console.log('$$$ [PaymentList] Filtering Debts from', factures.length, 'invoices.');
                this.impayes = factures.filter(f => {
                    // [MODIFIED] Include ALL types (Facture, Devis, Order, BL) that have a debt
                    // as long as they are not cancelled.
                    const isCancelled = f.statut === 'ANNULEE';

                    // [DEBUG] Ensure resteAPayer is treated as number
                    const reste = typeof f.resteAPayer === 'string' ? parseFloat(f.resteAPayer) : (f.resteAPayer || 0);
                    const hasDebt = reste > 0.05; // Tolerance for float precision

                    return !isCancelled && hasDebt;
                });
                console.log('$$$ [PaymentList] Final Impayes:', this.impayes.length);
                this.impayesDataSource.data = this.impayes;
            } else {
                this.impayes = [];
                this.impayesDataSource.data = [];
            }

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

            // Calculate Stats for Receipt
            this.calculateStats(filteredFactures);
        });
    }

    calculateStats(factures: Facture[]) {
        let totalTTC = 0;
        let totalPaye = 0;

        // Recalculate based on visible payments for 'Total Paid'
        // This ensures the "Total Payé" matches the sum of the rows in the receipt
        if (this.dataSource.data.length > 0) {
            totalPaye = this.dataSource.data.reduce((acc, p) => acc + (p.montant || 0), 0);

            // Get Client Info from first payment if available
            const firstP = this.dataSource.data[0];
            this.clientName = firstP.tiersNom || '';
            this.clientCin = firstP.tiersCin || '';
        }

        factures.forEach(f => {
            if (f.statut !== 'ANNULEE' && f.statut !== 'DEVIS_SANS_PAIEMENT' && f.type !== 'BON_COMM' && f.type !== 'AVOIR') {
                totalTTC += f.totalTTC || 0;
            }
        });

        this.stats = {
            totalTTC: totalTTC,
            totalPaye: totalPaye,
            resteAPayer: Math.max(0, totalTTC - totalPaye)
        };
    }

    printReceipt() {
        // Create a dummy payment object for the template to bind to
        // If we have payments, use the first one's client details
        const firstP = this.dataSource.data.length > 0 ? this.dataSource.data[0] : null;

        this.printingPayment = {
            id: 'RELEVE',
            date: new Date(), // Use Date object, not string
            montant: this.stats.totalPaye,
            // User requested "Total Payé" revision.
            // If I set this, the "MONTANT REÇU" box will show Total Payé.
            // If the user wants a STATEMENT, showing "Total Payé" in the big box is acceptable.
            mode: 'GLOBAL',
            factureNumero: 'VARIOS',
            factureId: 'GLOBAL', // Dummy ID
            tiersNom: firstP?.tiersNom || this.clientName || 'Client',
            tiersCin: firstP?.tiersCin || this.clientCin || '',
            // ... satisfy other required props if any
        } as PaymentRow;

        // However, I removed the "current-payment-box" in the A5 template in Step 6096?
        // Let's check Step 6096 replacement content...
        // Yes, I REMOVED <div class="current-payment-box"> in 6096.
        // So `printingPayment.montant` is NOT used in the A5 template anymore?
        // Wait, let's verify.
        // Step 6096 template:
        // <div class="print-receipt" *ngIf="printingPayment">
        // ...
        // <div class="info-grid">...</div>
        // <hr class="divider">
        // <div class="history-section">...</div>
        // <div class="financial-summary">...</div>
        // It does NOT contain the "MONTANT REÇU" box. It shows the history and financial summary.
        // So `printingPayment` is mainly used as a trigger (*ngIf="printingPayment") and for Client Info.

        this.toDate = new Date();
        setTimeout(() => {
            window.print();
        }, 100);
    }

    payImpaye(item: Facture) {
        this.openPaymentForm(item);
    }

    createNewPayment() {
        // 1. Select Invoice
        const dialogRef = this.dialog.open(InvoiceSelectionDialogComponent, {
            width: '1000px',
            maxWidth: '95vw',
            data: {
                clientId: this.clientId,
                ficheId: this.ficheId // Pass context!
            }
        });

        dialogRef.afterClosed().subscribe((facture: Facture) => {
            if (facture) {
                // Check if invoice is already paid
                // if (facture.statut === 'PAYEE') {
                //     this.snackBar.open('Cette facture est déjà payée.', 'OK', { duration: 3000 });
                //     return;
                // }

                // 2. Open Payment Dialog
                this.openPaymentForm(facture);
            }
        });
    }

    openPaymentForm(facture: Facture) {
        const resteAPayer = facture.resteAPayer || (facture.totalTTC - (facture.paiements?.reduce((sum: number, p: any) => sum + p.montant, 0) || 0));

        const dialogRef = this.dialog.open(PaymentDialogComponent, {
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

    printPayment(payment: PaymentRow) {
        this.printingPayment = payment;
        // Wait for change detection to render the print section
        setTimeout(() => {
            window.print();
            // Optional: reset after print. kept simple for now or use window.onafterprint if needed
            // But usually keeping it doesn't hurt as it is hidden via CSS in non-print
            // For cleaner state:
            // this.printingPayment = null; 
            // Note: If we null it immediately, print preview might lose content in some browsers.
            // Better to leave it or clear on next interaction.
            // Let's clear it with a delay long enough for the print dialog to capture it?
            // Actually, window.print() is blocking in many browsers but not all.
            // Safer to leave it set until next print or destruction.
        }, 100);
    }
}
