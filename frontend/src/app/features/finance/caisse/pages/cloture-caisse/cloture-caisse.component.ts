import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatStepperModule } from '@angular/material/stepper';
import { catchError, finalize, of, timeout } from 'rxjs';
import { JourneeCaisseService } from '../../services/journee-caisse.service';
import { JourneeResume } from '../../models/caisse.model';

@Component({
    selector: 'app-cloture-caisse',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatCardModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
        MatSnackBarModule,
        MatDialogModule,
        MatProgressSpinnerModule,
        MatIconModule,
        MatStepperModule
    ],
    templateUrl: './cloture-caisse.component.html',
    styleUrls: ['./cloture-caisse.component.scss'],
})
export class ClotureCaisseComponent implements OnInit {
    form: FormGroup;
    journeeId: string | null = null;
    resume: JourneeResume | null = null;
    loading = true;
    submitting = false;
    ecart = 0;
    ecartCarteMontant = 0;
    ecartCarteNombre = 0;
    ecartChequeMontant = 0;
    ecartChequeNombre = 0;
    currentUser = 'Utilisateur Test'; // TODO: Get from AuthService

    constructor(
        private fb: FormBuilder,
        private journeeService: JourneeCaisseService,
        private router: Router,
        private route: ActivatedRoute,
        private snackBar: MatSnackBar
    ) {
        this.form = this.fb.group({
            soldeReel: [0, [Validators.required, Validators.min(0)]],
            nbRecuCarte: [0, [Validators.required, Validators.min(0)]],
            montantTotalCarte: [0, [Validators.required, Validators.min(0)]],
            nbRecuCheque: [0, [Validators.required, Validators.min(0)]],
            montantTotalCheque: [0, [Validators.required, Validators.min(0)]],
            justificationEcart: [''],
        });

        // Recalculate ecart on any value change
        this.form.valueChanges.subscribe(() => {
            this.calculateEcart();
        });
    }

    ngOnInit(): void {
        this.route.params.subscribe((params) => {
            this.journeeId = params['id'];
            if (this.journeeId) {
                this.loadData();
            }
        });
    }

    loadData(): void {
        if (!this.journeeId) return;

        this.loading = true;
        this.journeeService.getResume(this.journeeId).pipe(
            timeout(10000),
            catchError((error) => {
                console.error('Error loading summary', error);
                this.snackBar.open(
                    'Délai d\'attente dépassé ou erreur de connexion. Veuillez réessayer.',
                    'Rafraîchir',
                    { duration: 5000 }
                ).onAction().subscribe(() => window.location.reload());
                return of(null);
            }),
            finalize(() => {
                this.loading = false;
            })
        ).subscribe({
            next: (resume) => {
                if (resume) {
                    this.resume = resume;

                    // Check if already closed
                    if (resume.journee.statut === 'FERMEE') {
                        this.snackBar.open('Cette caisse est déjà fermée', 'Info', { duration: 3000 });
                        this.router.navigate(['/p/finance/caisse']);
                    }

                    // Initialize form
                    this.calculateEcart();
                }
            },
        });
    }

    calculateEcart(): void {
        if (!this.resume) return;

        const val = this.form.value;

        // 1. Espèces
        this.ecart = val.soldeReel - this.resume.soldeTheorique;

        // 2. Carte vs Resume
        this.ecartCarteMontant = val.montantTotalCarte - (this.resume.totalVentesCarte || 0);
        this.ecartCarteNombre = val.nbRecuCarte - (this.resume.nbVentesCarte || 0);

        // 3. Cheque vs Resume
        this.ecartChequeMontant = val.montantTotalCheque - (this.resume.totalVentesCheque || 0);
        this.ecartChequeNombre = val.nbRecuCheque - (this.resume.nbVentesCheque || 0);

        const hasAnyDiscrepancy =
            Math.abs(this.ecart) > 0.01 ||
            Math.abs(this.ecartCarteMontant) > 0.01 ||
            this.ecartCarteNombre !== 0 ||
            Math.abs(this.ecartChequeMontant) > 0.01 ||
            this.ecartChequeNombre !== 0;

        // Update validation for justification
        const justificationControl = this.form.get('justificationEcart');
        if (hasAnyDiscrepancy) {
            justificationControl?.setValidators(Validators.required);
        } else {
            justificationControl?.clearValidators();
        }
        justificationControl?.updateValueAndValidity();
    }

    onSubmit(): void {
        if (this.form.valid && this.journeeId) {
            if (!confirm('Êtes-vous sûr de vouloir clôturer définitivement cette caisse ? Cette action est irréversible.')) {
                return;
            }

            this.submitting = true;
            this.journeeService.cloturer(this.journeeId, {
                ...this.form.value,
                responsableCloture: this.currentUser
            }).subscribe({
                next: () => {
                    this.submitting = false;
                    this.snackBar.open('Caisse clôturée avec succès', 'OK', { duration: 3000 });
                    this.router.navigate(['/p/finance/caisse']);
                },
                error: (error) => {
                    this.submitting = false;
                    console.error('Error closing session', error);
                    this.snackBar.open(
                        error.error?.message || 'Erreur lors de la clôture',
                        'Fermer',
                        { duration: 5000 }
                    );
                },
            });
        }
    }

    getSolde(): number {
        if (!this.resume) return 0;
        return (this.resume.fondInitial || 0) +
            (this.resume.totalVentesEspeces || 0) +
            (this.resume.totalInterne || 0) -
            (this.resume.totalDepenses || 0);
    }

    cancel(): void {
        if (this.journeeId) {
            this.router.navigate(['/p/finance/caisse/live', this.journeeId]);
        } else {
            this.router.navigate(['/p/finance/caisse']);
        }
    }
}
