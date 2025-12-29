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
    <div class="p-6 max-w-7xl mx-auto">
      <div class="flex justify-between items-center mb-6">
        <h1 class="text-2xl font-black text-slate-800 flex items-center gap-3">
          <mat-icon color="primary" class="scale-125">wallet</mat-icon>
          Gestion du Portefeuille (Chèques & LCN)
        </h1>
      </div>

      <!-- Subtotals -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div class="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
          <p class="text-slate-500 text-xs font-bold uppercase tracking-widest mb-1">En Portefeuille</p>
          <p class="text-2xl font-black text-slate-900">{{ totals.inHand | number:'1.2-2' }} DH</p>
          <div class="h-1 w-12 bg-blue-500 mt-2 rounded-full"></div>
        </div>
        <div class="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
          <p class="text-slate-500 text-xs font-bold uppercase tracking-widest mb-1">Remis / Déposé</p>
          <p class="text-2xl font-black text-amber-600">{{ totals.deposited | number:'1.2-2' }} DH</p>
          <div class="h-1 w-12 bg-amber-500 mt-2 rounded-full"></div>
        </div>
        <div class="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
          <p class="text-slate-500 text-xs font-bold uppercase tracking-widest mb-1">Total Payé / Encaissé</p>
          <p class="text-2xl font-black text-emerald-600">{{ totals.paid | number:'1.2-2' }} DH</p>
          <div class="h-1 w-12 bg-emerald-500 mt-2 rounded-full"></div>
        </div>
      </div>

      <mat-card class="rounded-2xl border-none shadow-sm overflow-hidden">
        <mat-tab-group (selectedTabChange)="onTabChange($event)">
          <mat-tab label="Chèques à Encaisser (Clients)">
            <ng-template matTabContent>
              <div class="p-4 border-b border-slate-50 flex gap-4">
                <mat-form-field appearance="outline" class="dense-form-field">
                  <mat-label>Filtrer par statut</mat-label>
                  <mat-select [(ngModel)]="statusFilter" (ngModelChange)="loadData()">
                    <mat-option value="ALL">Tous les statuts</mat-option>
                    <mat-option value="EN_ATTENTE">En Portefeuille</mat-option>
                    <mat-option value="ENCAISSE">Encaissé</mat-option>
                  </mat-select>
                </mat-form-field>

                <mat-form-field appearance="outline" class="dense-form-field">
                  <mat-label>Type</mat-label>
                  <mat-select [(ngModel)]="modeFilter" (ngModelChange)="loadData()">
                    <mat-option value="CHEQUE,LCN">Tous (Chèque & LCN)</mat-option>
                    <mat-option value="CHEQUE">Chèque uniquement</mat-option>
                    <mat-option value="LCN">LCN uniquement</mat-option>
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
          
          <mat-tab label="Chèques à Décaisser (Fournisseurs)">
             <ng-template matTabContent>
                <div class="p-4 border-b border-slate-50 flex gap-4">
                  <mat-form-field appearance="outline" class="dense-form-field">
                    <mat-label>Filtrer par statut</mat-label>
                    <mat-select [(ngModel)]="statusFilter" (ngModelChange)="loadData()">
                      <mat-option value="ALL">Tous les statuts</mat-option>
                      <mat-option value="EN_ATTENTE">En Portefeuille</mat-option>
                      <mat-option value="PAYE">Payé</mat-option>
                    </mat-select>
                  </mat-form-field>

                  <mat-form-field appearance="outline" class="dense-form-field">
                    <mat-label>Type</mat-label>
                    <mat-select [(ngModel)]="modeFilter" (ngModelChange)="loadData()">
                      <mat-option value="CHEQUE,LCN">Tous (Chèque & LCN)</mat-option>
                      <mat-option value="CHEQUE">Chèque uniquement</mat-option>
                      <mat-option value="LCN">LCN uniquement</mat-option>
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
    :host { display: block; background: #f8fafc; min-height: 100vh; }
    .dense-form-field { width: 220px; font-size: 13px; margin-top: 8px; }
    ::ng-deep .mat-mdc-tab-label-container { padding: 0 16px; }
  `]
})
export class PortfolioManagementComponent implements OnInit {
  items: any[] = [];
  statusFilter = 'ALL';
  modeFilter = 'CHEQUE,LCN';
  activeTabId = 0;
  loading = false;
  totals = { inHand: 0, deposited: 0, paid: 0 };
  displayedColumnsIncoming = ['date', 'client', 'montant', 'reference', 'banque', 'statut', 'datePrevue', 'dateEncaissement', 'actions'];
  displayedColumnsOutgoing = ['dateCreation', 'client', 'montant', 'reference', 'banque', 'statut', 'valeur', 'dateEncaissement', 'actions'];

  constructor(
    private financeService: FinanceService,
    private snackBar: MatSnackBar
  ) { }

  ngOnInit() {
    this.loadData();
  }

  onTabChange(event: any) {
    this.activeTabId = event.index;
    this.loadData();
  }

  loadData() {
    this.loading = true;
    const filters = {
      mode: this.modeFilter,
      statut: this.statusFilter !== 'ALL' ? this.statusFilter : undefined
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
    // Basic aggregation for current view
    this.totals = {
      inHand: this.items.filter(i => i.statut === 'EN_ATTENTE' || i.statut === 'PORTEFEUILLE').reduce((acc, i) => acc + Math.abs(i.montant), 0),
      deposited: this.items.filter(i => i.statut === 'REMIS_EN_BANQUE' || i.statut === 'DÉPOSÉ').reduce((acc, i) => acc + Math.abs(i.montant), 0),
      paid: this.items.filter(i => i.statut === 'ENCAISSE' || i.statut === 'PAYÉ' || i.statut === 'PAYE').reduce((acc, i) => acc + Math.abs(i.montant), 0)
    };
  }

  getStatusClass(status: string) {
    status = status.toUpperCase();
    if (status.includes('ATTENTE') || status.includes('PORTEFEUILLE')) return 'bg-blue-50 text-blue-700 border border-blue-100';
    if (status.includes('BANQUE') || status.includes('DEPOS')) return 'bg-amber-50 text-amber-700 border border-amber-100';
    if (status.includes('ENCAISSE') || status.includes('PAYE')) return 'bg-emerald-50 text-emerald-700 border border-emerald-100';
    if (status.includes('REJET')) return 'bg-red-50 text-red-700 border border-red-100';
    return 'bg-slate-50 text-slate-700';
  }

  updateStatus(item: any, newStatut: string) {
    const request = item.source === 'FACTURE_CLIENT'
      ? this.financeService.validatePayment(item.id)
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
