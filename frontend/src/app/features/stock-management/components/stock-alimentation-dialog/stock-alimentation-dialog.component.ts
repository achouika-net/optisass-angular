import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormArray, FormControl } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Store } from '@ngrx/store';
import { Observable, of } from 'rxjs';
import { Entrepot } from '../../../../shared/interfaces/warehouse.interface';
import { WarehousesService } from '../../../warehouses/services/warehouses.service';
import { StagedProduct } from '../../pages/stock-entry-v2/stock-entry-v2.component';
import { UserCurrentCentreSelector } from '../../../../core/store/auth/auth.selectors';
import { switchMap, finalize, tap, shareReplay, catchError } from 'rxjs/operators';
import { StockAlimentationService, BulkAlimentationPayload } from '../../services/stock-alimentation.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FinanceService } from '../../../finance/services/finance.service';
import { InvoiceFormDialogComponent } from '../../../finance/components/invoice-form-dialog/invoice-form-dialog.component';
import { MatDialog } from '@angular/material/dialog';
import { CeilingWarningDialogComponent, CeilingWarningAction } from '../../../finance/components/ceiling-warning-dialog/ceiling-warning-dialog.component';

export interface AlimentationResult {
  allocations: {
    productId: string;
    reference: string;
    warehouseId: string;
    quantite: number;
    prixAchat: number;
    tva: number;
  }[];
}

