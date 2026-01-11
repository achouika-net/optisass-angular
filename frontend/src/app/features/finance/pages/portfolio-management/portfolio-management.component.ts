import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { MatChipsModule } from '@angular/material/chips';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FinanceService } from '../../services/finance.service';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-portfolio-management',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatTabsModule,
    MatChipsModule,
    MatMenuModule,
    MatFormFieldModule,
    MatSelectModule,
    FormsModule
  ],
  template: `
    <div class="dashboard-wrapper">
      <div class="dashboard-header">
        <div class="title-section">
          <h1>Gestion du Portefeuille</h1>
          <p class="subtitle">Suivi des encaissements et décaissements (Chèques & LCN)</p>
        </div>
        
        <div class="flex items-center gap-3">
          <mat-form-field appearance="outline" subscriptSizing="dynamic" class="!w-44 dense-form-field">
            <mat-label>Mois</mat-label>
            <mat-select [(ngModel)]="currentMonth" (selectionChange)="loadData()">
              <mat-option [value]="0">Tous les mois</mat-option>
              <mat-option *ngFor="let m of months" [value]="m.value">{{ m.label }}</mat-option>
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic" class="!w-36 dense-form-field">
            <mat-label>Année</mat-label>
            <mat-select [(ngModel)]="currentYear" (selectionChange)="loadData()">
              <mat-option *ngFor="let y of years" [value]="y">{{ y }}</mat-option>
            </mat-select>
          </mat-form-field>
          <button mat-flat-button color="primary" class="!h-[44px] !rounded-xl translate-y-[2px]" (click)="loadData()" [disabled]="loading">
            <mat-icon>refresh</mat-icon>
            Actualiser
          </button>
        </div>
      </div>

      <!-- Subtotals -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <mat-card class="kpi-card border-l-4 border-blue-500">
          <div class="kpi-label">À Venir / En Portefeuille</div>
          <div class="kpi-value text-blue-600">{{ totals.inHand | number:'1.2-2' }} DH</div>
          <div class="w-full bg-blue-100 h-1 rounded-full mt-2"></div>
        </mat-card>

        <mat-card class="kpi-card border-l-4 border-orange-500">
          <div class="kpi-label">Remis / Déposé</div>
          <div class="kpi-value text-orange-600">{{ totals.deposited | number:'1.2-2' }} DH</div>
          <div class="w-full bg-orange-100 h-1 rounded-full mt-2"></div>
        </mat-card>

        <mat-card class="kpi-card border-l-4 border-green-500">
          <div class="kpi-label">Total Payé / Encaissé</div>
          <div class="kpi-value text-green-600">{{ totals.paid | number:'1.2-2' }} DH</div>
          <div class="w-full bg-green-100 h-1 rounded-full mt-2"></div>
        </mat-card>
      </div>

      <mat-card class="main-card">
        <mat-tab-group (selectedTabChange)="onTabChange($event)">
          <mat-tab label="Encaissements (Clients)">
            <ng-template matTabContent>
              <div class="p-6 border-b border-slate-50 grid grid-cols-1 lg:grid-cols-2 gap-4 items-center">
                <mat-form-field appearance="outline" subscriptSizing="dynamic" class="w-full">
                  <mat-label>Filtrer par statut</mat-label>
                  <mat-select [(ngModel)]="statusFilter" (ngModelChange)="loadData()">
                    <mat-option value="ALL">Tous les statuts</mat-option>
                    <mat-option value="EN_ATTENTE">À Encaisser / Portefeuille</mat-option>
                    <mat-option value="REMIS_EN_BANQUE">Remis en Banque</mat-option>
                    <mat-option value="ENCAISSE">Encaissé</mat-option>
                  </mat-select>
                </mat-form-field>

                <mat-form-field appearance="outline" subscriptSizing="dynamic" class="w-full">
                  <mat-label>Type</mat-label>
                  <mat-select [(ngModel)]="modeFilter" (ngModelChange)="loadData()">
                    <mat-option value="CHEQUE,LCN,VIREMENT,ESPECES">Tous les modes</mat-option>
                    <mat-option value="CHEQUE">Chèque uniquement</mat-option>
                    <mat-option value="LCN">LCN uniquement</mat-option>
                    <mat-option value="VIREMENT">Virement uniquement</mat-option>
                    <mat-option value="ESPECES">Espèces uniquement</mat-option>
                  </mat-select>
                </mat-form-field>
              </div>
              <table mat-table [dataSource]="items" class="w-full">
                <ng-container matColumnDef="date">
                  <th mat-header-cell *matHeaderCellDef>Date Op.</th>
                  <td mat-cell *matCellDef="let item" class="font-medium text-slate-600">
                    {{ item.date | date:'dd/MM/yyyy' }}
                  </td>
                </ng-container>

                <ng-container matColumnDef="reference">
                  <th mat-header-cell *matHeaderCellDef>N° Pièce</th>
                  <td mat-cell *matCellDef="let item">
                    <div class="flex flex-col">
                      <span class="font-bold text-slate-900">{{ item.reference || 'N/A' }}</span>
                      <span class="text-[10px] text-blue-600 font-bold uppercase">{{ item.modePaiement }}</span>
                    </div>
                  </td>
                </ng-container>

                <ng-container matColumnDef="banque">
                  <th mat-header-cell *matHeaderCellDef>Banque</th>
                  <td mat-cell *matCellDef="let item" class="text-slate-500 text-sm">
                    {{ item.banque || '-' }}
                  </td>
                </ng-container>

                <ng-container matColumnDef="client">
                  <th mat-header-cell *matHeaderCellDef>Client / Émetteur</th>
                  <td mat-cell *matCellDef="let item">
                    <div class="flex flex-col">
                      <span class="font-medium">{{ item.client }}</span>
                      <span class="text-[10px] text-slate-400 italic">{{ item.libelle }}</span>
                    </div>
                  </td>
                </ng-container>

                <ng-container matColumnDef="montant">
                  <th mat-header-cell *matHeaderCellDef class="text-right">Montant</th>
                  <td mat-cell *matCellDef="let item" class="text-right font-black" [ngClass]="item.montant < 0 ? 'text-red-600' : 'text-slate-900'">
                    {{ (item.montant < 0 ? -item.montant : item.montant) | number:'1.2-2' }} DH
                  </td>
                </ng-container>

                <ng-container matColumnDef="statut">
                  <th mat-header-cell *matHeaderCellDef>Statut</th>
                  <td mat-cell *matCellDef="let item">
                    <span class="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-tight" 
                          [ngClass]="getStatusClass(item.statut)">
                      {{ item.statut.replace('_', ' ') }}
                    </span>
                  </td>
                </ng-container>

                <ng-container matColumnDef="datePrevue">
                  <th mat-header-cell *matHeaderCellDef>Prévu</th>
                  <td mat-cell *matCellDef="let item" class="text-amber-600 font-medium text-sm">
                    {{ item.dateVersement ? (item.dateVersement | date:'dd/MM/yyyy') : '-' }}
                  </td>
                </ng-container>

                <ng-container matColumnDef="dateEncaissement">
                  <th mat-header-cell *matHeaderCellDef>Fait</th>
                  <td mat-cell *matCellDef="let item" class="text-emerald-600 italic text-sm">
                    {{ item.dateEncaissement ? (item.dateEncaissement | date:'dd/MM/yyyy') : '-' }}
                  </td>
                </ng-container>

                <ng-container matColumnDef="actions">
                  <th mat-header-cell *matHeaderCellDef></th>
                  <td mat-cell *matCellDef="let item" class="text-right">
                    <button mat-icon-button [matMenuTriggerFor]="menu">
                      <mat-icon>more_vert</mat-icon>
                    </button>
                    <mat-menu #menu="matMenu">
                      <button mat-menu-item (click)="updateStatus(item, 'REMIS_EN_BANQUE')" *ngIf="item.statut === 'EN_ATTENTE' || item.statut === 'PORTEFEUILLE'">
                        <mat-icon class="text-orange-600">account_balance</mat-icon>
                        <span>Remettre en Banque</span>
                      </button>
                      <button mat-menu-item (click)="updateStatus(item, 'ENCAISSE')" *ngIf="item.statut !== 'ENCAISSE'">
                        <mat-icon class="text-green-600">check_circle</mat-icon>
                        <span>Confirmer Encaissement</span>
                      </button>
                    </mat-menu>
                  </td>
                </ng-container>

                <tr mat-header-row *matHeaderRowDef="displayedColumnsIncoming"></tr>
                <tr mat-row *matRowDef="let row; columns: displayedColumnsIncoming;" class="hover:bg-slate-50 transition-colors"></tr>
              </table>

              <div *ngIf="items.length === 0 && !loading" class="p-12 text-center text-slate-400">
                <mat-icon class="scale-150 mb-4 opacity-20">search_off</mat-icon>
                <p>Aucun chèque ou LCN trouvé pour ces critères.</p>
              </div>
            </ng-template>
          </mat-tab>
          
          <mat-tab label="Décaissements (Fournisseurs)">
             <ng-template matTabContent>
                <div class="p-6 border-b border-slate-50 grid grid-cols-1 lg:grid-cols-2 gap-4 items-center">
                  <mat-form-field appearance="outline" subscriptSizing="dynamic" class="w-full">
                    <mat-label>Filtrer par statut</mat-label>
                    <mat-select [(ngModel)]="statusFilter" (ngModelChange)="loadData()">
                      <mat-option value="ALL">Tous les statuts</mat-option>
                      <mat-option value="EN_ATTENTE">À Décaisser / Portefeuille</mat-option>
                      <mat-option value="PAYE">Payé</mat-option>
                    </mat-select>
                  </mat-form-field>

                  <mat-form-field appearance="outline" subscriptSizing="dynamic" class="w-full">
                    <mat-label>Type</mat-label>
                    <mat-select [(ngModel)]="modeFilter" (ngModelChange)="loadData()">
                      <mat-option value="CHEQUE,LCN,VIREMENT,ESPECES">Tous les modes</mat-option>
                      <mat-option value="CHEQUE">Chèque uniquement</mat-option>
                      <mat-option value="LCN">LCN uniquement</mat-option>
                      <mat-option value="VIREMENT">Virement uniquement</mat-option>
                      <mat-option value="ESPECES">Espèces uniquement</mat-option>
                    </mat-select>
                  </mat-form-field>
                </div>
                <table mat-table [dataSource]="items" class="w-full">
                  <ng-container matColumnDef="dateCreation">
                    <th mat-header-cell *matHeaderCellDef>Créé le</th>
                    <td mat-cell *matCellDef="let item" class="text-slate-500 text-sm">
                      {{ item.createdAt | date:'dd/MM/yyyy' }}
                    </td>
                  </ng-container>

                  <ng-container matColumnDef="reference">
                    <th mat-header-cell *matHeaderCellDef>N° Pièce</th>
                    <td mat-cell *matCellDef="let item">
                       <div class="flex flex-col">
                        <span class="font-bold text-slate-900">{{ item.reference || 'N/A' }}</span>
                        <span class="text-[10px] text-red-600 font-bold uppercase">{{ item.modePaiement }}</span>
                      </div>
                    </td>
                  </ng-container>

                  <ng-container matColumnDef="banque">
                    <th mat-header-cell *matHeaderCellDef>Banque</th>
                    <td mat-cell *matCellDef="let item" class="text-slate-500 text-sm">
                      {{ item.banque || '-' }}
                    </td>
                  </ng-container>

                  <ng-container matColumnDef="client">
                    <th mat-header-cell *matHeaderCellDef>Fournisseur</th>
                    <td mat-cell *matCellDef="let item">
                      <div class="flex flex-col">
                        <span class="font-medium">{{ item.fournisseur }}</span>
                        <span class="text-[10px] text-slate-400 italic">Facture: {{ item.libelle }}</span>
                      </div>
                    </td>
                  </ng-container>

                  <ng-container matColumnDef="montant">
                    <th mat-header-cell *matHeaderCellDef class="text-right">Montant</th>
                    <td mat-cell *matCellDef="let item" class="text-right font-black text-red-600">
                      {{ item.montant | number:'1.2-2' }} DH
                    </td>
                  </ng-container>

                  <ng-container matColumnDef="statut">
                    <th mat-header-cell *matHeaderCellDef>Statut</th>
                    <td mat-cell *matCellDef="let item">
                      <span class="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-tight" 
                            [ngClass]="getStatusClass(item.statut)">
                        {{ item.statut.replace('_', ' ') }}
                      </span>
                    </td>
                  </ng-container>

                  <ng-container matColumnDef="valeur">
                    <th mat-header-cell *matHeaderCellDef>Valeur</th>
                    <td mat-cell *matCellDef="let item" class="text-amber-600 font-medium text-sm">
                      {{ item.dateEcheance | date:'dd/MM/yyyy' }}
                    </td>
                  </ng-container>

                  <ng-container matColumnDef="dateEncaissement">
                    <th mat-header-cell *matHeaderCellDef>Fait</th>
                    <td mat-cell *matCellDef="let item" class="text-emerald-600 italic text-sm">
                      {{ item.dateEncaissement ? (item.dateEncaissement | date:'dd/MM/yyyy') : '-' }}
                    </td>
                  </ng-container>

                  <ng-container matColumnDef="actions">
                    <th mat-header-cell *matHeaderCellDef></th>
                    <td mat-cell *matCellDef="let item" class="text-right">
                      <button mat-icon-button [matMenuTriggerFor]="menu">
                        <mat-icon>more_vert</mat-icon>
                      </button>
                      <mat-menu #menu="matMenu">
                        <button mat-menu-item (click)="updateStatus(item, 'PAYE')">
                          <mat-icon class="text-green-600">check_circle</mat-icon>
                          <span>Confirmer Décaissement</span>
                        </button>
                      </mat-menu>
                    </td>
                  </ng-container>

                  <tr mat-header-row *matHeaderRowDef="displayedColumnsOutgoing"></tr>
                  <tr mat-row *matRowDef="let row; columns: displayedColumnsOutgoing;" class="hover:bg-slate-50 transition-colors"></tr>
                </table>
             </ng-template>
          </mat-tab>
        </mat-tab-group>
      </mat-card>
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; }
    .dashboard-wrapper { padding: 24px; background: #f8fafc; min-height: 100vh; width: 100%; box-sizing: border-box; }
    .dashboard-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px; gap: 24px; flex-wrap: wrap; }
    .title-section {
        flex: 1;
        min-width: 300px;
        h1 { font-size: 28px; font-weight: 800; color: #1e293b; margin: 0; letter-spacing: -0.5px; }
        .subtitle { color: #64748b; margin: 4px 0 0 0; font-size: 14px; }
    }
    .dense-form-field {
        ::ng-deep .mat-mdc-form-field-wrapper { padding-bottom: 0 !important; }
        ::ng-deep .mat-mdc-form-field-flex { height: 44px !important; }
        ::ng-deep .mat-mdc-text-field-wrapper { height: 44px !important; padding: 0 16px !important; border-radius: 12px !important; }
        ::ng-deep .mat-mdc-form-field-infix { padding-top: 10px !important; padding-bottom: 10px !important; min-height: unset !important; }
    }
    .kpi-card:hover { transform: translateY(-5px); box-shadow: 0 12px 40px 0 rgba(31, 38, 135, 0.12); }
    .kpi-label { color: #64748b; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
    .kpi-value { font-size: 28px; font-weight: 800; color: #1e293b; }
    
    .main-card { border-radius: 20px; border: none; box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.05); overflow: hidden; }

    ::ng-deep .mat-mdc-tab-label-container { padding: 0 16px; border-bottom: 1px solid #f1f5f9; }
    ::ng-deep .mat-mdc-form-field-wrapper { padding-bottom: 0 !important; }
    ::ng-deep .mat-mdc-form-field-flex { height: 44px !important; }
    ::ng-deep .mat-mdc-text-field-wrapper { height: 44px !important; padding: 0 16px !important; border-radius: 12px !important; }
    ::ng-deep .mat-mdc-form-field-infix { padding-top: 10px !important; padding-bottom: 10px !important; min-height: unset !important; }
    
    .mat-table { background: transparent; }
    .mat-header-cell { color: #64748b; font-weight: 600; text-transform: uppercase; font-size: 11px; letter-spacing: 0.05em; border-bottom: 1px solid #f1f5f9; }
    .mat-cell { color: #1e293b; font-size: 13px; border-bottom: 1px solid #f8fafc; padding: 16px 8px; }
    .mat-row:hover { background-color: #f8fafc; }
  `]
})
export class PortfolioManagementComponent implements OnInit {
  items: any[] = [];
  statusFilter = 'ALL';
  modeFilter = 'CHEQUE,LCN';
  activeTabId = 0;
  loading = false;
  totals = { inHand: 0, deposited: 0, paid: 0 };

