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
        MatProgressSpinnerModule
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
            justificationEcart: [''],
        });

        // Recalculate ecart on value change
        this.form.get('soldeReel')?.valueChanges.subscribe((val) => {
            this.calculateEcart(val);
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

        this.journeeService.getResume(this.journeeId).subscribe({
            next: (resume) => {
                this.resume = resume;
                this.loading = false;

                // Check if already closed
                if (resume.journee.statut === 'FERMEE') {
                    this.snackBar.open('Cette caisse est déjà fermée', 'Info', { duration: 3000 });
                    this.router.navigate(['/finance/caisse']);
                }

                // Initialize form
                this.calculateEcart(this.form.value.soldeReel);
            },
            error: (error) => {
                console.error('Error loading summary', error);
                this.loading = false;
            },
        });
    }

    calculateEcart(soldeReel: number): void {
        if (!this.resume) return;

        const soldeTheorique = this.resume.soldeTheorique;
        this.ecart = soldeReel - soldeTheorique;

        // Update validation for justification
        const justificationControl = this.form.get('justificationEcart');
        if (Math.abs(this.ecart) > 0.01) {
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
            const dto = {
                soldeReel: this.form.value.soldeReel,
                justificationEcart: this.form.value.justificationEcart,
                responsableCloture: this.currentUser,
            };

            this.journeeService.cloturer(this.journeeId, dto).subscribe({
                next: () => {
                    this.submitting = false;
                    this.snackBar.open('Caisse clôturée avec succès', 'OK', { duration: 3000 });
                    this.router.navigate(['/finance/caisse']);
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

    cancel(): void {
        if (this.journeeId) {
            this.router.navigate(['/finance/caisse/live', this.journeeId]);
        } else {
            this.router.navigate(['/finance/caisse']);
        }
    }
}
