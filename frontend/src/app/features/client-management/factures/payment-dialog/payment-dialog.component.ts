import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { OcrService } from '../../../../core/services/ocr.service';

export interface PaymentDialogData {
    resteAPayer: number;
    client?: any;
}

export interface Payment {
    date: Date;
    montant: number;
    mode: 'ESPECES' | 'CARTE' | 'CHEQUE' | 'VIREMENT' | 'LCN' | 'AUTRE';
    reference?: string;
    notes?: string;
    // New fields
    dateVersement?: Date;
    banque?: string;
    remarque?: string;
    tiersNom?: string;
    tiersCin?: string;
    pieceJointe?: string;
}

@Component({
    selector: 'app-payment-dialog',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatDialogModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatDatepickerModule,
        MatNativeDateModule,
        MatButtonModule,
        MatIconModule,
        MatAutocompleteModule,
        MatCheckboxModule
    ],
    templateUrl: './payment-dialog.component.html',
    styleUrls: ['./payment-dialog.component.scss']
})
export class PaymentDialogComponent {
    form: FormGroup;
    maxAmount: number;

    paymentModes = [
        { value: 'ESPECES', label: 'Espèces' },
        { value: 'CARTE', label: 'Carte Bancaire' },
        { value: 'CHEQUE', label: 'Chèque' },
        { value: 'LCN', label: 'LCN' },
        { value: 'VIREMENT', label: 'Virement' },
        { value: 'AUTRE', label: 'Autre' }
    ];

    showIdentityFields = false;
    isFamilyMember = true;
    attachmentPreview: string | null = null;
    banks = ['Attijariwafa Bank', 'Banque Populaire', 'BMCE Bank of Africa', 'CIH Bank', 'Société Générale', 'BMCI', 'Crédit du Maroc', 'CFG Bank'];

    isProcessingOcr = false;

    constructor(
        private fb: FormBuilder,
        public dialogRef: MatDialogRef<PaymentDialogComponent>,
        @Inject(MAT_DIALOG_DATA) public data: PaymentDialogData,
        private ocrService: OcrService,
        private dialog: MatDialog
    ) {
        this.maxAmount = data.resteAPayer;

        this.form = this.fb.group({
            date: [new Date(), Validators.required],
            montant: [
                this.maxAmount,
                [
                    Validators.required,
                    Validators.min(0.01),
                    Validators.max(this.maxAmount)
                ]
            ],
            mode: ['ESPECES', Validators.required],
            reference: [''],
            notes: [''],
            dateVersement: [null],
            banque: [''],
            tiersNom: [''],
            tiersCin: [''],
            pieceJointe: ['']
        });

        // Init default TiersNom if client exists
        if (this.data.client) {
            const clientName = this.data.client.nom ? `${this.data.client.nom} ${this.data.client.prenom || ''}`.trim() : (this.data.client.raisonSociale || '');
            this.form.patchValue({ tiersNom: clientName });
        }

        // Monitors
        this.form.get('mode')?.valueChanges.subscribe(mode => this.onModeChange(mode));
        this.form.get('tiersNom')?.valueChanges.subscribe(name => this.checkIdentity(name));
    }

    onModeChange(mode: string) {
        const refControl = this.form.get('reference');
        if (mode === 'ESPECES') {
            refControl?.clearValidators();
            refControl?.setValue('');
        }
        // Logic will be handled in template heavily, but validators here:
        if (['CHEQUE', 'LCN', 'VIREMENT'].includes(mode)) {
            // Maybe require things?
        }
    }

    checkIdentity(name: string) {
        if (!name || !this.data.client) {
            this.isFamilyMember = false;
            return;
        }

        const cleanName = name.toLowerCase().trim();
        const clientName = ((this.data.client.nom || '') + ' ' + (this.data.client.prenom || '')).toLowerCase().trim();
        const raisonSociale = (this.data.client.raisonSociale || '').toLowerCase().trim();

        // Direct match
        if (cleanName === clientName || cleanName === raisonSociale) {
            this.isFamilyMember = true;
            this.showIdentityFields = false;
            return;
        }

        // Family match (assuming groupeFamille is an object { members: [...] } or array)
        // Adjust based on schema: gaucheFamille: Json?
        let foundInFamily = false;
        const family = this.data.client.groupeFamille as any;
        if (family) {
            // Assuming structure, or string search if simple
            // If family is just stored loosely or structured. 
            // Without exact structure, I'll assume it might be array of names or similar.
            // For now, simple includes check if string, or loop if array.
            const familyStr = JSON.stringify(family).toLowerCase();
            if (familyStr.includes(cleanName)) {
                foundInFamily = true;
            }
        }

        this.isFamilyMember = foundInFamily;
        this.showIdentityFields = !this.isFamilyMember;
        // Note: Field visibility is now always TRUE in template, this flag mainly tracks "is different form client" logic

        if (this.showIdentityFields) {
            this.form.get('tiersCin')?.setValidators([Validators.required]);
        } else {
            this.form.get('tiersCin')?.clearValidators();
        }
        this.form.get('tiersCin')?.updateValueAndValidity();
    }

    onFileSelected(event: any) {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = async () => {
                await this.processImage(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    }

    openCamera() {
        import('../../../../shared/components/camera-capture/camera-capture-dialog.component').then(({ CameraCaptureDialogComponent }) => {
            const ref = this.dialog.open(CameraCaptureDialogComponent, {
                width: '600px',
                maxWidth: '95vw',
                panelClass: 'camera-dialog'
            });

            ref.afterClosed().subscribe(base64Image => {
                if (base64Image) {
                    this.processImage(base64Image);
                }
            });
        });
    }

    // Actually, let's implement the method fully after constructor update.
    // For now, refactoring processImage to be reused.

    async processImage(base64Image: string) {
        this.attachmentPreview = base64Image;
        this.form.patchValue({ pieceJointe: this.attachmentPreview });

        // OCR Logic
        this.isProcessingOcr = true;
        try {
            const extractedText = await this.ocrService.recognizeText(this.attachmentPreview);
            console.log('OCR Result:', extractedText);

            if (this.data.client) {
                const clientName = ((this.data.client.nom || '') + ' ' + (this.data.client.prenom || '')).toLowerCase();
                const text = extractedText.toLowerCase();

                // Heuristic
                const parts = clientName.split(' ').filter((p: string) => p.length > 2);
                const isMatch = parts.every((p: string) => text.includes(p));

                if (!isMatch) {
                    this.showIdentityFields = true;
                    this.isFamilyMember = false;
                    this.form.get('tiersCin')?.setValidators([Validators.required]);
                    this.form.get('tiersCin')?.updateValueAndValidity();
                }
            }
        } catch (e) {
            console.error('OCR Validation Failed', e);
        } finally {
            this.isProcessingOcr = false;
        }
    }

    onCancel(): void {
        this.dialogRef.close();
    }

    onSave(): void {
        if (this.form.valid) {
            const payment: Payment = this.form.value;
            this.dialogRef.close(payment);
        }
    }
}
