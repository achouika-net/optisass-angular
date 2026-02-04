import { Component, OnInit, Input, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { MatTabsModule } from '@angular/material/tabs';
import { HttpClient } from '@angular/common/http';
import { FactureService } from '../../services/facture.service';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { InvoiceSelectionDialogComponent } from '../../dialogs/invoice-selection-dialog/invoice-selection-dialog.component';
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
        MatSnackBarModule,
        MatTabsModule
    ],
    templateUrl: './facture-list.component.html',
    styleUrls: ['./facture-list.component.scss']
})
export class FactureListComponent implements OnInit {
    @Input() clientId: string | null = null;
    dataSource: any[] = [];
    filteredDataSource: any[] = [];
    activeReportTab = 'VALIDATED';

    constructor(
        private factureService: FactureService,
        private snackBar: MatSnackBar,
        private dialog: MatDialog,
        private router: Router,
        private cdr: ChangeDetectorRef,
        private zone: NgZone
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
        const filters: any = {};
        if (this.clientId) filters.clientId = this.clientId;

        this.factureService.findAll(filters).subscribe({
            next: (data: any[]) => {
                this.zone.run(() => {
                    this.dataSource = data.filter(f => f.type !== 'AVOIR');
                    this.applyFilter();
                    this.cdr.markForCheck();
                });
            },
            error: (err: any) => console.error('Error loading factures', err)
        });
    }

    applyFilter() {
        switch (this.activeReportTab) {
            case 'DEVIS_SANS_PAIEMENT':
                this.filteredDataSource = this.dataSource.filter(f =>
                    f.type === 'DEVIS' &&
                    (f.statut === 'DEVIS_SANS_PAIEMENT' || f.statut === 'DEVIS_EN_COURS' || f.statut === 'BROUILLON') &&
                    (!f.paiements || f.paiements.length === 0)
                );
                break;
            case 'VENTE_EN_INSTANCE':
                this.filteredDataSource = this.dataSource.filter(f =>
                    f.statut === 'VENTE_EN_INSTANCE' ||
                    (f.type === 'DEVIS' && f.paiements && f.paiements.length > 0)
                );
                break;
            case 'VALIDATED':
                this.filteredDataSource = this.dataSource.filter(f =>
                    f.type === 'FACTURE' &&
                    (f.statut === 'VALIDE' || f.statut === 'PAYEE' || f.statut === 'PARTIEL')
                );
                break;
            default:
                this.filteredDataSource = this.dataSource;
        }
    }

    onTabChange(event: any) {
        const tabs = ['VALIDATED', 'VENTE_EN_INSTANCE', 'DEVIS_SANS_PAIEMENT'];
        this.activeReportTab = tabs[event.index];
        this.applyFilter();
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
            case 'VALIDE':
            case 'VALIDEE': return 'accent';
            case 'ANNULEE': return 'warn';
            case 'PARTIEL': return 'accent';
            case 'DEVIS_EN_COURS': return 'default';
            case 'DEVIS_SANS_PAIEMENT': return 'warn';
            case 'VENTE_EN_INSTANCE': return 'accent';
            case 'ARCHIVE': return 'warn';
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

    openExchangeDialog(facture: any) {
        // Dynamically import the dialog component
        import('../../dialogs/invoice-return-dialog/invoice-return-dialog.component').then(m => {
            const dialogRef = this.dialog.open(m.InvoiceReturnDialogComponent, {
                width: '800px',
                maxWidth: '95vw',
                data: { facture: facture }
            });

            dialogRef.afterClosed().subscribe(result => {
                if (result) {
                    const itemsWithReason = result.items.map((it: any) => ({
                        ...it,
                        reason: result.reason
                    }));

                    // result contains: { reason: string, items: [...] }
                    this.factureService.exchangeInvoice(facture.id, itemsWithReason).subscribe({
                        next: (response) => {
                            this.snackBar.open(
                                `Échange effectué. Avoir: ${response.avoir.numero}, Nouvelle facture: ${response.newInvoice.numero}`,
                                'Fermer',
                                { duration: 5000 }
                            );
                            this.loadFactures();
                        },
                        error: (err) => {
                            console.error('Error processing exchange:', err);
                            this.snackBar.open(
                                err.error?.message || 'Erreur lors de l\'échange',
                                'Fermer',
                                { duration: 3000 }
                            );
                        }
                    });
                }
            });
        });
    }

    canExchange(facture: any): boolean {
        // Only allow exchange for validated/paid invoices
        return facture.type === 'FACTURE' &&
            (facture.statut === 'VALIDE' || facture.statut === 'PAYEE' || facture.statut === 'PARTIEL');
    }

    printFacture(facture: any) {
        this.router.navigate(['/p/clients/factures', facture.id], { queryParams: { mode: 'view' } });
    }

    printList() {
        window.print();
    }
}
