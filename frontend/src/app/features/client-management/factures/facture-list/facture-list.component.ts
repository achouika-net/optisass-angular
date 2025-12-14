import { Component, OnInit, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { HttpClient } from '@angular/common/http';
import { FactureService } from '../../services/facture.service';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { InvoiceSelectionDialogComponent } from '../invoice-selection-dialog/invoice-selection-dialog.component';
import { Router } from '@angular/router';

@Component({
    selector: 'app-facture-list',
    standalone: true,
    imports: [
        CommonModule,
        RouterModule,
        MatTableModule,
        MatButtonModule,
        MatIconModule,
        MatChipsModule,
        MatMenuModule,
        MatDividerModule,
        MatSnackBarModule
    ],
    templateUrl: './facture-list.component.html',
    styleUrls: ['./facture-list.component.scss']
})
export class FactureListComponent implements OnInit {
    @Input() clientId: string | null = null;
    displayedColumns: string[] = ['numero', 'type', 'dateEmission', 'client', 'statut', 'totalTTC', 'actions'];
    dataSource: any[] = []; // Replace with Invoice interface

    constructor(
        private factureService: FactureService,
        private snackBar: MatSnackBar,
        private dialog: MatDialog,
        private router: Router
    ) { }

    ngOnInit(): void {
        this.loadFactures();
    }

    createAvoir() {
        if (!this.clientId) return;

        const dialogRef = this.dialog.open(InvoiceSelectionDialogComponent, {
            width: '1000px', // Increased width
            maxWidth: '95vw',
            data: { clientId: this.clientId }
        });

        dialogRef.afterClosed().subscribe(invoice => {
            if (invoice) {
                this.router.navigate(['/p/clients/factures/new'], {
                    queryParams: {
                        clientId: this.clientId,
                        type: 'AVOIR',
                        sourceFactureId: invoice.id
                    }
                });
            }
        });
    }

    loadFactures() {
        if (this.clientId) {
            this.factureService.findAll({ clientId: this.clientId }).subscribe({
                next: (data: any[]) => this.dataSource = data,
                error: (err: any) => console.error('Error loading factures', err)
            });
        } else {
            this.factureService.findAll().subscribe({
                next: (data: any[]) => this.dataSource = data,
                error: (err: any) => console.error('Error loading factures', err)
            });
        }
    }

    deleteFacture(facture: any) {
        let confirmMessage = `Êtes-vous sûr de vouloir supprimer la facture ${facture.numero} ?`;

        if (facture.statut === 'ANNULEE') {
            confirmMessage = `⚠️ ATTENTION: Cette facture est ANNULÉE.\n\nLa suppression d'une facture annulée supprime définitivement l'historique.\nCeci ne devrait être fait que pour nettoyer la base de données de test.\n\nÊtes-vous absolument sûr de vouloir supprimer ${facture.numero} ?`;
        } else if (facture.statut !== 'BROUILLON') {
            confirmMessage += `\n\nSi c'est une facture validée, un AVOIR sera généré automatiquement.`;
        }

        if (confirm(confirmMessage)) {
            this.factureService.delete(facture.id).subscribe({
                next: (res: any) => {
                    if (res && res.action === 'AVOIR_CREATED') {
                        this.snackBar.open(`Facture annulée. Avoir ${res.avoir.numero} généré.`, 'Fermer', { duration: 5000 });
                    } else {
                        this.snackBar.open('Facture supprimée définitivement', 'Fermer', { duration: 3000 });
                    }
                    this.loadFactures();
                },
                error: (err: any) => {
                    console.error('Error deleting facture', err);
                    this.snackBar.open(err.error?.message || 'Erreur lors de la suppression', 'Fermer', { duration: 3000 });
                }
            });
        }
    }

    getStatusColor(statut: string): string {
        switch (statut) {
            case 'PAYEE': return 'primary';
            case 'BROUILLON': return 'warn';
            case 'VALIDEE': return 'accent';
            case 'ANNULEE': return 'warn';
            case 'PARTIEL': return 'accent';
            default: return 'default';
        }
    }

    canEdit(facture: any): boolean {
        return facture.statut === 'BROUILLON';
    }

    canDelete(facture: any): boolean {
        // Allow deletion of all invoices (with warnings for cancelled ones)
        return true;
    }
}
