import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { FactureService } from '../../services/facture.service';
import { PaymentDialogComponent, Payment } from '../payment-dialog/payment-dialog.component';
import { numberToFrench } from '../../../../utils/number-to-text';

@Component({
    selector: 'app-facture-form',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        FormsModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatDatepickerModule,
        MatNativeDateModule,
        MatButtonModule,
        MatIconModule,
        MatCardModule,
        MatDividerModule,
        RouterModule
    ],
    templateUrl: './facture-form.component.html',
    styleUrls: ['./facture-form.component.scss']
})
export class FactureFormComponent implements OnInit {
    @Input() factureId: string | null = null;
    @Input() clientIdInput: string | null = null;
    @Input() ficheIdInput: string | null = null;
    @Input() initialLines: any[] = [];
    @Input() embedded = false;
    @Input() nomenclature: string | null = null;
    @Output() onSaved = new EventEmitter<any>();
    @Output() onCancelled = new EventEmitter<void>();

    form: FormGroup;
    id: string | null = null;
    isViewMode = false;

    // Totals
    totalHT = 0;
    totalTVA = 0;
    totalTTC = 0;
    montantLettres = '';
    calculatedGlobalDiscount = 0;

    // Payments
    paiements: Payment[] = [];
    montantPaye = 0;
    resteAPayer = 0;

    constructor(
        private fb: FormBuilder,
        private route: ActivatedRoute,
        private router: Router,
        private factureService: FactureService,
        private snackBar: MatSnackBar,
        private dialog: MatDialog
    ) {
        this.form = this.fb.group({
            type: ['FACTURE', Validators.required],
            statut: ['BROUILLON', Validators.required],
            dateEmission: [new Date(), Validators.required],
            clientId: ['', Validators.required],
            lignes: this.fb.array([]),
            proprietes: this.fb.group({
                tvaRate: [0.20], // Default 20%
                nomenclature: [''],
                remiseGlobalType: ['PERCENT'], // PERCENT or AMOUNT
                remiseGlobalValue: [0]
            })
        });
    }

    ngOnInit(): void {
        if (this.nomenclature && this.embedded) {
            this.form.patchValue({ proprietes: { nomenclature: this.nomenclature } });
        }

        if (this.embedded) {
            this.handleEmbeddedInit();
        } else {
            this.handleRouteInit();
        }
    }

    handleEmbeddedInit() {
        this.id = this.factureId;
        if (this.clientIdInput) {
            this.form.patchValue({ clientId: this.clientIdInput });
        }

        if (this.id && this.id !== 'new') {
            this.loadFacture(this.id);
        } else {
            // New embedded invoice
            if (this.initialLines && this.initialLines.length > 0) {
                this.lignes.clear();
                this.initialLines.forEach(l => {
                    const group = this.createLigne();
                    group.patchValue(l);
                    this.lignes.push(group);
                });
                this.calculateTotals();
            } else {
                this.addLine();
            }
        }
    }

    handleRouteInit() {
        this.route.queryParams.subscribe(params => {
            const clientId = params['clientId'];
            const type = params['type'];
            const sourceFactureId = params['sourceFactureId'];

            const patchData: any = {};
            if (clientId) patchData.clientId = clientId;
            if (type) patchData.type = type;

            if (Object.keys(patchData).length > 0) {
                this.form.patchValue(patchData);
            }

            if (sourceFactureId) {
                this.loadSourceFacture(sourceFactureId);
            }
        });

        this.id = this.route.snapshot.paramMap.get('id');
        if (this.id && this.id !== 'new') {
            this.loadFacture(this.id);
        } else {
            // Add one empty line by default
            this.addLine();
        }
    }

    get lignes(): FormArray {
        return this.form.get('lignes') as FormArray;
    }

    createLigne(): FormGroup {
        return this.fb.group({
            description: ['', Validators.required],
            qte: [1, [Validators.required, Validators.min(1)]],
            prixUnitaireTTC: [0, [Validators.required, Validators.min(0)]],
            remise: [0],
            totalTTC: [0]
        });
    }

    addLine() {
        this.lignes.push(this.createLigne());
    }

    removeLine(index: number) {
        this.lignes.removeAt(index);
        this.calculateTotals();
    }

    onLineChange(index: number) {
        const line = this.lignes.at(index);
        const qte = line.get('qte')?.value || 0;
        const puTTC = line.get('prixUnitaireTTC')?.value || 0;
        const remise = line.get('remise')?.value || 0;

        const total = (qte * puTTC) - remise;
        line.patchValue({ totalTTC: total }, { emitEvent: false });

        this.calculateTotals();
    }

    calculateTotals() {
        const rawTotalTTC = this.lignes.controls.reduce((sum, control) => {
            return sum + (control.get('totalTTC')?.value || 0);
        }, 0);

        // Apply Global Discount
        const props = this.form.get('proprietes')?.value;
        const remiseType = props?.remiseGlobalType || 'PERCENT';
        const remiseValue = props?.remiseGlobalValue || 0;

        let globalDiscount = 0;
        if (remiseValue > 0) {
            if (remiseType === 'PERCENT') {
                globalDiscount = rawTotalTTC * (remiseValue / 100);
            } else {
                globalDiscount = remiseValue;
            }
        }

        this.calculatedGlobalDiscount = globalDiscount;
        this.totalTTC = Math.max(0, rawTotalTTC - globalDiscount);

        const tvaRate = 0.20; // Fixed 20% for now
        this.totalHT = this.totalTTC / (1 + tvaRate);
        this.totalTVA = this.totalTTC - this.totalHT;

        this.montantLettres = this.numberToText(this.totalTTC);

        // Update payment status if totals change
        this.calculatePaymentTotals();
        this.updateStatutFromPayments();
    }