@Component({
  selector: 'app-stock-alimentation-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatTableModule,
    MatIconModule,
    MatTooltipModule
  ],
  template: `
    <div [formGroup]="form" class="h-full flex flex-col overflow-hidden">
      <!-- HEADER -->
      <header class="bg-slate-900 text-white px-6 py-4 flex items-center justify-between shadow-lg z-30">
        <div class="flex items-center gap-3">
          <mat-icon class="text-blue-400">inventory_2</mat-icon>
          <div>
            <h2 class="text-lg font-bold m-0 leading-tight">Alimentation des Stocks</h2>
            <p class="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Répartition & Destinations</p>
          </div>
        </div>
        <button mat-icon-button mat-dialog-close class="text-slate-400 hover:text-white transition-colors">
          <mat-icon>close</mat-icon>
        </button>
      </header>

      <mat-dialog-content class="!p-0 !m-0 bg-slate-50 flex-1 overflow-hidden flex flex-col">
        
        <!-- BULK ACTIONS TOOLBAR -->
        <div class="px-6 py-6 bg-white border-b flex items-center justify-between gap-6 shadow-sm z-20">
          <div class="flex items-center gap-4 min-w-max">
             <div class="p-3 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
                <mat-icon class="scale-110">auto_fix_high</mat-icon>
             </div>
             <div class="flex flex-col">
                <span class="text-[13px] font-black text-slate-800 uppercase tracking-wider">Affectation Rapide</span>
                <span class="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Saisie Groupée & Répartition Intelligente</span>
             </div>
          </div>
          
          <div class="flex items-center gap-8">
              <!-- Global Warehouse -->
              <div class="flex flex-col gap-1">
                 <span class="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Entrepôt Global</span>
                 <mat-form-field appearance="outline" class="w-40 compact-field" subscriptSizing="dynamic">
                   <mat-select [formControl]="batchWh" placeholder="Choisir...">
                     <mat-option *ngFor="let w of warehouses$ | async" [value]="w.id" class="text-[11px]">{{ w.nom }}</mat-option>
                   </mat-select>
                 </mat-form-field>
              </div>

              <!-- Global Qty -->
              <div class="flex flex-col gap-1">
                 <span class="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Quantité</span>
                 <div class="relative w-16">
                    <input type="number" [formControl]="batchQty" placeholder="Qté"
                           class="w-full h-10 px-2 border-2 border-slate-100 rounded-lg font-black text-slate-700 bg-white focus:border-blue-500 outline-none transition-all text-sm">
                 </div>
              </div>

              <!-- Global TVA -->
              <div class="flex flex-col gap-1">
                 <span class="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">TVA</span>
                 <mat-form-field appearance="outline" class="w-20 compact-field" subscriptSizing="dynamic">
                   <mat-select [formControl]="batchTva" placeholder="TVA">
                     <mat-option *ngFor="let r of [0, 7, 10, 14, 20]" [value]="r" class="text-[11px]">{{ r }}%</mat-option>
                   </mat-select>
                 </mat-form-field>
              </div>

              <!-- Global Category -->
              <div class="flex flex-col gap-1">
                 <span class="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Catégorie</span>
                 <mat-form-field appearance="outline" class="w-32 compact-field" subscriptSizing="dynamic">
                   <mat-select [formControl]="batchCat" placeholder="Cat.">
                     <mat-option value="MONTURE_OPTIQUE" class="text-[11px]">Optique</mat-option>
                     <mat-option value="MONTURE_SOLAIRE" class="text-[11px]">Solaire</mat-option>
                     <mat-option value="VERRE" class="text-[11px]">Verre</mat-option>
                     <mat-option value="LENTILLE" class="text-[11px]">Lentille</mat-option>
                     <mat-option value="ACCESSOIRE" class="text-[11px]">Acc.</mat-option>
                   </mat-select>
                 </mat-form-field>
              </div>

              <!-- Global P.Vente -->
              <div class="flex flex-col gap-1">
                 <span class="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">P.Vente HT</span>
                 <div class="relative w-20">
                    <input type="number" [formControl]="batchPrixVente" placeholder="Prix"
                           class="w-full h-10 px-2 border-2 border-slate-100 rounded-lg font-black text-blue-600 bg-white focus:border-blue-500 outline-none transition-all text-sm">
                 </div>
              </div>

             <div class="flex items-center gap-3 self-end min-max">
                <button mat-flat-button color="primary" 
                        class="!h-10 !px-6 !rounded-lg !text-[11px] !font-black !uppercase !tracking-wider shadow-md shadow-blue-100 transition-all active:scale-95"
                        (click)="applyGlobalSettings()">
                  Appliquer
                </button>
                <div class="w-px h-10 bg-slate-100 mx-1"></div>
                <button mat-stroked-button 
                        class="!h-10 !px-6 !rounded-lg !text-[11px] !font-black !uppercase !tracking-wider !border-2 !border-blue-100 !text-blue-600 hover:!bg-blue-50 transition-all active:scale-95"
                        [disabled]="!batchWh.value"
                        (click)="distributeRemainder()">
                  Répartir le Reliquat
                </button>
             </div>
          </div>
        </div>

        <!-- MAIN DATA TABLE -->
        <div class="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-slate-200">
          <table class="w-full border-collapse bg-white table-fixed">
            <thead class="sticky top-0 z-10 bg-slate-100 border-b shadow-sm">
              <tr class="text-[10px] font-black text-slate-500 uppercase tracking-widest text-left">
                  <th class="px-2 py-3 w-8 text-center text-[9px]">#</th>
                  <th class="px-3 py-3 text-left w-16 text-[9px] uppercase">Marque</th>
                  <th class="px-3 py-3 text-left w-32 text-[9px] uppercase">Produit</th>
                  <th class="px-3 py-3 text-left w-24 text-[9px] uppercase">Réf.</th>
                  <th class="px-3 py-3 text-left w-36 text-[9px] uppercase">Entrepôt</th>
                  <th class="px-3 py-3 text-center w-12 text-[9px] uppercase">Qté</th>
                  <th class="px-3 py-3 text-left w-20 text-[9px] uppercase">P.Ach HT</th>
                  <th class="px-3 py-3 text-left w-20 text-[9px] uppercase">P.Ven HT</th>
                  <th class="px-3 py-3 text-left w-24 text-[9px] uppercase">Catégorie</th>
                  <th class="px-3 py-3 text-left w-14 text-[9px] uppercase">TVA</th>
                  <th class="px-3 py-3 text-center w-14 text-[9px] uppercase">Excl.</th>
                  <th class="px-2 py-3 w-12 text-center"></th>
                </tr>
              </thead>
            
            <tbody formArrayName="products">
              <ng-container *ngFor="let product of data.products; let i = index" [formGroupName]="i">
                <ng-container formArrayName="allocations">
                   <tr *ngFor="let alloc of getAllocationsControls(i); let j = index" 
                       [formGroupName]="j"
                       class="group hover:bg-slate-50/80 transition-all border-b border-slate-100">
                      
                      <!-- INDEX -->
                      <td class="px-2 py-2 text-center font-bold text-slate-300 border-r border-slate-50 w-8">
                        <span *ngIf="j === 0" class="text-[10px]">{{ i + 1 }}</span>
                      </td>

                      <!-- MARQUE -->
                      <td class="px-2 py-2 w-16">
                        <div *ngIf="j === 0" class="flex items-center">
                          <span class="px-1 py-0 bg-slate-100 text-slate-500 rounded text-[8px] font-black uppercase tracking-tighter border border-slate-200 truncate max-w-full" [matTooltip]="product.marque || ''">{{ product.marque || '---' }}</span>
                        </div>
                      </td>

                      <!-- PRODUCT INFO -->
                      <td class="px-3 py-2 w-32">
                        <div *ngIf="j === 0" class="flex flex-col gap-0">
                          <span class="font-bold text-slate-800 text-[11px] leading-tight truncate w-full" [matTooltip]="product.nom">{{ product.nom }}</span>
                          <div class="flex items-center gap-1">
                             <span class="px-1 py-0 bg-blue-50 text-blue-600 rounded text-[8px] font-black uppercase tracking-tighter border border-blue-100 italic shrink-0">{{ product.categorie }}</span>
                             <span class="px-1 py-0 bg-slate-50 text-slate-400 rounded text-[8px] font-bold border border-slate-100 shrink-0">C: {{ product.quantite }}</span>
                          </div>
                        </div>
                        <div *ngIf="j > 0" class="flex items-center gap-1 pl-1">
                           <mat-icon class="text-slate-200 scale-50 rotate-90">subdirectory_arrow_right</mat-icon>
                           <span class="text-[8px] font-bold text-slate-300 uppercase italic">Suite</span>
                        </div>
                      </td>

                      <!-- REFERENCE -->
                      <td class="px-3 py-2 w-24">
                        <div *ngIf="j === 0" class="flex items-center">
                          <span class="text-[9px] font-black text-slate-400 font-mono tracking-tighter truncate max-w-full" [matTooltip]="product.reference">{{ product.reference }}</span>
                        </div>
                      </td>

                      <!-- WAREHOUSE SELECT -->
                      <td class="px-2 py-2 w-36">
                        <mat-form-field appearance="outline" class="w-full compact-field" subscriptSizing="dynamic">
                          <mat-select formControlName="warehouseId" placeholder="Dest.">
                            <mat-option *ngFor="let w of warehouses$ | async" [value]="w.id" class="text-[11px]">{{ w.nom }}</mat-option>
                          </mat-select>
                        </mat-form-field>
                      </td>

                      <!-- QUANTITE -->
                      <td class="px-2 py-2 w-12 text-center">
                        <div class="relative">
                          <input type="number" formControlName="quantite" 
                                 class="w-full h-8 text-center border-2 rounded-lg font-black text-slate-700 bg-white focus:border-blue-500 outline-none transition-all text-[11px]"
                                 [ngClass]="getAllocationStatus(i) !== 'OK' ? 'border-orange-200 bg-orange-50/30' : 'border-slate-100'">
                        </div>
                      </td>

                      <!-- PRED ACHAT -->
                      <td class="px-2 py-2 w-20 uppercase">
                        <div class="relative">
                          <input type="number" formControlName="prixAchat"
                                 class="w-full h-8 px-1.5 border-slate-100 border-2 rounded-lg font-bold text-slate-600 bg-white focus:border-blue-500 outline-none transition-all text-[10px]">
                        </div>
                      </td>

                      <!-- PRED VENTE -->
                      <td class="px-2 py-2 w-20 uppercase">
                        <div class="relative">
                          <input type="number" formControlName="prixVente"
                                 class="w-full h-8 px-1.5 border-slate-100 border-2 rounded-lg font-bold text-blue-600 bg-white focus:border-blue-500 outline-none transition-all text-[10px]">
                        </div>
                      </td>

                      <!-- CATEGORIE -->
                      <td class="px-2 py-2 w-24">
                        <mat-form-field appearance="outline" class="w-full compact-field" subscriptSizing="dynamic">
                          <mat-select formControlName="categorie">
                            <mat-option value="MONTURE_OPTIQUE" class="text-[11px]">Optique</mat-option>
                            <mat-option value="MONTURE_SOLAIRE" class="text-[11px]">Solaire</mat-option>
                            <mat-option value="VERRE" class="text-[11px]">Verre</mat-option>
                            <mat-option value="LENTILLE" class="text-[11px]">Lentille</mat-option>
                            <mat-option value="ACCESSOIRE" class="text-[11px]">Acc.</mat-option>
                          </mat-select>
                        </mat-form-field>
                      </td>

                      <!-- TVA -->
                      <td class="px-2 py-2 w-14">
                        <mat-form-field appearance="outline" class="w-full compact-field" subscriptSizing="dynamic">
                          <mat-select formControlName="tva">
                            <mat-option *ngFor="let r of [0, 7, 10, 14, 20]" [value]="r" class="text-[11px]">{{ r }}%</mat-option>
                          </mat-select>
                        </mat-form-field>
                      </td>

                      <!-- EXCLUDE -->
                      <td class="px-2 py-2 text-center w-14">
                        <div *ngIf="j === 0" class="flex items-center justify-center">
                          <input type="checkbox" [formControl]="$any(getGroup(i).get('exclure'))" 
                                 class="w-3.5 h-3.5 rounded border-2 border-slate-200 text-blue-600 cursor-pointer">
                        </div>
                      </td>

                      <!-- ACTIONS -->
                      <td class="px-2 py-2 text-center w-12">
                        <div class="flex items-center justify-center gap-0">
                          <button *ngIf="j === 0" mat-icon-button class="scale-[0.65] text-blue-500 hover:bg-blue-50" 
                                  (click)="addAllocation(i)" matTooltip="Scinder">
                            <mat-icon>add_circle</mat-icon>
                          </button>
                          <button *ngIf="j > 0" mat-icon-button class="scale-[0.65] text-red-400 hover:bg-red-50" (click)="removeAllocation(i, j)">
                            <mat-icon>delete_outline</mat-icon>
                          </button>
                        </div>
                      </td>
                   </tr>
                </ng-container>
              </ng-container>
            </tbody>
          </table>
        </div>
      </mat-dialog-content>

      <!-- FOOTER ACTIONS -->
      <footer class="bg-white border-t px-8 py-4 flex items-center justify-between shadow-[0_-4px_10px_rgba(0,0,0,0.03)] z-30">
        <div class="flex items-center gap-8">
           <div class="flex flex-col">
              <span class="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Total Articles</span>
              <span class="text-base font-black text-slate-800">{{ data.products.length }}</span>
           </div>
           <div class="h-8 w-px bg-slate-100"></div>
           <div class="flex flex-col">
              <span class="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Statut de Répartition</span>
              <div class="flex items-center gap-2">
                 <span [ngClass]="isAllocationValid() ? 'text-green-600' : 'text-orange-500'" class="text-[11px] font-black uppercase">
                    {{ isAllocationValid() ? 'Toutes les quantités réparties' : 'Répartition incomplète' }}
                 </span>
                 <mat-icon *ngIf="isAllocationValid()" class="text-green-500 scale-75">verified</mat-icon>
              </div>
           </div>
        </div>

        <div class="flex items-center gap-4">
           <button mat-button mat-dialog-close class="!font-bold !text-slate-400 !px-6 hover:!text-slate-600">Annuler</button>
           <button mat-flat-button color="primary" 
                   class="!h-12 !px-10 !rounded-xl !font-black !text-[13px] !uppercase !tracking-widest shadow-xl shadow-blue-100 disabled:!bg-slate-100 disabled:!text-slate-300 transition-all active:scale-[0.98]"
                   [disabled]="form.invalid || !isAllocationValid()" 
                   (click)="confirm()">
             Finaliser l'Alimentation
           </button>
        </div>
      </footer>
    </div>
  `,
  styles: [`
    :host ::ng-deep .compact-field .mat-mdc-text-field-wrapper {
        padding: 0 10px !important;
        background-color: white !important;
        border-radius: 8px !important;
        height: 36px !important;
        border: 2px solid #f1f5f9 !important;
        transition: all 0.2s ease !important;
    }
    :host ::ng-deep .compact-field.mat-focused .mat-mdc-text-field-wrapper {
        border-color: #3b82f6 !important;
        background-color: #fff !important;
    }
    :host ::ng-deep .compact-field .mat-mdc-form-field-infix {
        padding-top: 4px !important;
        padding-bottom: 4px !important;
        min-height: 32px !important;
    }
    :host ::ng-deep .mat-mdc-dialog-container {
        border-radius: 16px !important;
        overflow: hidden !important;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25) !important;
    } 
    input::-webkit-outer-spin-button,
    input::-webkit-inner-spin-button {
      -webkit-appearance: none;
      margin: 0;
    }
  `]
})
export class StockAlimentationDialogComponent implements OnInit {
  form: FormGroup;
  warehouses$: Observable<Entrepot[]>;
  saving = false;
  ocrProcessing = false;

