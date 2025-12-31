import { ChangeDetectorRef, Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Store } from '@ngrx/store';
import { TenantSelector } from '../../../../../core/store/auth/auth.selectors';
import { CaisseFormDialogComponent } from '../../components/caisse-form-dialog/caisse-form-dialog.component';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { CaisseService } from '../../services/caisse.service';
import { JourneeCaisseService } from '../../services/journee-caisse.service';
import { Caisse } from '../../models/caisse.model';
import { Observable, BehaviorSubject, combineLatest, Subscription } from 'rxjs';
import { take, switchMap, tap } from 'rxjs/operators';

@Component({
    selector: 'app-caisse-list',
    standalone: true,
    imports: [
        CommonModule,
        MatCardModule,
        MatButtonModule,
        MatIconModule,
        MatChipsModule,
        MatProgressSpinnerModule,
        MatDialogModule,
        MatTooltipModule,
        MatDividerModule,
        RouterModule
    ],
    templateUrl: './caisse-list.component.html',
    styleUrls: ['./caisse-list.component.scss'],
})
export class CaisseListComponent implements OnInit, OnDestroy {
    caisses: Caisse[] = [];
    loading = true;
    isManagementMode = false;
    private reload$ = new BehaviorSubject<void>(undefined);
    private subscription: Subscription = new Subscription();

    constructor(
        private caisseService: CaisseService,
        private journeeService: JourneeCaisseService,
        private router: Router,
        private route: ActivatedRoute,
        private store: Store,
        private dialog: MatDialog,
        private cdr: ChangeDetectorRef
    ) { }

    ngOnInit(): void {
        this.isManagementMode = this.route.snapshot.data['mode'] === 'management';

        this.subscription.add(
            combineLatest([
                this.store.select(TenantSelector),
                this.reload$
            ]).pipe(
                tap(() => {
                    this.loading = true;
                    this.cdr.markForCheck();
                }),
                switchMap(([centreId, _]) => {
                    if (centreId) {
                        return this.caisseService.findByCentre(centreId);
                    } else {
                        return this.caisseService.findAll();
                    }
                })
            ).subscribe({
                next: (caisses) => {
                    this.caisses = caisses;
                    this.loading = false;
                    this.cdr.markForCheck();
                },
                error: (error) => {
                    console.error('Error loading cash registers', error);
                    this.loading = false;
                    this.cdr.markForCheck();
                },
            })
        );
    }

    ngOnDestroy(): void {
        this.subscription.unsubscribe();
    }

    loadCaisses(): void {
        this.reload$.next();
    }

    openCreateDialog(): void {
        this.store.select(TenantSelector)
            .pipe(take(1)) // Ensure we only take the current value and complete
            .subscribe(centreId => {
                if (!centreId) {
                    alert('Veuillez sélectionner un centre d\'abord');
                    return;
                }

                const dialogRef = this.dialog.open(CaisseFormDialogComponent, {
                    width: '500px',
                    data: { centreId: centreId }
                });

                dialogRef.afterClosed().subscribe(result => {
                    if (result) {
                        this.loadCaisses();
                    }
                });
            });
    }

    openSession(caisseId: string): void {
        const baseRoute = this.isManagementMode ? ['p', 'finance', 'caisse'] : [];
        this.router.navigate([...baseRoute, 'ouvrir'], {
            relativeTo: this.isManagementMode ? null : this.route,
            queryParams: { caisseId },
        });
    }

    viewSession(journeeId: string): void {
        const baseRoute = this.isManagementMode ? ['p', 'finance', 'caisse'] : [];
        this.router.navigate([...baseRoute, 'live', journeeId], {
            relativeTo: this.isManagementMode ? null : this.route
        });
    }

    editCaisse(caisse: Caisse): void {
        this.store.select(TenantSelector)
            .pipe(take(1))
            .subscribe(centreId => {
                const dialogRef = this.dialog.open(CaisseFormDialogComponent, {
                    width: '500px',
                    data: { caisse: caisse, centreId: centreId }
                });

                dialogRef.afterClosed().subscribe(result => {
                    if (result) {
                        this.loadCaisses();
                    }
                });
            });
    }

    deleteCaisse(caisse: Caisse): void {
        if (confirm(`Êtes-vous sûr de vouloir supprimer la caisse "${caisse.nom}" ?`)) {
            this.caisseService.delete(caisse.id).subscribe({
                next: () => {
                    this.loadCaisses();
                },
                error: (error) => {
                    console.error('Error deleting caisse', error);
                    alert('Impossible de supprimer la caisse. Elle contient peut-être des données.');
                }
            });
        }
    }

    getOpenSession(caisse: Caisse): string | undefined {
        return caisse.journees?.find((j) => j.statut === 'OUVERTE')?.id;
    }

    get groupedCaisses(): { centerName: string, caisses: Caisse[] }[] {
        const groups: { [key: string]: Caisse[] } = {};

        this.caisses.forEach(caisse => {
            const centerName = caisse.centre?.nom || 'Autre';
            if (!groups[centerName]) {
                groups[centerName] = [];
            }
            groups[centerName].push(caisse);
        });

        return Object.keys(groups).map(name => ({
            centerName: name,
            caisses: groups[name]
        }));
    }
}
