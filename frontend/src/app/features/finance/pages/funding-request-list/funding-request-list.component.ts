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
    .container { padding: 20px; }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
    table { width: 100%; }
    .actions { display: flex; gap: 8px; justify-content: flex-end; }
    .montant-cell { font-weight: bold; color: #d32f2f; }
    .status-pending { background-color: #fff3e0; color: #ef6c00; }
    .status-validated { background-color: #e8f5e9; color: #2e7d32; }
    .status-rejected { background-color: #ffebee; color: #c62828; }
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
