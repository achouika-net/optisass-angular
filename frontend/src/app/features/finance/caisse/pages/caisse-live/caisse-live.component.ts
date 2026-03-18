import { Component, OnInit, OnDestroy, ChangeDetectorRef, NgZone, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatTableDataSource } from '@angular/material/table';
import { MatNativeDateModule } from '@angular/material/core';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { JourneeCaisseService } from '../../services/journee-caisse.service';
import { OperationCaisseService } from '../../services/operation-caisse.service';
import { OperationFormDialogComponent } from '../../components/operation-form-dialog/operation-form-dialog.component';
import { JourneeResume, OperationCaisse, OperationType, TypeOperation } from '../../models/caisse.model';
import { interval, Subscription, EMPTY, forkJoin, of } from 'rxjs';
import { switchMap, catchError, timeout, finalize } from 'rxjs/operators';

@Component({
    selector: 'app-caisse-live',
    standalone: true,
    imports: [
        CommonModule,
        MatCardModule,
        MatButtonModule,
        MatIconModule,
        MatTableModule,
        MatDialogModule,
        MatProgressSpinnerModule,
        MatSnackBarModule,
        MatChipsModule,
        MatFormFieldModule,
        MatSelectModule,
        MatDatepickerModule,
        MatNativeDateModule,
        MatInputModule,
        FormsModule,
        MatPaginatorModule
    ],
    templateUrl: './caisse-live.component.html',
    styleUrls: ['./caisse-live.component.scss'],
})
export class CaisseLiveComponent implements OnInit, OnDestroy {
    journeeId: string | null = null;
    resume: JourneeResume | null = null;
    operations: OperationCaisse[] = [];
    dataSource = new MatTableDataSource<OperationCaisse>([]);
    @ViewChild(MatPaginator) set paginator(mp: MatPaginator) {
        if (mp) {
            this.dataSource.paginator = mp;
        }
    }
    loading = true;
    errorLoading = false;
    refreshSubscription?: Subscription;

    selectedPeriod: string = 'today';
    startDate: Date | null = null;
    endDate: Date | null = null;
    activeFilterInfo: string = 'Aujourd\'hui';

    displayedColumns: string[] = ['date', 'type', 'montant', 'moyen', 'reference', 'motif', 'utilisateur', 'actions'];
    protected readonly OperationType = OperationType;

    // Filters
    filterType: string = '';
    filterMoyen: string = '';
    filterMotif: string = '';
    filterUser: string = '';

