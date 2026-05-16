import { Component, OnInit, ChangeDetectorRef, NgZone } from '@angular/core';
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
import { catchError, finalize, of, timeout, retry } from 'rxjs';
import { JourneeCaisseService } from '../../services/journee-caisse.service';
import { JourneeResume } from '../../models/caisse.model';
import { FinancePrintService } from '../../services/finance-print.service';
import { CompanySettingsService } from '../../../core/services/company-settings.service';
import { CompanySettings } from '../../../shared/interfaces/company-settings.interface';

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
        private snackBar: MatSnackBar,
        private cdr: ChangeDetectorRef,
        private zone: NgZone,
        private financePrintService: FinancePrintService,
        private companySettingsService: CompanySettingsService
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

    companySettings: CompanySettings | null = null;

    ngOnInit(): void {
        this.companySettingsService.settings$.subscribe(settings => {
            this.companySettings = settings;
        });
        this.route.params.subscribe((params) => {
            this.journeeId = params['id'];
            if (this.journeeId) {
                this.loadData();
            }
        });
    }

    loadData(): void {
        if (!this.journeeId) return;

        this.zone.run(() => {
            console.log('[ClotureCaisse] Starting loadData for', this.journeeId);
            this.loading = true;
            this.cdr.markForCheck();

            this.journeeService.getResume(this.journeeId!).pipe(
                timeout(30000),
                retry(1),
                catchError((error) => {
                    console.error('[ClotureCaisse] Error loading summary', error);
                    this.zone.run(() => {
                        this.snackBar.open(
                            'Erreur ou timeout. Veuillez rafraîchir.',
                            'Rafraîchir',
                            { duration: 5000 }
                        ).onAction().subscribe(() => window.location.reload());
                    });
                    return of(null);
                }),
                finalize(() => {
                    this.zone.run(() => {
                        console.log('[ClotureCaisse] Finalize. Loading set to false.');
                        this.loading = false;
                        this.cdr.markForCheck();
                        this.cdr.detectChanges();
                    });
                })
            ).subscribe({
                next: (resume) => {
                    this.zone.run(() => {
                        console.log('[ClotureCaisse] Resume received:', resume ? 'YES' : 'NULL');
                        if (resume) {
                            this.resume = resume;

                            // Check if already closed
                            if (resume.journee.statut === 'FERMEE') {
                                this.snackBar.open('Cette caisse est déjà fermée', 'Info', { duration: 3000 });
                                this.router.navigate(['/p/finance/caisse']);
                            }

                            // Initialize form
                            this.calculateEcart();

                            // Force update
                            this.cdr.markForCheck();
                            this.cdr.detectChanges();
                        }
                    });
                },
            });
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

    private downloadCSV(data: any[], filename: string, headers: string[]): void {
        if (!data || data.length === 0) return;
        
        let csvContent = '\uFEFF';
        csvContent += headers.join(';') + '\n';
        
        data.forEach(row => {
            const rowStr = headers.map(header => {
                let cell = row[header] === null || row[header] === undefined ? '' : row[header];
                cell = String(cell).replace(/"/g, '""');
                return `"${cell}"`;
            }).join(';');
            csvContent += rowStr + '\n';
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    exportExcelBilan(): void {
        if (!this.resume) return;

        const data = [
            { 'Catégorie': 'Recettes de la Journée', 'Montant': this.resume.totalRecettes },
            { 'Catégorie': '- Espèces', 'Montant': this.resume.recettesDetails.espaces },
            { 'Catégorie': '- Carte', 'Montant': this.resume.recettesDetails.carte },
            { 'Catégorie': '- Chèque', 'Montant': this.resume.recettesDetails.cheque },
            { 'Catégorie': '- En Coffre', 'Montant': this.resume.recettesDetails.enCoffre },
            { 'Catégorie': 'Décaissements du jour', 'Montant': this.resume.totalDepenses },
            { 'Catégorie': 'Solde Caisse (Espèces)', 'Montant': this.getSolde() },
            { 'Catégorie': '- Fond initial', 'Montant': this.resume.fondInitial }
        ];

        this.downloadCSV(data, `Bilan_Cloture_${this.resume.journee.caisse.nom}_${new Date().toISOString().split('T')[0]}.csv`, Object.keys(data[0]));
    }

    printBilan(): void {
        if (!this.resume) return;

        const columns = [
            { key: 'category', label: 'Catégorie' },
            { key: 'montantStr', label: 'Montant' }
        ];

        const items = [
            { category: 'Recettes de la Journée', montantStr: this.resume.totalRecettes.toFixed(2) + ' DH' },
            { category: '  - Espèces', montantStr: this.resume.recettesDetails.espaces.toFixed(2) + ' DH' },
            { category: '  - Carte', montantStr: this.resume.recettesDetails.carte.toFixed(2) + ' DH' },
            { category: '  - Chèque', montantStr: this.resume.recettesDetails.cheque.toFixed(2) + ' DH' },
            { category: '  - En Coffre', montantStr: this.resume.recettesDetails.enCoffre.toFixed(2) + ' DH' },
            { category: 'Décaissements du jour', montantStr: this.resume.totalDepenses.toFixed(2) + ' DH' },
            { category: 'Solde Caisse Théorique', montantStr: this.getSolde().toFixed(2) + ' DH' },
            { category: '  - Fond initial', montantStr: this.resume.fondInitial.toFixed(2) + ' DH' }
        ];

        const totals = {
            'Caisse': this.resume.journee.caisse.nom,
            'Ouverte par': this.resume.journee.caissier,
            'Statut': this.resume.journee.statut
        };

        const title = `Bilan de Caisse - ${this.resume.journee.caisse.nom}`;
        this.financePrintService.printFinanceTable(title, columns, items, totals, this.companySettings);
    }
}
