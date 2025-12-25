import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatRadioModule } from '@angular/material/radio';
import { Client } from '../../models/client.model';

export interface FamilyCheckDialogData {
    existingClients: Client[];
    currentNom: string;
}

export interface FamilyCheckDialogResult {
    action: 'join' | 'new';
    targetClient?: Client;
    lienParental?: string;
    adressePartagee?: boolean;
    couvertureSocialePartagee?: boolean;
    responsableFinancierPartage?: boolean;
    selectedParentProfileId?: string;
}

@Component({
    selector: 'app-family-check-dialog',
    standalone: true,
    imports: [CommonModule, FormsModule, MatDialogModule, MatButtonModule, MatTableModule, MatIconModule, MatSelectModule, MatFormFieldModule, MatCheckboxModule, MatRadioModule],
    templateUrl: './family-check-dialog.component.html',
    styles: [`
    .dialog-content { width: 100%; box-sizing: border-box; }
    table { width: 100%; margin-bottom: 20px; }
    .actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; }
    .action-col { min-width: 180px; }
  `]
})
export class FamilyCheckDialogComponent {
    displayedColumns: string[] = ['prenom', 'cin', 'telephone', 'ville', 'action'];
    selectedLienParental: string = 'Enfant';
    adressePartagee: boolean = false;
    couvertureSocialePartagee: boolean = false;
    responsableFinancierPartage: boolean = false;
    selectedParentProfile: string | null = null;

    constructor(
        public dialogRef: MatDialogRef<FamilyCheckDialogComponent>,
        @Inject(MAT_DIALOG_DATA) public data: FamilyCheckDialogData
    ) {
        // Auto-select first parent if only one exists
        if (this.data.existingClients.length === 1) {
            this.selectedParentProfile = this.data.existingClients[0].id;
        }
    }

    joinGroup(client: Client): void {
        // Find the selected parent profile if Enfant and multiple parents
        let targetClient = client;
        if (this.selectedLienParental === 'Enfant' && this.selectedParentProfile) {
            const selectedParent = this.data.existingClients.find(c => c.id === this.selectedParentProfile);
            if (selectedParent) {
                targetClient = selectedParent;
            }
        }

        this.dialogRef.close({
            action: 'join',
            targetClient: targetClient,
            lienParental: this.selectedLienParental,
            adressePartagee: this.adressePartagee,
            couvertureSocialePartagee: this.couvertureSocialePartagee,
            responsableFinancierPartage: this.responsableFinancierPartage,
            selectedParentProfileId: this.selectedParentProfile || undefined
        });
    }

    getClientName(client: Client): string {
        const clientAny = client as any;
        return clientAny.prenom || clientAny.raisonSociale || 'Client';
    }

    createNew(): void {
        this.dialogRef.close({ action: 'new' });
    }
}