    uniqueMoyens: string[] = [];
    uniqueMotifs: string[] = [];
    uniqueUsers: string[] = [];

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private journeeService: JourneeCaisseService,
        private operationService: OperationCaisseService,
        private dialog: MatDialog,
        private snackBar: MatSnackBar,
        private cdr: ChangeDetectorRef,
        private zone: NgZone
    ) { }

    ngOnInit(): void {
        // Setup custom filter logic
        this.dataSource.filterPredicate = (data: OperationCaisse, filter: string) => {
            const searchTerms = JSON.parse(filter);
            const matchType = !searchTerms.type || data.type === searchTerms.type;
            const matchMoyen = !searchTerms.moyen || data.moyenPaiement === searchTerms.moyen;
            const matchMotif = !searchTerms.motif || this.cleanMotif(data.motif || '') === searchTerms.motif;
            const matchUser = !searchTerms.user || this.getUserName(data) === searchTerms.user;
            return matchType && matchMoyen && matchMotif && matchUser;
        };

        this.route.params.subscribe((params) => {
            this.journeeId = params['id'];
            if (this.journeeId) {
                this.setPeriod('today');
                this.startAutoRefresh();
            }
        });
    }

    setPeriod(period: string): void {
        const now = new Date();
        const start = new Date();
        const end = new Date();

        switch (period) {
            case 'all':
                // Instead of null which restricts to current session, use an infinite date range to fetch all caisse history
                start.setFullYear(2000, 0, 1);
                start.setHours(0, 0, 0, 0);
                end.setFullYear(2099, 11, 31);
                end.setHours(23, 59, 59, 999);
                this.startDate = start;
                this.endDate = end;
                this.activeFilterInfo = 'Historique complet (Caisse)';
                this.loadData();
                return;
            case 'today':
                start.setHours(0, 0, 0, 0);
                end.setHours(23, 59, 59, 999);
                this.activeFilterInfo = 'Aujourd\'hui';
                break;
            case 'yesterday':
                start.setDate(now.getDate() - 1);
                start.setHours(0, 0, 0, 0);
                end.setDate(now.getDate() - 1);
                end.setHours(23, 59, 59, 999);
                this.activeFilterInfo = 'Hier';
                break;
            case 'thisMonth':
                start.setDate(1);
                start.setHours(0, 0, 0, 0);
                end.setHours(23, 59, 59, 999);
                this.activeFilterInfo = 'Ce mois';
                break;
            case 'custom':
                this.activeFilterInfo = 'Période personnalisée';
                return;
            default:
                break;
        }

        this.startDate = start;
        this.endDate = end;
        this.loadData();
    }

    onCustomDateChange(): void {
        if (this.startDate && this.endDate) {
            // Normalize custom dates
            this.startDate.setHours(0, 0, 0, 0);
            this.endDate.setHours(23, 59, 59, 999);
            this.loadData();
        }
    }

    applyFilters(): void {
        this.dataSource.filter = JSON.stringify({
            type: this.filterType,
            moyen: this.filterMoyen,
            motif: this.filterMotif,
            user: this.filterUser
        });
        if (this.dataSource.paginator) {
            this.dataSource.paginator.firstPage();
        }
    }

    clearFilters(): void {
        this.filterType = '';
        this.filterMoyen = '';
        this.filterMotif = '';
        this.filterUser = '';
        this.applyFilters();
    }

    ngOnDestroy(): void {
        if (this.refreshSubscription) {
            this.refreshSubscription.unsubscribe();
        }
    }

    loadData(): void {
        if (!this.journeeId) return;

        this.zone.run(() => {
            this.loading = true;
            this.errorLoading = false;
            this.cdr.markForCheck();

            const startStr = this.startDate ? this.startDate.toISOString() : undefined;
            const endStr = this.endDate ? this.endDate.toISOString() : undefined;

            console.log('[CaisseLive] Loading with:', { startStr, endStr });

            forkJoin({
                resume: this.journeeService.getResume(this.journeeId!, startStr, endStr),
                operations: this.operationService.findByJournee(this.journeeId!, startStr, endStr)
            }).pipe(
                timeout(15000),
                catchError(err => {
                    console.error('[CaisseLive] Load failed:', err);
                    this.errorLoading = true;
                    return of({ resume: this.resume, operations: this.operations });
                }),
                finalize(() => {
                    this.loading = false;
                    this.cdr.markForCheck();
                    this.cdr.detectChanges();
                })
            ).subscribe((res: any) => {
                if (res.resume) this.resume = res.resume;
                if (res.operations) {
                    this.operations = res.operations;
                    this.dataSource.data = this.operations;
                    if (this.paginator && this.dataSource.paginator !== this.paginator) {
                        this.dataSource.paginator = this.paginator;
                    }
                    this.extractFilterOptions(this.operations);
                    this.applyFilters(); // Re-apply existing filters on data reload
                }
                this.cdr.markForCheck();
                this.cdr.detectChanges();
            });
        });
    }

    private extractFilterOptions(ops: OperationCaisse[]): void {
        const moyens = new Set<string>();
        const motifs = new Set<string>();
        const users = new Set<string>();

        ops.forEach(op => {
            if (op.moyenPaiement) moyens.add(op.moyenPaiement);
            const cleanedMotif = this.cleanMotif(op.motif || '');
            if (cleanedMotif && cleanedMotif !== '-') motifs.add(cleanedMotif);
            const userName = this.getUserName(op);
            if (userName && userName !== '-') users.add(userName);
        });

        this.uniqueMoyens = Array.from(moyens).sort();
        this.uniqueMotifs = Array.from(motifs).sort();
        this.uniqueUsers = Array.from(users).sort();
    }

    getUserName(op: any): string {
        if (op.user && (op.user.prenom || op.user.nom)) {
            return `${op.user.prenom || ''} ${op.user.nom || ''}`.trim();
        }
        if (op.utilisateur && op.utilisateur.trim() !== '') {
            return op.utilisateur.trim();
        }
        return 'Système';
    }

    cleanMotif(motif: string): string {
        if (!motif) return '-';
        let cleaned = motif.trim();
        
        if (cleaned.includes('Paiement:')) {
            if (cleaned.includes('Fact-') || cleaned.toLowerCase().includes('facture')) return 'Paiement Facture';
            if (cleaned.includes('BC-') || cleaned.toLowerCase().includes('bon de commande')) return 'Paiement BC';
            if (cleaned.includes('BL-') || cleaned.toLowerCase().includes('bon de livraison')) return 'Paiement BL';
            return 'Paiement Divers';
        }
        return cleaned;
    }

    cleanReference(op: any): string {
        let ref = '';
        if (op.facture?.numero) {
            ref = op.facture.numero;
        } else if (op.reference) {
            ref = op.reference;
        }
        if (!ref) return '-';

        // Nettoyage des préfixes redondants "Fac: ", "FAC " uniquement s'ils sont des mots entiers ou au début
        ref = ref.replace(/^Fac:\s*/i, '').replace(/\bFAC\b\s*/i, '').trim();

        // Détection des doublons exacts accidentels ex: "Fact-2/2026Fact-2/2026"
        const half = ref.length / 2;
        if (ref.length % 2 === 0 && ref.substring(0, half) === ref.substring(half)) {
            ref = ref.substring(0, half);
        }

        return ref;
    }

    private formatDateForApi(date: Date | null): string | undefined {
        if (!date) return undefined;
        const d = new Date(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    startAutoRefresh(): void {
        this.refreshSubscription = interval(30000)
            .pipe(
                switchMap(() => {
                    if (this.journeeId && this.resume) {
                        this.loadData(); // Trigger full reload every 30s
                        return of(null);
                    }
                    return EMPTY;
                })
            )
            .subscribe();
    }

    openOperationDialog(type: OperationType): void {
        if (!this.journeeId || !this.resume) return;

        if (this.resume.journee.statut === 'FERMEE') {
            this.snackBar.open('La caisse est fermée', 'OK', { duration: 3000 });
            return;
        }

        const dialogRef = this.dialog.open(OperationFormDialogComponent, {
            width: '500px',
            data: {
                journeeId: this.journeeId,
                type: type,
                caisseType: this.resume?.journee?.caisse?.type,
                availableBalances: {
                    ESPECES: this.getSolde(),
                    CARTE: this.resume?.recettesDetails?.carte || 0,
                    CHEQUE: this.resume?.recettesDetails?.cheque || 0
                }
            },
        });

        dialogRef.afterClosed().subscribe((result) => {
            if (result) {
                this.loadData(); // Refresh data after operation
                this.snackBar.open('Opération enregistrée', 'OK', { duration: 3000 });
            }
        });
    }

    closeCaisse(): void {
        if (this.journeeId) {
            this.router.navigate(['/p/finance/caisse/cloture', this.journeeId]);
        }
    }

    deleteOperation(op: OperationCaisse): void {
        if (!confirm('Êtes-vous sûr de vouloir supprimer cette opération ?')) return;

        this.operationService.remove(op.id).subscribe({
            next: () => {
                this.loadData();
                this.snackBar.open('Opération supprimée', 'OK', { duration: 3000 });
            },
            error: (error) => {
                console.error('Error deleting operation', error);
                this.snackBar.open(
                    error.error?.message || 'Erreur lors de la suppression',
                    'Fermer',
                    { duration: 3000 }
                );
            }
        });
    }

    getSolde(): number {
        return this.resume?.soldeTheorique || 0;
    }

    openTransferDialog(): void {
        if (!this.journeeId || !this.resume) return;

        // 1. Get list of available OPEN "DEPENSES" caisses in the same center
        this.journeeService.findByCentre(this.resume.journee.centre.id).subscribe({
            next: (sessions) => {
                const openDepenses = sessions.filter(s => s.statut === 'OUVERTE' && (s.caisse as any).type === 'DEPENSES');

                if (openDepenses.length === 0) {
                    this.snackBar.open('Aucune caisse de dépenses n\'est actuellement ouverte.', 'OK', { duration: 5000 });
                    return;
                }

                // For simplicity now, use a prompt. Or a dedicated dialog if preferred.
                const amountStr = prompt('Montant à transférer vers la caisse de dépenses (DH) :');
                if (!amountStr) return;
                const amount = parseFloat(amountStr);

                if (isNaN(amount) || amount <= 0) {
                    this.snackBar.open('Montant invalide', 'OK', { duration: 3000 });
                    return;
                }

                if (amount > this.getSolde()) {
                    this.snackBar.open('Le montant dépasse le solde disponible', 'OK', { duration: 3000 });
                    return;
                }

                // Take the first open depenses caisse for now or let user choose (simplified)
                const targetSession = openDepenses[0];

                this.operationService.transfer({
                    amount,
                    fromJourneeId: this.journeeId!,
                    toJourneeId: targetSession.id,
                    utilisateur: this.resume?.journee.caissier || 'Responsable'
                }).subscribe({
                    next: () => {
                        this.loadData();
                        this.snackBar.open(`Transfert de ${amount} DH effectué vers ${targetSession.caisse.nom}`, 'OK', { duration: 5000 });
                    },
                    error: (error) => {
                        console.error('Transfer failed', error);
                        this.snackBar.open('Échec du transfert : ' + (error.error?.message || 'Erreur inconnue'), 'Fermer', { duration: 5000 });
                    }
                });
            }
        });
    }

    // Cast helper for template
    asAny(val: any): any {
        return val;
    }
}
