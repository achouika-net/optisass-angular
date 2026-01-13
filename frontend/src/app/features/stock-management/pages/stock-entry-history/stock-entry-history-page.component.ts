import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSelectModule } from '@angular/material/select';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { MatCardModule } from '@angular/material/card';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { animate, state, style, transition, trigger } from '@angular/animations';
import { finalize } from 'rxjs/operators';
import { environment } from '../../../../../environments/environment';
import { Store } from '@ngrx/store';
import { UserCurrentCentreSelector } from '../../../../core/store/auth/auth.selectors';
import { StockMovementsService } from '../../services/stock-movements.service';
import { FinanceService } from '../../../finance/services/finance.service';

@Component({
    selector: 'app-stock-entry-history-page',
    standalone: true,
    imports: [
        CommonModule,
        MatTableModule,
        MatButtonModule,
        MatIconModule,
        MatFormFieldModule,
        MatInputModule,
        MatDatepickerModule,
        MatNativeDateModule,
        MatSelectModule,
        MatMenuModule,
        MatProgressSpinnerModule,
        ReactiveFormsModule,
        MatSnackBarModule,
        MatCardModule,
        MatTooltipModule,
        MatDividerModule,
        MatTabsModule
    ],
    templateUrl: './stock-entry-history-page.component.html',
    styleUrls: ['./stock-entry-history-page.component.scss'],
    animations: [
        trigger('detailExpand', [
            state('collapsed', style({ height: '0px', minHeight: '0' })),
            state('expanded', style({ height: '*' })),
            transition('expanded <=> collapsed', animate('225ms cubic-bezier(0.4, 0.0, 0.2, 1)')),
        ]),
    ],
})
export class StockEntryHistoryPageComponent implements OnInit {
    dataSource = new MatTableDataSource<any>([]);
    columnsToDisplay = ['dateEmission', 'fournisseur', 'numeroFacture', 'montantTTC', 'itemsCount', 'actions', 'expand'];

    outDataSource = new MatTableDataSource<any>([]);
    outColumnsToDisplay = ['dateMovement', 'motif', 'utilisateur', 'itemsCount', 'expand'];

    expandedElement: any | null;

    filterForm: FormGroup;
    outFilterForm: FormGroup;
    suppliers: any[] = [];
    loading = false;

    stats = {
        totalEntries: 0,
        totalItems: 0,
        totalValue: 0
    };

    outStats = {
        totalSorties: 0,
        totalItems: 0
    };

    activeTabIndex = 0;
    currentCentre = this.store.selectSignal(UserCurrentCentreSelector);

    constructor(
        private stockService: StockMovementsService,
        private financeService: FinanceService,
        private fb: FormBuilder,
        private cdr: ChangeDetectorRef,
        private snackBar: MatSnackBar,
        private store: Store
    ) {
        this.filterForm = this.fb.group({
            dateFrom: [null],
            dateTo: [null],
            supplierId: [null],
            docType: [null]
        });

        this.outFilterForm = this.fb.group({
            dateFrom: [null],
            dateTo: [null],
            search: ['']
        });
    }

    ngOnInit() {
        this.loadSuppliers();
        this.loadHistory();
        this.loadOutHistory();
    }
    /* ... slide ... */
    onTabChange(event: any) {
        this.activeTabIndex = event.index;
        this.expandedElement = null; // Reset expanded when switching tabs
        if (this.activeTabIndex === 0) this.loadHistory();
        else this.loadOutHistory();
    }

    refresh() {
        if (this.activeTabIndex === 0) this.loadHistory();
        else this.loadOutHistory();
    }

    loadSuppliers() {
        this.financeService.getSuppliers().subscribe((data: any) => {
            this.suppliers = data;
        });
    }

    loadHistory() {
        this.loading = true;
        const filters = this.filterForm.value;

        // Format dates for API if necessary
        const apiFilters: any = { ...filters };
        if (filters.dateFrom) apiFilters.dateFrom = filters.dateFrom.toISOString();
        if (filters.dateTo) apiFilters.dateTo = filters.dateTo.toISOString();

        const centre = this.currentCentre();
        if (centre?.id) apiFilters.centreId = centre.id;

        this.stockService.getStockEntryHistory(apiFilters)
            .pipe(finalize(() => {
                this.loading = false;
                this.calculateStats();
                this.cdr.markForCheck(); // Ensure UI updates
            }))
            .subscribe({
                next: (data: any[]) => {
                    // Enchant data with items count
                    const enhancedData = data.map((item: any) => ({
                        ...item,
                        itemsCount: item.mouvementsStock?.length || 0,
                        totalAllocated: item.mouvementsStock?.reduce((acc: number, m: any) => acc + m.quantite, 0) || 0
                    }));
                    this.dataSource.data = enhancedData;
                },
                error: (err: any) => {
                    console.error('Error loading history', err);
                }
            });
    }

