import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Store } from '@ngrx/store';
import { take } from 'rxjs/operators';

import { CaisseService } from '../../services/caisse.service';
import { JourneeCaisseService } from '../../services/journee-caisse.service';
import { Caisse } from '../../models/caisse.model';
import { TenantSelector, UserSelector } from '../../../../../core/store/auth/auth.selectors';

@Component({
    selector: 'app-ouverture-caisse',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatCardModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatButtonModule,
        MatSnackBarModule,
    ],
    templateUrl: './ouverture-caisse.component.html',
    styleUrls: ['./ouverture-caisse.component.scss'],
})
export class OuvertureCaisseComponent implements OnInit {
    form: FormGroup;
    caisses: Caisse[] = [];
    loading = false;
    selectedCaisseId: string | null = null;
    currentUser: string = '';
    currentDate = new Date();

    constructor(
        private fb: FormBuilder,
        private caisseService: CaisseService,
        private journeeService: JourneeCaisseService,
        private router: Router,
        private route: ActivatedRoute,
        private snackBar: MatSnackBar,
        private store: Store
    ) {
        this.form = this.fb.group({
            caisseId: ['', Validators.required],
            fondInitial: [0, [Validators.required, Validators.min(0)]],
        });
    }

    ngOnInit(): void {
        this.store.select(UserSelector).pipe(take(1)).subscribe(user => {
            if (user) {
                // Using first_name and last_name from ICurrentUser
                this.currentUser = `${user.first_name || ''} ${user.last_name || ''}`.trim();
            }
        });

        this.route.queryParams.subscribe((params) => {
            this.selectedCaisseId = params['caisseId'];
            this.loadCaisses();
        });

        // Listen for caisse selection changes to auto-fill opening balance
        this.form.get('caisseId')?.valueChanges.subscribe(caisseId => {
            if (caisseId) {
                this.updateOpeningBalance(caisseId);
            }
        });
    }

    updateOpeningBalance(caisseId: string): void {
        this.journeeService.getLastClosingBalance(caisseId).subscribe({
            next: (data) => {
                if (data && typeof data.amount === 'number') {
                    this.form.patchValue({ fondInitial: data.amount });
                    this.snackBar.open(`Fond de caisse initialisé avec le solde de la veille (${data.amount} DH)`, 'OK', {
                        duration: 3000
                    });
                }
            },
            error: (err) => {
                console.error('Error fetching last closing balance', err);
            }
        });
    }

    loadCaisses(): void {
        this.store.select(TenantSelector).pipe(take(1)).subscribe(centreId => {
            if (centreId) {
                this.caisseService.findByCentre(centreId).subscribe({
                    next: (caisses) => {
                        this.caisses = caisses;
                        if (this.selectedCaisseId) {
                            const caisse = this.caisses.find((c) => c.id === this.selectedCaisseId);
                            if (caisse) {
                                this.form.patchValue({ caisseId: caisse.id });
                            }
                        }
                    },
                    error: (error) => {
                        console.error('Error loading cash registers', error);
                        this.snackBar.open('Erreur lors du chargement des caisses', 'Fermer', {
                            duration: 3000,
                        });
                    },
                });
            }
        });
    }

    onSubmit(): void {
        if (this.form.valid) {
            this.loading = true;
            const formValue = this.form.value;
            const selectedCaisse = this.caisses.find((c) => c.id === formValue.caisseId);

            if (!selectedCaisse) return;

            const dto = {
                caisseId: formValue.caisseId,
                centreId: selectedCaisse.centreId,
                fondInitial: formValue.fondInitial,
                caissier: this.currentUser,
            };

            this.journeeService.ouvrir(dto).subscribe({
                next: (journee) => {
                    this.loading = false;
                    this.snackBar.open('Caisse ouverte avec succès', 'OK', {
                        duration: 3000,
                    });
                    // Navigate relative to current route: ../live/:id
                    this.router.navigate(['../live', journee.id], { relativeTo: this.route });
                },
                error: (error) => {
                    this.loading = false;
                    console.error('Error opening cash session', error);
                    this.snackBar.open(
                        error.error?.message || "Erreur lors de l'ouverture de la caisse",
                        'Fermer',
                        { duration: 5000 }
                    );
                },
            });
        }
    }

    cancel(): void {
        this.router.navigate(['../'], { relativeTo: this.route });
    }
}
