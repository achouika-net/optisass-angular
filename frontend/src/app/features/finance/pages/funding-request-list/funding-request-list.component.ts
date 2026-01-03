import { Component, OnInit, effect, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Store } from '@ngrx/store';

import { FinanceService } from '../../services/finance.service';
import { FundingRequest } from '../../models/finance.models';
import { UserCurrentCentreSelector, UserSelector } from '../../../../core/store/auth/auth.selectors';

@Component({
    selector: 'app-funding-request-list',
    standalone: true,
    imports: [
        CommonModule,
        MatCardModule,
        MatButtonModule,
        MatIconModule,
        MatTableModule,
        MatSnackBarModule,
        MatChipsModule,
        MatTooltipModule
    ],
    templateUrl: './funding-request-list.component.html',
    styles: [`
    .container { padding: 24px; background: #fafafa; min-height: 100vh; }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
    .header h1 { font-size: 24px; font-weight: 600; color: #2c3e50; margin: 0; }
    
    mat-card { border-radius: 12px; overflow: hidden; border: 1px solid #edf2f7; }
    table { width: 100%; border-collapse: separate; }
    
    .mat-mdc-header-row { background: #3f51b5; }
    .mat-mdc-header-cell { color: white !important; font-weight: 600; padding: 16px !important; text-transform: uppercase; font-size: 12px; letter-spacing: 0.5px; }
    .mat-mdc-cell { padding: 16px !important; color: #4a5568; border-bottom: 1px solid #edf2f7; }
    .mat-mdc-row:hover { background-color: #f7fafc; transition: background 0.2s ease; }
    
    .montant-cell { font-weight: 700; color: #e53e3e; text-align: right; font-size: 15px; }
    .text-right { text-align: right; }
    
    .status-pending { background-color: #fffaf0; color: #dd6b20; border: 1px solid #fbd38d; font-weight: 500; }
    .status-validated { background-color: #f0fff4; color: #38a169; border: 1px solid #9ae6b4; font-weight: 500; }
    .status-rejected { background-color: #fff5f5; color: #e53e3e; border: 1px solid #feb2b2; font-weight: 500; }
    
    .actions { display: flex; gap: 8px; justify-content: flex-end; align-items: center; }
    .validation-date { display: flex; flex-direction: column; align-items: flex-end; }
    .date-label { font-size: 10px; color: #a0aec0; text-transform: uppercase; font-weight: 600; margin-bottom: 2px; }
    .date-value { font-size: 12px; color: #718096; font-weight: 500; }
    
    .libelle-container { display: flex; flex-direction: column; }
    .libelle-main { font-weight: 600; color: #2d3748; }
    .libelle-sub { font-size: 12px; color: #718096; margin-top: 2px; }
  `]
})
export class FundingRequestListComponent implements OnInit {
    requests: FundingRequest[] = [];
    displayedColumns: string[] = ['date', 'caisse', 'categorie', 'montant', 'statut', 'actions'];
    loading = false;
    currentCentre = this.store.selectSignal(UserCurrentCentreSelector);
    userProfile = this.store.selectSignal(UserSelector);

    constructor(
        private financeService: FinanceService,
        private snackBar: MatSnackBar,
        private store: Store,
        private cdr: ChangeDetectorRef
    ) {
        effect(() => {
            const center = this.currentCentre();
            if (center?.id) {
                this.loadRequests();
            }
        });
    }

    ngOnInit(): void { }

    loadRequests() {
        this.loading = true;
        this.cdr.markForCheck();
        this.financeService.getFundingRequests(this.currentCentre()?.id).subscribe({
            next: (data) => {
                this.requests = data;
                this.loading = false;
                this.cdr.detectChanges();
            },
            error: (err) => {
                console.error('Erreur chargement demandes', err);
                this.snackBar.open('Erreur lors du chargement des demandes', 'Fermer', { duration: 3000 });
                this.loading = false;
                this.cdr.detectChanges();
            }
        });
    }

    approve(request: FundingRequest) {
        if (confirm(`Confirmer l'alimentation de ${request.montant} DH depuis la caisse principale ?`)) {
            const userId = (this.userProfile() as any)?.id || 'Système';
            this.financeService.approveFundingRequest(request.id, userId).subscribe({
                next: () => {
                    this.snackBar.open('Alimentation effectuée et dépense validée', 'OK', { duration: 3000 });
                    this.loadRequests();
                },
                error: (err) => {
                    console.error(err);
                    this.snackBar.open('Erreur : ' + (err.error?.message || 'Erreur inconnue'), 'Fermer', { duration: 5000 });
                }
            });
        }
    }

    reject(request: FundingRequest) {
        const remarque = prompt('Raison du rejet (facultatif) :');
        if (remarque !== null) {
            const userId = (this.userProfile() as any)?.id || 'Système';
            this.financeService.rejectFundingRequest(request.id, userId, remarque).subscribe({
                next: () => {
                    this.snackBar.open('Demande rejetée', 'OK', { duration: 3000 });
                    this.loadRequests();
                },
                error: (err) => {
                    console.error(err);
                    this.snackBar.open('Erreur lors du rejet', 'Fermer', { duration: 3000 });
                }
            });
        }
    }

    getStatusClass(status: string): string {
        switch (status) {
            case 'EN_ATTENTE': return 'status-pending';
            case 'VALIDEE': return 'status-validated';
            case 'REJETEE': return 'status-rejected';
            default: return '';
        }
    }
}
