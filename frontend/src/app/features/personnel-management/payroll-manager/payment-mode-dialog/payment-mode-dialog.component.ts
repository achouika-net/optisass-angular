import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { FormsModule } from '@angular/forms';

@Component({
    selector: 'app-payment-mode-dialog',
    standalone: true,
    imports: [
        CommonModule,
        MatDialogModule,
        MatButtonModule,
        MatSelectModule,
        MatInputModule,
        MatDatepickerModule,
        MatNativeDateModule,
        MatFormFieldModule,
        FormsModule
    ],
    template: `
        <h2 mat-dialog-title>Paiement Salaire</h2>
        <div mat-dialog-content class="pt-4">
            <p class="mb-4">Choisissez le mode de paiement :</p>
            <mat-form-field appearance="outline" class="w-full">
                <mat-label>Mode de Paiement</mat-label>
                <mat-select [(ngModel)]="mode">
                    <mat-option value="VIREMENT">Virement Bancaire</mat-option>
                    <mat-option value="ESPECES">Espèces (Caisse)</mat-option>
                    <mat-option value="CHEQUE">Chèque</mat-option>
                </mat-select>
            </mat-form-field>

            <div *ngIf="mode === 'CHEQUE'" class="flex flex-col gap-2">
                <mat-form-field appearance="outline" class="w-full">
                    <mat-label>Banque</mat-label>
                    <input matInput [(ngModel)]="banque" placeholder="Ex: BP, STB...">
                </mat-form-field>
                <mat-form-field appearance="outline" class="w-full">
                    <mat-label>Numéro de Chèque</mat-label>
                    <input matInput [(ngModel)]="reference" placeholder="Ex: 1234567">
                </mat-form-field>
                <mat-form-field appearance="outline" class="w-full">
                    <mat-label>Date d'échéance</mat-label>
                    <input matInput [matDatepicker]="picker" [(ngModel)]="dateEcheance">
                    <mat-datepicker-toggle matIconSuffix [for]="picker"></mat-datepicker-toggle>
                    <mat-datepicker #picker></mat-datepicker>
                </mat-form-field>
            </div>
        </div>
        <div mat-dialog-actions align="end">
            <button mat-button (click)="cancel()">Annuler</button>
            <button mat-flat-button color="primary" (click)="confirm()">Confirmer</button>
        </div>
    `
})
export class PaymentModeDialogComponent {
    mode = 'VIREMENT';
    banque = '';
    reference = '';
    dateEcheance: Date | null = null;

    constructor(public dialogRef: MatDialogRef<PaymentModeDialogComponent>) { }

    confirm(): void {
        this.dialogRef.close({
            mode: this.mode,
            banque: this.banque,
            reference: this.reference,
            dateEcheance: this.dateEcheance
        });
    }

    cancel(): void {
        this.dialogRef.close();
    }
}