    calculateStats() {
        const data = this.dataSource.data;
        this.stats = {
            totalEntries: data.length,
            totalItems: data.reduce((acc, curr) => acc + (curr.itemsCount || 0), 0),
            totalValue: data.reduce((acc, curr) => acc + (curr.montantTTC || 0), 0)
        };
    }

    resetFilters() {
        this.filterForm.reset();
        this.loadHistory();
    }

    loadOutHistory() {
        this.loading = true;
        const filters = this.outFilterForm.value;
        const apiFilters: any = { ...filters };
        if (filters.dateFrom) apiFilters.dateFrom = filters.dateFrom.toISOString();
        if (filters.dateTo) apiFilters.dateTo = filters.dateTo.toISOString();

        const centre = this.currentCentre();
        if (centre?.id) apiFilters.centreId = centre.id;

        this.stockService.getStockOutHistory(apiFilters)
            .pipe(finalize(() => {
                this.loading = false;
                this.calculateOutStats();
                this.cdr.markForCheck();
            }))
            .subscribe({
                next: (data: any[]) => {
                    this.outDataSource.data = data;
                },
                error: (err: any) => console.error('Error loading out history', err)
            });
    }

    calculateOutStats() {
        const data = this.outDataSource.data;
        this.outStats = {
            totalSorties: data.length,
            totalItems: data.reduce((acc, curr) => acc + (curr.itemsCount || 0), 0)
        };
    }

    resetOutFilters() {
        this.outFilterForm.reset();
        this.loadOutHistory();
    }

    setPeriod(period: string) {
        const now = new Date();
        let from = new Date();
        let to = new Date();

        switch (period) {
            case 'TODAY':
                from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
                break;
            case 'YESTERDAY':
                from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
                to = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999);
                break;
            case 'THIS_WEEK':
                const day = now.getDay() || 7; // Get current day number, 1 (Mon) to 7 (Sun)
                from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (day - 1));
                from.setHours(0, 0, 0, 0);
                to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
                break;
            case 'THIS_MONTH':
                from = new Date(now.getFullYear(), now.getMonth(), 1);
                to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
                break;
            case 'LAST_MONTH':
                from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                to = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
                break;
            case 'THIS_YEAR':
                from = new Date(now.getFullYear(), 0, 1);
                to = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
                break;
        }

        const currentForm = this.activeTabIndex === 0 ? this.filterForm : this.outFilterForm;
        currentForm.patchValue({ dateFrom: from, dateTo: to });

        if (this.activeTabIndex === 0) this.loadHistory();
        else this.loadOutHistory();
    }

    getWarehouseSummary(element: any): any[] {
        const summary = new Map<string, number>();
        element.mouvementsStock?.forEach((m: any) => {
            const warehouseName = m.entrepotDestination?.nom || 'Inconnu';
            const current = summary.get(warehouseName) || 0;
            summary.set(warehouseName, current + m.quantite);
        });
        return Array.from(summary.entries()).map(([name, count]) => ({ name, count }));
    }

    getAttachmentUrl(path: string): string {
        if (!path) return '';
        // Handle multiple files (take first)
        const firstPath = path.split(';')[0];
        if (firstPath.startsWith('http')) return firstPath;
        return `${environment.apiUrl}${firstPath}`;
    }

    deleteEntry(element: any) {
        if (confirm(`Êtes-vous sûr de vouloir supprimer cette entrée (${element.numeroFacture}) ? \n\nATTENTION: Cela annulera l'ajout en stock et supprimera la dépense associée.`)) {
            this.loading = true;
            this.stockService.deleteHistory(element.id).subscribe({
                next: () => {
                    this.snackBar.open('Entrée supprimée avec succès (Stock et Dépenses mis à jour)', 'OK', { duration: 5000 });
                    this.loadHistory();
                },
                error: (err: any) => {
                    this.loading = false;
                    console.error('Erreur suppression:', err);
                    this.snackBar.open('Erreur lors de la suppression', 'Fermer', { duration: 5000 });
                }
            });
        }
    }
}
