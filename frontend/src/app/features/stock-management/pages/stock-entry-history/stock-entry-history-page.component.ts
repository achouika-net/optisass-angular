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
import { animate, state, style, transition, trigger } from '@angular/animations';
import { StockMovementsService } from '../../services/stock-movements.service';
import { FinanceService } from '../../../finance/services/finance.service';
import { finalize } from 'rxjs/operators';

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
        ReactiveFormsModule
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
    columnsToDisplay = ['dateEmission', 'fournisseur', 'numeroFacture', 'montantTTC', 'itemsCount', 'expand'];
    expandedElement: any | null;

    filterForm: FormGroup;
    suppliers: any[] = [];
    loading = false;

    constructor(
        private stockService: StockMovementsService,
        private financeService: FinanceService,
        private fb: FormBuilder,
        private cdr: ChangeDetectorRef
    ) {
        this.filterForm = this.fb.group({
            dateFrom: [null],
            dateTo: [null],
            supplierId: [null],
            docType: [null]
        });
    }

    ngOnInit() {
        this.loadSuppliers();
        this.loadHistory();
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

        this.stockService.getStockEntryHistory(apiFilters)
            .pipe(finalize(() => {
                this.loading = false;
                this.cdr.markForCheck(); // Ensure UI updates
            }))
            .subscribe({
                next: (data) => {
                    // Enchant data with items count
                    const enhancedData = data.map(item => ({
                        ...item,
                        itemsCount: item.mouvementsStock?.length || 0,
                        totalAllocated: item.mouvementsStock?.reduce((acc: number, m: any) => acc + m.quantite, 0) || 0
                    }));
                    this.dataSource.data = enhancedData;
                },
                error: (err) => {
                    console.error('Error loading history', err);
                }
            });
    }

    resetFilters() {
        this.filterForm.reset();
        this.loadHistory();
    }

    setPeriod(period: string) {
        const now = new Date();
        let from = new Date();
        let to = new Date();

        switch (period) {
            case 'TODAY':
                from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
                break;
            case 'YESTERDAY':
                from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
                to = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59);
                break;
            case 'THIS_WEEK':
                const day = now.getDay() || 7; // Get current day number, converting Sun. to 7
                if (day !== 1) from.setHours(-24 * (day - 1)); // Set to Monday
                else from.setHours(0, 0, 0, 0); // Is Monday
                to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
                break;
            case 'THIS_MONTH':
                from = new Date(now.getFullYear(), now.getMonth(), 1);
                to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
                break;
            case 'LAST_MONTH':
                from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                to = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
                break;
            case 'THIS_YEAR':
                from = new Date(now.getFullYear(), 0, 1);
                to = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
                break;
        }

        this.filterForm.patchValue({ dateFrom: from, dateTo: to });
        this.loadHistory();
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
}
