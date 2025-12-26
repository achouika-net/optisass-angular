import { Component, Inject, OnInit, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormArray } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatCardModule } from '@angular/material/card';
import { MatStepperModule } from '@angular/material/stepper';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ActivatedRoute, Router } from '@angular/router';
import { FinanceService } from '../../services/finance.service';
import { Optional } from '@angular/core';

import { Supplier, SupplierContact } from '../../models/finance.models';

@Component({
    selector: 'app-supplier-form-dialog',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatDialogModule,
        MatButtonModule,
        MatFormFieldModule,
        MatInputModule,
        MatIconModule,
        MatSelectModule,
        MatTooltipModule,
        MatCheckboxModule,
        MatCardModule,
        MatStepperModule,
        MatProgressBarModule
    ],
    templateUrl: './supplier-form-dialog.component.html',
    styles: [`
    .full-width { width: 100%; }
    .row { display: flex; gap: 16px; margin-bottom: 8px; flex-wrap: wrap; }
    .col { flex: 1; min-width: 200px; }
    .dialog-container { display: flex; flex-direction: column; height: 100%; }
    .dialog-content { flex: 1; overflow-y: auto; padding: 20px; }
    .contact-item { border: 1px solid #eee; border-radius: 8px; padding: 16px; margin-bottom: 16px; position: relative; }
    .remove-contact { position: absolute; top: 10px; right: 10px; }
  `]
})
export class SupplierFormDialogComponent implements OnInit {
    form: FormGroup;
    isEditMode: boolean;
    isViewMode: boolean = false;
    submitting: boolean = false;
    contactsExpanded: boolean[] = [];

    canauxCommunication = ['EMAIL', 'TELEPHONE', 'WHATSAPP', 'VISITE'];
    tachesContact = ['COMMERCIAL', 'LOGISTIQUE', 'COMPTABILITE', 'DIRECTION'];

    modalitesPaiement = ['Espèces', 'Chèque', 'LCN', 'Virement bancaire', 'Traite'];
    echeancesPaiement = ['Comptant', '30 jours', '60 jours', '90 jours', 'Fin de mois'];

    constructor(
        private fb: FormBuilder,
        private financeService: FinanceService,
        private route: ActivatedRoute,
        private router: Router,
        @Optional() public dialogRef: MatDialogRef<SupplierFormDialogComponent>,
        @Optional() @Inject(MAT_DIALOG_DATA) public data: { supplier?: Supplier, viewMode?: boolean },
        private zone: NgZone
    ) {
        this.isEditMode = !!(data?.supplier);
        this.isViewMode = !!(data?.viewMode);
        this.form = this.fb.group({
            // Identité & Coordonnées (Tabs combine)
            nom: [data?.supplier?.nom || '', Validators.required],
            contact: [data?.supplier?.contact || ''],
            email: [data?.supplier?.email || '', [Validators.email]],
            telephone: [data?.supplier?.telephone || ''],
            siteWeb: [data?.supplier?.siteWeb || ''],
            adresse: [data?.supplier?.adresse || ''],
            ville: [data?.supplier?.ville || ''],

            // Professionnel
            ice: [data?.supplier?.ice || ''],
            rc: [data?.supplier?.rc || ''],
            identifiantFiscal: [data?.supplier?.identifiantFiscal || ''],
            patente: [data?.supplier?.patente || ''],
            cnss: [data?.supplier?.cnss || ''],
            siret: [data?.supplier?.siret || ''],

            // Financier
            rib: [data?.supplier?.rib || ''],
            banque: [data?.supplier?.banque || ''],

            // Convention
            convention: this.fb.group({
                actif: [data?.supplier?.convention?.actif || false],
                nomConvention: [data?.supplier?.convention?.nomConvention || ''],
                contactNom: [data?.supplier?.convention?.contactNom || ''],
                contactTelephone: [data?.supplier?.convention?.contactTelephone || ''],
                remiseOfferte: [data?.supplier?.convention?.remiseOfferte || null],
                modalitePaiement: [data?.supplier?.convention?.modalitePaiement || []],
                echeancePaiement: [data?.supplier?.convention?.echeancePaiement || []]
            }),

            // Contacts
            contacts: this.fb.array([])
        });
    }

    ngOnInit(): void {
        if (this.isViewMode) {
            this.form.disable();
        }

        this.route.queryParams.subscribe(params => {
            if (params['viewMode'] === 'true') {
                this.isViewMode = true;
                this.form.disable();
            }
        });

        const id = this.route.snapshot.paramMap.get('id');
        if (id) {
            this.isEditMode = true;
            this.financeService.getSupplier(id).subscribe(supplier => {
                this.form.patchValue(supplier);
                if (this.isViewMode) {
                    this.form.disable();
                }
                if (supplier.contacts) {
                    this.contacts.clear();
                    supplier.contacts.forEach(c => this.addContact(c));
                }
            });
        } else if (this.data?.supplier?.contacts) {
            this.data.supplier.contacts.forEach(c => this.addContact(c));
        }
    }

    get contacts(): FormArray {
        return this.form.get('contacts') as FormArray;
    }

    addContact(contact?: SupplierContact): void {
        const group = this.fb.group({
            nom: [contact?.nom || '', Validators.required],
            prenom: [contact?.prenom || ''],
            fonction: [contact?.fonction || ''],
            telephone: [contact?.telephone || ''],
            email: [contact?.email || '', [Validators.email]],
            taches: [contact?.taches || []],
            canal: [contact?.canal || '']
        });
        this.contacts.push(group);
        this.contactsExpanded.push(true);
    }

    removeContact(index: number): void {
        this.contacts.removeAt(index);
        this.contactsExpanded.splice(index, 1);
    }

    onSubmit() {
        if (this.form.valid) {
            this.submitting = true;
            const supplierData = this.form.value;
            if (this.isEditMode) {
                const id = this.route.snapshot.paramMap.get('id') || this.data?.supplier?.id;
                if (id) {
                    this.financeService.updateSupplier(id, supplierData).subscribe({
                        next: () => this.finalize(supplierData),
                        error: (err) => {
                            console.error('Update failed', err);
                            this.submitting = false;
                        }
                    });
                }
            } else {
                this.financeService.createSupplier(supplierData).subscribe({
                    next: res => this.finalize(res),
                    error: (err) => {
                        console.error('Creation failed', err);
                        this.submitting = false;
                    }
                });
            }
        } else {
            this.form.markAllAsTouched();
        }
    }

    private finalize(result: any) {
        this.zone.run(() => {
            if (this.dialogRef) {
                this.dialogRef.close(result);
            } else {
                this.router.navigate(['/p/finance/suppliers']).then(() => {
                    this.submitting = false;
                });
            }
        });
    }

    onCancel() {
        if (this.dialogRef) {
            this.dialogRef.close();
        } else {
            this.router.navigate(['/p/finance/suppliers']);
        }
    }
}
