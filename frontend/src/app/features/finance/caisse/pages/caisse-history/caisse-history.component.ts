import { Component, OnInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { Store } from '@ngrx/store';
import { TenantSelector } from '../../../../../core/store/auth/auth.selectors';
import { JourneeCaisseService } from '../../services/journee-caisse.service';
import { JourneeCaisse } from '../../models/caisse.model';

@Component({
    selector: 'app-caisse-history',
    standalone: true,
    imports: [
        CommonModule,
        RouterModule,
        MatCardModule,
        MatTableModule,
        MatButtonModule,
        MatIconModule,
        MatChipsModule,
        MatProgressSpinnerModule,
        MatDividerModule,
        MatTooltipModule,
        MatFormFieldModule,
        MatSelectModule,
        MatDatepickerModule,
        MatNativeDateModule,
        MatInputModule,
        FormsModule
    ],
    templateUrl: './caisse-history.component.html',
    styleUrls: ['./caisse-history.component.scss']
})
export class CaisseHistoryComponent implements OnInit {
    sessions: JourneeCaisse[] = [];
    loading = true;
    displayedColumns: string[] = ['dateOuverture', 'dateCloture', 'caisse', 'caissier', 'soldeTheorique', 'soldeReel', 'ecart', 'actions'];

    selectedPeriod: string = 'thisMonth';
    startDate: Date | null = null;
    endDate: Date | null = null;
    centreId: string | null = null;

    constructor(
        private journeeService: JourneeCaisseService,
        private store: Store,
        private router: Router,
        private cdr: ChangeDetectorRef,
        private zone: NgZone
    ) { }

    ngOnInit(): void {
        this.store.select(TenantSelector).subscribe(id => {
            if (id) {
                this.centreId = id;
                this.setPeriod(this.selectedPeriod);
            }
        });
    }

    setPeriod(period: string): void {
        const now = new Date();
        const start = new Date();
        const end = new Date();

        switch (period) {
            case 'today':
                start.setHours(0, 0, 0, 0);
                break;
            case 'yesterday':
                start.setDate(now.getDate() - 1);
                start.setHours(0, 0, 0, 0);
                end.setDate(now.getDate() - 1);
                end.setHours(23, 59, 59, 999);
                break;
            case 'thisWeek':
                const day = now.getDay();
                const diff = now.getDate() - day + (day === 0 ? -6 : 1);
                start.setDate(diff);
                start.setHours(0, 0, 0, 0);
                break;
            case 'thisMonth':
                start.setDate(1);
                start.setHours(0, 0, 0, 0);
                break;
            case 'lastMonth':
                start.setMonth(now.getMonth() - 1);
                start.setDate(1);
                start.setHours(0, 0, 0, 0);
                end.setMonth(now.getMonth());
                end.setDate(0);
                end.setHours(23, 59, 59, 999);
                break;
            case 'custom':
                // Keep current dates
                return;
            default:
                break;
        }

        this.startDate = start;
        this.endDate = end;
        this.loadHistory();
    }

    loadHistory(): void {
        if (!this.centreId) return;

        this.zone.run(() => {
            this.loading = true;
            this.cdr.markForCheck();

            const startStr = this.startDate?.toISOString();
            const endStr = this.endDate?.toISOString();

            this.journeeService.findHistory(this.centreId!, startStr, endStr).subscribe({
                next: (data) => {
                    this.zone.run(() => {
                        this.sessions = data;
                        this.loading = false;
                        this.cdr.markForCheck();
                        this.cdr.detectChanges();
                    });
                },
                error: (err) => {
                    this.zone.run(() => {
                        this.loading = false;
                        this.cdr.markForCheck();
                        this.cdr.detectChanges();
                    });
                }
            });
        });
    }

    viewDetails(id: string): void {
        this.router.navigate(['/p/finance/caisse/live', id]);
    }
}