  currentMonth = new Date().getMonth() + 1;
  currentYear = new Date().getFullYear();
  months = [
    { value: 1, label: 'Janvier' }, { value: 2, label: 'Février' }, { value: 3, label: 'Mars' },
    { value: 4, label: 'Avril' }, { value: 5, label: 'Mai' }, { value: 6, label: 'Juin' },
    { value: 7, label: 'Juillet' }, { value: 8, label: 'Août' }, { value: 9, label: 'Septembre' },
    { value: 10, label: 'Octobre' }, { value: 11, label: 'Novembre' }, { value: 12, label: 'Décembre' }
  ];
  years: number[] = [];

  displayedColumnsIncoming = ['date', 'client', 'montant', 'reference', 'banque', 'statut', 'datePrevue', 'dateEncaissement', 'actions'];
  displayedColumnsOutgoing = ['dateCreation', 'client', 'montant', 'reference', 'banque', 'statut', 'valeur', 'dateEncaissement', 'actions'];

  constructor(
    private financeService: FinanceService,
    private snackBar: MatSnackBar
  ) {
    const startYear = 2024;
    const endYear = new Date().getFullYear() + 1;
    for (let y = startYear; y <= endYear; y++) {
      this.years.push(y);
    }
  }

  ngOnInit() {
    this.loadData();
  }