  // Global Controls for Toolbar
  batchWh = new FormControl<string>('');
  batchQty = new FormControl<number | null>(null);
  batchTva = new FormControl<number | null>(null);
  batchPrixVente = new FormControl<number | null>(null);
  batchCat = new FormControl<string | null>(null);

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<StockAlimentationDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: {
      products: StagedProduct[],
      document: any,
      skipPaymentPrompt?: boolean
    },
    private warehousesService: WarehousesService,
    private stockService: StockAlimentationService,
    private financeService: FinanceService,
    private snackBar: MatSnackBar,
    private store: Store,
    private dialog: MatDialog
  ) {
    // 1. Initialize form
    this.form = this.fb.group({
      products: this.fb.array([])
    });

    // 2. Fetch warehouses
    // 2. Fetch warehouses - Robust handling
    // 2. Fetch warehouses - Robust handling with Logging
    this.warehouses$ = this.store.select(UserCurrentCentreSelector).pipe(
      tap(center => console.log('DEBUG: StockAlimentation - Current Center detected:', center)),
      switchMap(center => {
        const centerId = center?.id;
        console.log('DEBUG: StockAlimentation - Fetching warehouses for Center ID:', centerId || 'ALL');
        return this.warehousesService.findAll(centerId).pipe(
          tap(whs => console.log('DEBUG: StockAlimentation - Warehouses received:', whs)),
          catchError(err => {
            console.error('DEBUG: StockAlimentation - Error fetching warehouses:', err);
            return of([]);
          })
        );
      }),
      shareReplay(1)
    );
  }

  get productsFormArray() {
    return this.form.get('products') as FormArray;
  }

  ngOnInit() {
    // 3. Populate products array
    this.data.products.forEach(p => {
      // Ensure numeric types
      p.quantite = Number(p.quantite);
      p.prixAchat = Number(p.prixAchat);
      p.prixVente = Number(p.prixVente);
      p.tva = Number(p.tva);

      const productGroup = this.fb.group({
        exclure: [false],
        allocations: this.fb.array([
          this.createAllocationGroup(p.quantite, p.prixAchat, p.prixVente, p.tva, p.categorie)
        ])
      });
      this.productsFormArray.push(productGroup);
    });
  }

  createAllocationGroup(qty: number, price: number, sellingPrice: number, tva: number, cat: string) {
    return this.fb.group({
      warehouseId: ['', Validators.required],
      quantite: [Number(qty) || 0, [Validators.required, Validators.min(0.001)]],
      prixAchat: [Number(price) || 0, [Validators.required, Validators.min(0)]],
      prixVente: [Number(sellingPrice) || 0, [Validators.required, Validators.min(0)]],
      tva: [Number(tva) || 0, Validators.required],
      categorie: [cat, Validators.required]
    });
  }

  getGroup(productIndex: number): FormGroup {
    return this.productsFormArray.at(productIndex) as FormGroup;
  }

  getAllocations(productIndex: number): FormArray {
    return this.getGroup(productIndex).get('allocations') as FormArray;
  }

  getAllocationsControls(productIndex: number) {
    return this.getAllocations(productIndex).controls;
  }

  addAllocation(productIndex: number) {
    const p = this.data.products[productIndex];
    const currentSum = this.getAllocatedSum(productIndex);
    const remaining = Number((p.quantite - currentSum).toFixed(3));

    // Use global settings if available
    const globalWh = this.batchWh.value;
    const globalTva = this.batchTva.value;
    const globalCat = this.batchCat.value;
    const tvaToUse = (globalTva !== null && globalTva !== undefined) ? Number(globalTva) : p.tva;
    const catToUse = globalCat || p.categorie;
    const prixVenteToUse = (this.batchPrixVente.value !== null && this.batchPrixVente.value !== undefined) ? Number(this.batchPrixVente.value) : p.prixVente;

    const group = this.createAllocationGroup(Math.max(0, remaining), p.prixAchat, prixVenteToUse, tvaToUse, catToUse);
    if (globalWh) {
      group.get('warehouseId')?.setValue(globalWh);
    }

    this.getAllocations(productIndex).push(group);
  }

  removeAllocation(productIndex: number, allocIndex: number) {
    const allocations = this.getAllocations(productIndex);
    if (allocations.length > 1) {
      allocations.removeAt(allocIndex);
    }
  }

  getAllocatedSum(productIndex: number): number {
    const allocations = this.getAllocations(productIndex).value;
    const sum = allocations.reduce((acc: number, a: any) => acc + (Number(a.quantite) || 0), 0);
    return Number(sum.toFixed(3));
  }

  getAllocationStatus(productIndex: number): 'OK' | 'WARN' {
    const p = this.data.products[productIndex];
    const sum = this.getAllocatedSum(productIndex);
    return Math.abs(sum - Number(p.quantite)) < 0.001 ? 'OK' : 'WARN';
  }

  isAllocationValid(): boolean {
    return this.data.products.every((p, i) => {
      const g = this.getGroup(i);
      if (g.get('exclure')?.value) return true;
      return this.getAllocationStatus(i) === 'OK';
    });
  }

  applyGlobalSettings() {
    const warehouseId = this.batchWh.value;
    const qty = this.batchQty.value;
    const tva = this.batchTva.value;
    const cat = this.batchCat.value;
    const prixVente = this.batchPrixVente.value;

    this.productsFormArray.controls.forEach((pGroup: any) => {
      const allocations = pGroup.get('allocations') as FormArray;
      allocations.controls.forEach((aGroup: any) => {
        // Apply Warehouse if provided
        if (warehouseId) {
          aGroup.get('warehouseId').setValue(warehouseId);
        }
        // Apply Quantity if provided
        if (qty !== null && qty !== undefined) {
          aGroup.get('quantite').setValue(Number(qty));
        }
        // Apply TVA if provided
        if (tva !== null && tva !== undefined) {
          aGroup.get('tva').setValue(Number(tva));
        }
        // Apply Category if provided
        if (cat) {
          aGroup.get('categorie').setValue(cat);
        }
        // Apply Prix Vente if provided
        if (prixVente !== null && prixVente !== undefined) {
          aGroup.get('prixVente').setValue(Number(prixVente));
        }
      });
    });
  }

  distributeRemainder() {
    const warehouseId = this.batchWh.value;
    const requestedQty = this.batchQty.value;
    const globalTva = this.batchTva.value;
    const globalCat = this.batchCat.value;

    if (!warehouseId) return;
    const qtyToUse = (requestedQty !== undefined && requestedQty !== null) ? Number(requestedQty) : null;

    this.productsFormArray.controls.forEach((pGroup: any, i: number) => {
      const p = this.data.products[i];
      const allocations = pGroup.get('allocations') as FormArray;

      // 1. Fill missing warehouse IDs on existing rows
      allocations.controls.forEach(c => {
        if (!c.get('warehouseId').value) {
          c.get('warehouseId').setValue(warehouseId);
          // Also apply global TVA if set
          if (globalTva !== null && globalTva !== undefined) {
            c.get('tva').setValue(Number(globalTva));
          }
          // Also apply global Category if set
          if (globalCat) {
            c.get('categorie').setValue(globalCat);
          }
        }
      });

      // 2. Check if we still have a remainder to distribute
      const currentSum = this.getAllocatedSum(i);
      const remainingTotal = Number((p.quantite - currentSum).toFixed(3));

      if (remainingTotal > 0.001) {
        // Use requested quantity if valid, otherwise finish the remainder
        const qtyToAllocate = (qtyToUse !== null && qtyToUse > 0) ? Number(Math.min(qtyToUse, remainingTotal).toFixed(3)) : remainingTotal;

        if (qtyToAllocate > 0.001) {
          const tvaToUse = (globalTva !== null && globalTva !== undefined) ? Number(globalTva) : p.tva;
          const catToUse = globalCat || p.categorie;
          const prixVenteToUse = (this.batchPrixVente.value !== null && this.batchPrixVente.value !== undefined) ? Number(this.batchPrixVente.value) : p.prixVente;

          allocations.push(
            this.createAllocationGroup(qtyToAllocate, p.prixAchat, prixVenteToUse, tvaToUse, catToUse)
          );
        }
      }
    });

    // 3. Update the global quantity field with the "NEW" remaining for the first product
    // (This assumes the batch has common quantities, which is the user's workflow)
    const firstRem = Number((this.data.products[0].quantite - this.getAllocatedSum(0)).toFixed(3));
    this.batchQty.setValue(firstRem > 0 ? firstRem : null);
  }

  async confirm() {
    if (this.form.valid && this.isAllocationValid()) {
      const allAllocations: any[] = [];
      const doc = this.data.document as any;
      const centreId = doc.centreId;

      this.productsFormArray.controls.forEach((pGroup: any, i) => {
        if (pGroup.get('exclure')?.value) return;

        const original = this.data.products[i];
        const allocations = pGroup.get('allocations').value;

        allocations.forEach((a: any) => {
          allAllocations.push({
            productId: original.id,
            reference: original.reference,
            nom: original.nom,
            marque: original.marque,
            categorie: a.categorie || original.categorie,
            warehouseId: a.warehouseId,
            quantite: Number(a.quantite),
            prixAchat: Number(a.prixAchat),
            prixVente: Number(a.prixVente),
            tva: Number(a.tva)
          });
        });
      });

      if (allAllocations.length === 0) {
        this.snackBar.open('Aucune ligne à enregistrer', 'OK', { duration: 3000 });
        return;
      }

      // Handle File Attachment
      let base64File: string | undefined;
      let fileName: string | undefined;
      if (doc.file) {
        base64File = await this.fileToBase64(doc.file);
        fileName = doc.file.name;
      }

      const payload: BulkAlimentationPayload = {
        numeroFacture: doc.numero || `ENTREE_${Date.now()}`,
        dateEmission: doc.date.toISOString(),
        type: doc.type,
        fournisseurId: doc.fournisseurId,
        centreId: doc.centreId,
        base64File: base64File,
        fileName: fileName,
        allocations: allAllocations
      };

      // Calculate payment amount that will be disbursed THIS MONTH
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();

      const invoiceDate = this.data.document.date;
      const invoiceMonth = invoiceDate.getMonth();
      const invoiceYear = invoiceDate.getFullYear();

      const totalTTC = allAllocations.reduce((sum, a) => {
        const tvaAmount = Number(a.prixAchat) * (Number(a.tva) / 100);
        return sum + ((Number(a.prixAchat) + tvaAmount) * Number(a.quantite));
      }, 0);

      // Fetch supplier to get payment conditions and calculate REAL impact this month
      this.financeService.getSupplier(payload.fournisseurId).pipe(
        switchMap(supplier => {
          let monthlyPaymentAmount = 0;

          // If invoice is in the future, impact is 0 this month (unless logic changes)
          if (invoiceMonth === currentMonth && invoiceYear === currentYear) {
            monthlyPaymentAmount = this.calculateFirstInstallment(supplier, totalTTC);
          } else {
            // Check if first installment (e.g. 30j) falls in THIS month even if invoice was last month?
            // Usually ceiling check is for NEW entries.
            // If invoice is TODAY, we check its first installment.
          }

          // 1. Ceiling Alert Check
          return this.financeService.getTreasurySummary(currentYear, currentMonth + 1, centreId).pipe(
            switchMap(summary => {
              const threshold = summary?.monthlyThreshold || 50000;
              const totalWithEntry = (summary?.totalExpenses || 0) + monthlyPaymentAmount;

              if (totalWithEntry > threshold && monthlyPaymentAmount > 0) {
                return this.financeService.getYearlyProjection(currentYear, centreId).pipe(
                  switchMap(projection => {
                    const dialogRef = this.dialog.open(CeilingWarningDialogComponent, {
                      width: '600px',
                      disableClose: true,
                      data: {
                        amount: monthlyPaymentAmount,
                        currentDetails: {
                          totalExpenses: summary.totalExpenses,
                          monthlyThreshold: threshold,
                          balance: summary.balance
                        },
                        projection: projection,
                        currentMonth: currentMonth,
                        currentYear: currentYear
                      }
                    });
                    return dialogRef.afterClosed();
                  })
                );
              }
              return of({ action: 'FORCE' });
            })
          );
        }),
        finalize(() => this.ocrProcessing = false)
      ).subscribe((result: any) => {
        if (!result || result.action === 'CANCEL') return;

        if (result.action === 'RESCHEDULE' && result.date) {
          const targetDateStr = result.date.toISOString();
          payload.dateEmission = targetDateStr;
          payload.dateEcheance = targetDateStr;
        }

        // 2. Perform Save
        this.saveEntry(payload);
      });
    }
  }

  private calculateFirstInstallment(supplier: any, totalTTC: number): number {
    const echeanceArray = supplier.convention?.echeancePaiement || [];
    const conditions = (echeanceArray[0] || supplier.conditionsPaiement2 || supplier.conditionsPaiement || '').toLowerCase();

    if (conditions.includes('60 jours')) {
      return totalTTC / 2;
    } else if (conditions.includes('90 jours')) {
      return totalTTC / 3;
    } else if (conditions.includes('30 jours')) {
      // 30 days usually means next month, so impact THIS month is 0
      // BUT if user selects a Date in the past (unlikely) or if "Comptant" is implied.
      // Usually "30 jours" means impact start next month.
      return 0;
    } else if (conditions.match(/r[eé]partie?\s*sur\s*(\d+)\s*mois/)) {
      const match = conditions.match(/r[eé]partie?\s*sur\s*(\d+)\s*mois/);
      const months = parseInt(match![1], 10);
      return totalTTC / months;
    }

    // Default: Comptant / Exception
    return totalTTC;
  }
  private saveEntry(payload: BulkAlimentationPayload) {
    this.stockService.bulkAlimentation(payload).subscribe({
      next: (res: any) => {
        this.snackBar.open('Stock alimenté avec succès !', 'OK', { duration: 3000 });

        // 3. Workflow Bridge: Prompt only if NOT skipped (i.e. not coming from Invoice flow)
        if (!this.data.skipPaymentPrompt) {
          const completePayment = confirm('Stock alimenté. Souhaitez-vous maintenant compléter les modalités de paiement (échéances, chèques, etc.) pour cette facture ?');

          if (completePayment && res && res.id) {
            // Open Invoice Form Dialog in edit mode
            const invoiceDialog = this.dialog.open(InvoiceFormDialogComponent, {
              width: '1200px',
              maxWidth: '95vw',
              data: { invoice: res }
            });

            invoiceDialog.afterClosed().subscribe(() => {
              this.dialogRef.close({ success: true, allocations: payload.allocations });
            });
            return;
          }
        }

        this.dialogRef.close({ success: true, allocations: payload.allocations });
      },
      error: (err) => {
        console.error('Persistence failed', err);
        const msg = err.error?.message || 'Erreur lors de l\'enregistrement du stock';
        this.snackBar.open(msg, 'OK', { duration: 5000 });
      }
    });
  }

  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  }
}
