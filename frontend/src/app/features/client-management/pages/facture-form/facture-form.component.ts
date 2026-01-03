import { Component, OnInit, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
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
import { PaiementService } from '../../services/paiement.service';
import { PaymentDialogComponent, Payment } from '../../dialogs/payment-dialog/payment-dialog.component';
import { LoyaltyService } from '../../services/loyalty.service';
import { ClientManagementService } from '../../services/client.service';
import { numberToFrench } from '../../../../utils/number-to-text';
import { Store } from '@ngrx/store';
import { UserCurrentCentreSelector } from '../../../../core/store/auth/auth.selectors';
import { take } from 'rxjs';

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
    @Input() isReadonly = false;
    @Output() onSaved = new EventEmitter<any>();
    @Output() onCancelled = new EventEmitter<void>();

    form: FormGroup;
    id: string | null = null;
    isViewMode = false;
    client: any = null;
    centreId: string | null = null;

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

    // Loyalty
    pointsFideliteClient = 0;

    constructor(
        private fb: FormBuilder,
        private route: ActivatedRoute,
        private router: Router,
        private factureService: FactureService,
        private paiementService: PaiementService,
        private loyaltyService: LoyaltyService,
        private clientService: ClientManagementService,
        private snackBar: MatSnackBar,
        private dialog: MatDialog,
        private store: Store
    ) {
        this.form = this.fb.group({
            numero: [''], // Auto-generated
            type: ['DEVIS', Validators.required], // [MODIFIED] Default to DEVIS
            statut: ['BROUILLON', Validators.required],
            dateEmission: [new Date(), Validators.required],
            clientId: ['', Validators.required],
            lignes: this.fb.array([]),
            proprietes: this.fb.group({
                tvaRate: [0.20], // Default 20%
                nomenclature: [''],
                remiseGlobalType: ['PERCENT'], // PERCENT or AMOUNT
                remiseGlobalValue: [0],
                pointsUtilises: [0]
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

    ngOnChanges(changes: SimpleChanges) {
        if (changes['isReadonly']) {
            this.updateViewMode();
        }
        if (changes['factureId'] && this.factureId && this.factureId !== this.id) {
            // Reload if input ID changes
            this.id = this.factureId;
            if (this.id !== 'new') {
                this.loadFacture(this.id);
            }
        }
        if (changes['nomenclature'] && this.nomenclature && this.embedded) {
            this.form.get('proprietes')?.patchValue({ nomenclature: this.nomenclature });
        }
        if (changes['initialLines'] && this.initialLines && (!this.id || this.id === 'new')) {
            // Update lines from new initialLines if we are in creation mode
            // But we should be careful not to overwrite manual edits if possible.
            // For now, if initialLines updates (e.g. equipment changed), we replace.
            this.lignes.clear();
            this.initialLines.forEach(l => {
                const group = this.createLigne();
                group.patchValue(l);
                this.lignes.push(group);
            });
            this.calculateTotals();
        }
    }
    // ... (rest of methods) - RESTORED
    updateViewMode() {
        // Check if we're in explicit view mode from route
        const isExplicitViewMode = this.route?.snapshot?.queryParamMap?.get('mode') === 'view';

        // Only treat as read-only if explicitly in view mode or readonly flag is set
        if (this.isReadonly || isExplicitViewMode) {
            this.isViewMode = true;
            this.form.disable();
        } else {
            this.isViewMode = false;
            this.form.enable();
            this.form.get('numero')?.disable();
            this.form.get('proprietes.pointsUtilises')?.enable();
        }
    }

    loadClientPoints(clientId: string) {
        if (!clientId) return;
        this.loyaltyService.getPointsBalance(clientId).subscribe({
            next: (points) => this.pointsFideliteClient = points,
            error: (err) => console.error('Error loading client points', err)
        });
    }

    handleEmbeddedInit() {
        this.id = this.factureId;
        if (this.clientIdInput) {
            this.form.patchValue({ clientId: this.clientIdInput });
            this.loadClientPoints(this.clientIdInput);
        }

        if (this.id && this.id !== 'new') {
            this.loadFacture(this.id);
        } else {
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
            // Disable form for embedded new invoices too
            this.updateViewMode();
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
                if (patchData.clientId) this.loadClientPoints(patchData.clientId);
            }

            if (sourceFactureId) {
                this.loadSourceFacture(sourceFactureId);
            }
        });

        this.id = this.route.snapshot.paramMap.get('id');
        if (this.id && this.id !== 'new') {
            this.loadFacture(this.id);
        } else {
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
            totalTTC: [0],
            productId: [null],
            entrepotId: [null],
            entrepotType: [null],
            entrepotNom: [null]
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

        // Points Fidelio Deduction (1 point = 1 MAD)
        const pointsUtilises = props?.pointsUtilises || 0;
        const discountFromPoints = pointsUtilises;

        this.calculatedGlobalDiscount = globalDiscount + discountFromPoints;

        // Check for AVOIR type to allow negative totals
        const type = this.form.get('type')?.value;
        if (type === 'AVOIR' || type === 'AVOIR_FOURNISSEUR') {
            this.totalTTC = rawTotalTTC - this.calculatedGlobalDiscount;
        } else {
            this.totalTTC = Math.max(0, rawTotalTTC - this.calculatedGlobalDiscount);
        }

        const tvaRate = 0.20;
        this.totalHT = this.totalTTC / (1 + tvaRate);
        this.totalTVA = this.totalTTC - this.totalHT;

        this.montantLettres = this.numberToText(this.totalTTC);

        this.calculatePaymentTotals();
        this.updateStatutFromPayments();
    }

    loadFacture(id: string) {
        this.factureService.findOne(id).subscribe({
            next: (facture) => {
                console.log('📄 Loaded facture:', facture);
                console.log('📋 Nomenclature:', facture.proprietes?.nomenclature);

                this.form.patchValue({
                    numero: facture.numero,
                    type: facture.type,
                    statut: facture.statut,
                    dateEmission: facture.dateEmission,
                    clientId: facture.clientId,
                    proprietes: facture.proprietes
                });

                if (facture.clientId) {
                    this.loadClientPoints(facture.clientId);
                }

                this.client = facture.client;

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

                // Explicitly update view mode to ensure new lines are disabled if needed
                this.updateViewMode();
            },
            error: (err) => {
                console.error(err);
                this.snackBar.open('Erreur lors du chargement', 'Fermer', { duration: 3000 });
            }
        });
    }

    save() {
        this.saveAsObservable().subscribe();
    }

    saveAsObservable(showNotification = true, extraProperties: any = null): Observable<any> {
        if (this.form.invalid) return new Observable(obs => obs.next(null));

        // Ensure nomenclature from input is in the form before saving
        if (this.nomenclature && this.embedded) {
            const currentPropretes = this.form.get('proprietes')?.value || {};
            this.form.get('proprietes')?.patchValue({
                ...currentPropretes,
                nomenclature: this.nomenclature
            });
            console.log('📋 Syncing nomenclature to form before save:', this.nomenclature);
        }

        const formData = this.form.getRawValue();

        // Extract paiements to avoid sending them to invoice update (handled separately)
        // proprietes MUST be included now, merged with extraProperties
        const { paiements, ...restFormData } = formData;

        const mergedProprietes = {
            ...(restFormData.proprietes || {}),
            ...(extraProperties || {})
        };

        console.log('📝 FactureFormComponent.saveAsObservable - Merged Properties:', mergedProprietes);

        const factureData: any = {
            ...restFormData,
            centreId: this.centreId, // CRITICAL: Propagation for stock decrement fallback
            proprietes: mergedProprietes,
            ficheId: this.ficheIdInput, // Include link to Fiche
            totalHT: this.totalHT,
            totalTVA: this.totalTVA,
            totalTTC: this.totalTTC,
            montantLettres: this.montantLettres,
            // paiements: excluded
            resteAPayer: this.resteAPayer
        };

        console.log('💾 Saving facture with data:', {
            id: this.id,
            proprietes: factureData.proprietes,
            nomenclature: factureData.proprietes?.nomenclature
        });

        const request = this.id && this.id !== 'new'
            ? this.factureService.update(this.id, factureData)
            : this.factureService.create(factureData);

        return request.pipe(
            map(facture => {
                this.id = facture.id; // Update internal ID to prevent duplicates

                // IMPORTANT: Update form with returned data (Official Number, New Status, etc.)
                // This handles the Draft -> Valid ID swap seamlessly
                if (facture.numero !== this.form.get('numero')?.value) {
                    this.form.patchValue({
                        numero: facture.numero,
                        statut: facture.statut,
                        // Update other fields if backend normalized them
                    }, { emitEvent: false });
                }

                if (showNotification) {
                    this.snackBar.open('Document enregistré avec succès', 'Fermer', { duration: 3000 });
                }
                if (this.embedded) {
                    this.onSaved.emit(facture);
                } else if (!this.id || this.id === 'new') { // This condition will now be false for 'this.id'
                    // logic adjusted below
                }
                // Navigation logic for standalone mode
                if (!this.embedded && this.id !== this.route.snapshot.paramMap.get('id')) {
                    this.router.navigate(['/p/clients/factures', this.id], { replaceUrl: true });
                }
                return facture;
            }),
            catchError(err => {
                if (err.status === 409) {
                    console.log('⚠️ [FactureForm] Race condition: Invoice already exists (409). Treating as success.');
                    // Don't show error snackbar for 409
                    // We re-throw so the parent (MontureForm) can handle it (we'll fix parent next)
                    // OR we could recover here, but the parent expects a Returned Invoice object.
                    // Ideally, we shouldn't fail.
                    throw err;
                }
                console.error('Erreur sauvegarde facture:', err);
                const message = err.error?.message || 'Erreur lors de l\'enregistrement';
                this.snackBar.open(message, 'Fermer', { duration: 5000 });
                throw err;
            })
        );
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
        if (!this.id || this.id === 'new') {
            this.snackBar.open('Veuillez d\'abord enregistrer la facture', 'Fermer', { duration: 3000 });
            return;
        }

        const currentStatut = this.form.get('statut')?.value;
        if (currentStatut === 'BROUILLON') {
            this.snackBar.open('La facture doit être validée ou au moins au stade de Devis avant paiement', 'Fermer', { duration: 3000 });
            return;
        }

        const dialogRef = this.dialog.open(PaymentDialogComponent, {
            maxWidth: '90vw',
            data: {
                resteAPayer: this.resteAPayer,
                client: this.client
            }
        });

        dialogRef.afterClosed().subscribe((payment: Payment) => {
            if (payment) {
                this.createPayment(payment);
            }
        });
    }

    createPayment(payment: Payment) {
        if (!this.id) return;

        this.paiementService.create({
            ...payment,
            factureId: this.id,
            date: payment.date ? (typeof payment.date === 'string' ? payment.date : payment.date.toISOString()) : new Date().toISOString(),
            mode: payment.mode.toString(),
            dateVersement: payment.dateVersement ? (typeof payment.dateVersement === 'string' ? payment.dateVersement : payment.dateVersement.toISOString()) : undefined,
        }).subscribe({
            next: (savedPayment) => {
                this.snackBar.open('Paiement enregistré', 'Fermer', { duration: 3000 });
                // Reload facture to get updated status and remaining amount
                this.loadFacture(this.id!);
            },
            error: (err) => {
                console.error('Error creating payment:', err);
                this.snackBar.open('Erreur lors de l\'enregistrement du paiement', 'Fermer', { duration: 3000 });
            }
        });
    }

    // Deprecated/Modified: addPayment no longer pushes to local array directly for persistence, 
    // but we keep it if needed for view update before reload (optional)
    addPayment(payment: Payment) {
        // logic moved to createPayment
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
        // Only auto-update if we are not explicitly VALIDE or VENTE_EN_INSTANCE
        const currentStatut = this.form.get('statut')?.value;

        // If it's a Devis, we don't use the standard invoice statuses (PARTIEL/PAYEE)
        // unless it's just been validated.
        if (this.form.get('type')?.value === 'DEVIS' && currentStatut !== 'VALIDE') {
            // Keep current Devis status (DEVIS_EN_COURS, VENTE_EN_INSTANCE, etc.)
            // But if we want to automatically mark as instance when paid?
            // Usually we rely on the prompt in MontureForm.
            return;
        }

        if (this.resteAPayer <= 0 && this.totalTTC > 0) {
            this.form.patchValue({ statut: 'PAYEE' });
        } else if (this.montantPaye > 0) {
            // If user has manually set VALIDE, don't revert to PARTIEL
            if (currentStatut !== 'VALIDE' && currentStatut !== 'VENTE_EN_INSTANCE') {
                this.form.patchValue({ statut: 'PARTIEL' });
            }
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

    get canExchange(): boolean {
        const type = this.form.get('type')?.value;
        const statut = this.form.get('statut')?.value;
        return type === 'FACTURE' && (statut === 'VALIDE' || statut === 'PAYEE' || statut === 'PARTIEL');
    }

    openExchangeDialog() {
        if (!this.id) return;

        import('../../dialogs/invoice-return-dialog/invoice-return-dialog.component').then(m => {
            const dialogRef = this.dialog.open(m.InvoiceReturnDialogComponent, {
                width: '800px',
                data: {
                    facture: {
                        id: this.id,
                        numero: this.form.get('numero')?.value,
                        lignes: this.lignes.getRawValue()
                    }
                }
            });

            dialogRef.afterClosed().subscribe(result => {
                if (result) {
                    const itemsWithReason = result.items.map((it: any) => ({
                        ...it,
                        reason: result.reason
                    }));

                    this.factureService.exchangeInvoice(this.id!, itemsWithReason).subscribe({
                        next: (res) => {
                            this.snackBar.open(`Échange effectué : Avoir ${res.avoir.numero} et Facture ${res.newFacture.numero} créés`, 'Fermer', {
                                duration: 5000
                            });
                            if (this.embedded) {
                                this.onSaved.emit(res.newFacture);
                            } else {
                                this.router.navigate(['/p/clients/factures', res.newFacture.id]);
                            }
                        },
                        error: (err) => {
                            console.error('Erreur lors de l\'échange:', err);
                            this.snackBar.open('Erreur lors de l\'échange: ' + (err.error?.message || 'Erreur serveur'), 'Fermer', {
                                duration: 3000
                            });
                        }
                    });
                }
            });
        });
    }

    print() {
        window.print();
    }
}