  onTabChange(event: any) {
    this.activeTabId = event.index;
    this.loadData();
  }

  loadData() {
    this.loading = true;

    let startDate: string | undefined;
    let endDate: string | undefined;

    if (this.currentMonth > 0) {
      startDate = new Date(this.currentYear, this.currentMonth - 1, 1).toISOString();
      endDate = new Date(this.currentYear, this.currentMonth, 0, 23, 59, 59).toISOString();
    } else {
      // Tous les mois de l'année sélectionnée
      startDate = new Date(this.currentYear, 0, 1).toISOString();
      endDate = new Date(this.currentYear, 11, 31, 23, 59, 59).toISOString();
    }

    const filters = {
      mode: this.modeFilter,
      statut: this.statusFilter,
      startDate,
      endDate
    };

    const request = this.activeTabId === 0
      ? this.financeService.getConsolidatedIncomings(filters)
      : this.financeService.getConsolidatedOutgoings(filters);

    request.subscribe({
      next: (data) => {
        this.items = data;
        this.calculateTotals();
        this.loading = false;
      },
      error: () => {
        this.snackBar.open('Erreur lors du chargement des données', 'Fermer');
        this.loading = false;
      }
    });
  }

  calculateTotals() {
    this.totals = {
      inHand: this.items.filter(i => ['EN_ATTENTE', 'PORTEFEUILLE', 'EN_COURS', 'BROUILLON'].includes(i.statut.toUpperCase())).reduce((acc, i) => acc + Math.abs(i.montant), 0),
      deposited: this.items.filter(i => ['REMIS_EN_BANQUE', 'DEPOSE', 'DÉPOSÉ'].includes(i.statut.toUpperCase())).reduce((acc, i) => acc + Math.abs(i.montant), 0),
      paid: this.items.filter(i => ['ENCAISSE', 'PAYE', 'PAYÉ', 'VALIDE', 'VALIDÉ'].includes(i.statut.toUpperCase())).reduce((acc, i) => acc + Math.abs(i.montant), 0)
    };
  }

