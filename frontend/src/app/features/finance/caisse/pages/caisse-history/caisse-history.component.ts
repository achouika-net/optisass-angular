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
import { Store } from '@ngrx/store';
import { TenantSelector } from '../../../../../core/store/auth/auth.selectors';
import { JourneeCaisseService } from '../../services/journee-caisse.service';
import { JourneeCaisse } from '../../models/caisse.model';
import { take } from 'rxjs/operators';

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
        MatTooltipModule
    ],
    templateUrl: './caisse-history.component.html',
    styleUrls: ['./caisse-history.component.scss']
})
export class CaisseHistoryComponent implements OnInit {
    sessions: JourneeCaisse[] = [];
    loading = true;
    displayedColumns: string[] = ['dateOuverture', 'dateCloture', 'caisse', 'caissier', 'soldeTheorique', 'soldeReel', 'ecart', 'actions'];

    constructor(
        private journeeService: JourneeCaisseService,
        private store: Store,
        private router: Router,
        private cdr: ChangeDetectorRef,
        private zone: NgZone
    ) { }

    ngOnInit(): void {
        this.loadHistory();
    }

    loadHistory(): void {
        this.store.select(TenantSelector).pipe(take(1)).subscribe(centreId => {
            if (centreId) {
                this.zone.run(() => {
                    console.log('[History] Loading history for centre', centreId);
                    this.loading = true;
                    this.cdr.markForCheck();

                    // Optimized call
                    this.journeeService.findHistory(centreId).subscribe({
                        next: (data) => {
                            this.zone.run(() => {
                                console.log('[History] Data received:', data.length);
                                this.sessions = data;
                                this.loading = false;
                                this.cdr.markForCheck();
                                this.cdr.detectChanges();
                            });
                        },
                        error: (err) => {
                            this.zone.run(() => {
                                console.error('[History] Error loading history', err);
                                this.loading = false;
                                this.cdr.markForCheck();
                                this.cdr.detectChanges();
                            });
                        }
                    });
                });
            }
        });
    }

    viewDetails(id: string): void {
        this.router.navigate(['/p/finance/caisse/live', id]);
    }
}