    loadFacture(id: string) {
        this.factureService.findOne(id).subscribe({
            next: (facture) => {
                this.form.patchValue({
                    type: facture.type,
                    statut: facture.statut,
                    dateEmission: facture.dateEmission,
                    clientId: facture.clientId
                });

                // Patch lines
                this.lignes.clear();
                if (facture.lignes) {
                    (facture.lignes as any[]).forEach((l: any) => {
                        const lineGroup = this.createLigne();
                        lineGroup.patchValue(l);
                        this.lignes.push(lineGroup);
                    });
                }

                // Load payments
                if (facture.paiements) {
                    this.paiements = facture.paiements as any[];
                }

                this.calculateTotals();
                this.calculatePaymentTotals();
                this.updateStatutFromPayments();

                // Check for explicit view mode from query params
                const isExplicitViewMode = this.route.snapshot.queryParamMap.get('mode') === 'view';

                // Only allow editing if status is BROUILLON AND not in explicit view mode
                this.isViewMode = facture.statut !== 'BROUILLON' || isExplicitViewMode;

                if (this.isViewMode) {
                    this.form.disable();
                } else {
                    this.form.enable();
                }
            },
            error: (err) => {
                console.error(err);
                this.snackBar.open('Erreur lors du chargement', 'Fermer', { duration: 3000 });
            }
        });
    }

    save() {
        if (this.form.invalid) return;

        const formData = this.form.getRawValue();
        const factureData = {
            ...formData,
            totalHT: this.totalHT,
            totalTVA: this.totalTVA,
            totalTTC: this.totalTTC,
            montantLettres: this.montantLettres,
            paiements: this.paiements,
            resteAPayer: this.resteAPayer
        };

        const request = this.id && this.id !== 'new'
            ? this.factureService.update(this.id, factureData)
            : this.factureService.create(factureData);

        request.subscribe({
            next: (facture) => {
                this.snackBar.open('Document enregistré avec succès', 'Fermer', { duration: 3000 });
                if (this.embedded) {
                    this.onSaved.emit(facture);
                } else if (!this.id || this.id === 'new') {
                    this.router.navigate(['/p/clients']);
                }
            },
            error: (err) => {
                console.error('Erreur sauvegarde facture:', err);
                this.snackBar.open('Erreur lors de l\'enregistrement', 'Fermer', { duration: 3000 });
            }
        });
    }

    numberToText(num: number): string {
        return numberToFrench(num);
    }

    loadSourceFacture(id: string) {
        this.factureService.findOne(id).subscribe({
            next: (facture) => {
                // Copy lines from source invoice
                this.lignes.clear();
                if (facture.lignes) {
                    (facture.lignes as any[]).forEach((l: any) => {
                        const lineGroup = this.createLigne();
                        lineGroup.patchValue(l);
                        this.lignes.push(lineGroup);
                    });
                }
                this.calculateTotals();
                this.snackBar.open('Données chargées depuis la facture ' + facture.numero, 'OK', { duration: 3000 });
            },
            error: (err) => console.error('Error loading source facture', err)
        });
    }

    // ===== PAYMENT METHODS =====

    openPaymentDialog() {
        const dialogRef = this.dialog.open(PaymentDialogComponent, {
            width: '800px',
            maxWidth: '90vw',
            data: { resteAPayer: this.resteAPayer }
        });

        dialogRef.afterClosed().subscribe((payment: Payment) => {
            if (payment) {
                this.addPayment(payment);
            }
        });
    }

    addPayment(payment: Payment) {
        this.paiements.push(payment);
        this.calculatePaymentTotals();
        this.updateStatutFromPayments();
    }

    removePayment(index: number) {
        this.paiements.splice(index, 1);
        this.calculatePaymentTotals();
        this.updateStatutFromPayments();
    }

    calculatePaymentTotals() {
        this.montantPaye = this.paiements.reduce((sum, p) => sum + p.montant, 0);
        this.resteAPayer = this.totalTTC - this.montantPaye;
    }

    updateStatutFromPayments() {
        if (this.resteAPayer <= 0 && this.totalTTC > 0) {
            this.form.patchValue({ statut: 'PAYEE' });
        } else if (this.montantPaye > 0) {
            this.form.patchValue({ statut: 'PARTIEL' });
        }
    }

    getPaymentStatusBadge(): { label: string; class: string } {
        if (this.resteAPayer <= 0 && this.totalTTC > 0) {
            return { label: 'PAYÉE', class: 'badge-paid' };
        } else if (this.montantPaye > 0) {
            return { label: 'PARTIEL', class: 'badge-partial' };
        } else {
            return { label: 'IMPAYÉE', class: 'badge-unpaid' };
        }
    }

    getPaymentModeLabel(mode: string): string {
        const modes: any = {
            'ESPECES': 'Espèces',
            'CARTE': 'Carte',
            'CHEQUE': 'Chèque',
            'VIREMENT': 'Virement',
            'AUTRE': 'Autre'
        };
        return modes[mode] || mode;
    }
}