  getStatusClass(status: string) {
    if (!status) return 'bg-slate-50 text-slate-700';
    status = status.toUpperCase();
    if (['EN_ATTENTE', 'PORTEFEUILLE', 'EN_COURS', 'BROUILLON'].some(s => status.includes(s))) return 'bg-blue-50 text-blue-700 border border-blue-100';
    if (['BANQUE', 'DEPOS'].some(s => status.includes(s))) return 'bg-amber-50 text-amber-700 border border-amber-100';
    if (['ENCAISSE', 'PAYE', 'VALIDE'].some(s => status.includes(s))) return 'bg-emerald-50 text-emerald-700 border border-emerald-100';
    if (status.includes('REJET')) return 'bg-red-50 text-red-700 border border-red-100';
    return 'bg-slate-50 text-slate-700';
  }

  updateStatus(item: any, newStatut: string) {
    const request = item.source === 'FACTURE_CLIENT'
      ? this.financeService.validatePayment(item.id, newStatut)
      : this.financeService.validateEcheance(item.id, newStatut);

    request.subscribe({
      next: () => {
        this.snackBar.open('Opération validée', 'OK', { duration: 2000 });
        this.loadData();
      },
      error: () => this.snackBar.open('Erreur lors de la validation', 'OK')
    });
  }
}
