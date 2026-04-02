import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';

import { PersonnelService } from '../services/personnel.service';
import { CommissionRule } from '../../../shared/interfaces/employee.interface';

@Component({
    selector: 'app-commission-config',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        ReactiveFormsModule,
        MatTableModule,
        MatCardModule,
        MatButtonModule,
        MatIconModule,
        MatInputModule,
        MatSelectModule,
        MatFormFieldModule,
        MatSnackBarModule,
        MatTooltipModule
    ],
    templateUrl: './commission-config.component.html',
    styles: [`
        :host { display: block; width: 100%; overflow: hidden; box-sizing: border-box; }
        .container { padding: 32px 4%; overflow: hidden; box-sizing: border-box; }
        .header-section { margin-bottom: 28px; }
        .matrix-card { border-radius: 16px; overflow: hidden; border: none; }
        
        .matrix-table {
            width: 100%;
            border-collapse: collapse;
        }
        
        .matrix-table th {
            padding: 14px 12px;
            text-align: center;
            background: #f1f5f9;
            color: #475569;
            font-weight: 700;
            text-transform: uppercase;
            font-size: 13px;
            letter-spacing: 0.05em;
            border-bottom: 2px solid #e2e8f0;
        }

        .matrix-table td {
            padding: 12px;
            border-bottom: 1px solid #f1f5f9;
            vertical-align: middle;
        }

        .role-cell {
            font-weight: 700;
            color: #1e293b;
            background: #f8fafc;
            width: 180px;
            border-right: 1px solid #e2e8f0;
            font-size: 15px;
        }

        .rate-input-container {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
        }

        .rate-input {
            width: 75px;
            padding: 8px 10px;
            border: 1px solid #cbd5e1;
            border-radius: 8px;
            text-align: right;
            font-family: inherit;
            font-weight: 600;
            color: #334155;
            transition: all 0.2s;
            font-size: 15px;
        }

        .rate-input:focus {
            outline: none;
            border-color: #6366f1;
            box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.1);
        }

        .currency {
            color: #94a3b8;
            font-size: 14px;
            font-weight: 600;
        }

        .btn-apply-all {
            opacity: 0.3;
            transition: opacity 0.2s;
            transform: scale(0.9);
        }

        tr:hover .btn-apply-all {
            opacity: 1;
        }

        .actions-footer {
            margin-top: 28px;
            display: flex;
            justify-content: flex-end;
            align-items: center;
            gap: 24px;
        }

        .add-poste-container {
            display: flex;
            align-items: center;
            background: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 10px;
            padding: 4px 4px 4px 14px;
            box-shadow: 0 1px 2px rgba(0,0,0,0.05);
        }

        .add-poste-input {
            border: none;
            outline: none;
            padding: 6px;
            font-size: 14px;
            width: 200px;
            font-weight: 500;
        }

        .premium-btn {
            border-radius: 10px;
            padding: 10px 20px;
            font-weight: 600;
            font-size: 14px;
            text-transform: none;
            letter-spacing: normal;
        }
    `]
})
export class CommissionConfigComponent implements OnInit {
    rules: CommissionRule[] = [];
    postes = ['OPTICIEN', 'VENDEUR', 'CAISSIER', 'RESPONSABLE'];
    typesProduit = ['MONTURE', 'VERRE', 'LENTILLE', 'ACCESSOIRE'];
    
    // Matrix data structure: { [poste]: { [typeProduit]: taux } }
    matrix: { [key: string]: { [key: string]: number } } = {};
    loading = false;
    newPosteName = '';

    constructor(
        private personnelService: PersonnelService,
        private snackBar: MatSnackBar,
        private cdr: ChangeDetectorRef
    ) {}

    ngOnInit(): void {
        this.loadRules();
    }

    private initializeMatrix(): void {
        this.postes.forEach(poste => {
            if (!this.matrix[poste]) {
                this.matrix[poste] = {};
            }
            // Always ensure every type key exists
            this.typesProduit.forEach(type => {
                if (this.matrix[poste][type] === undefined) {
                    this.matrix[poste][type] = 0;
                }
            });
        });
    }

    loadRules(): void {
        this.loading = true;
        this.personnelService.getCommissionRules().subscribe({
            next: (data) => {
                this.rules = data;
                
                // 1. Extract unique roles from DB to keep the list updated
                const dbPostes = [...new Set(data.map(r => r.poste))];
                dbPostes.forEach(p => {
                    if (!this.postes.includes(p)) {
                        this.postes.push(p);
                    }
                });

                // 2. Initialize matrix structure
                this.initializeMatrix();

                // 3. Map flat rules to matrix
                data.forEach(rule => {
                    if (this.matrix[rule.poste]) {
                        this.matrix[rule.poste][rule.typeProduit] = rule.taux;
                    }
                });
                this.loading = false;
                this.cdr.markForCheck();
            },
            error: (err) => {
                console.error('Error loading rules', err);
                this.loading = false;
                this.cdr.markForCheck();
            }
        });
    }

    addPoste(): void {
        const name = this.newPosteName.trim().toUpperCase();
        if (!name) return;
        
        if (this.postes.includes(name)) {
            this.snackBar.open('Ce poste existe déjà', 'Fermer', { duration: 3000 });
            return;
        }

        this.postes.push(name);
        this.matrix[name] = {};
        this.typesProduit.forEach(type => {
            this.matrix[name][type] = 0;
        });
        this.newPosteName = '';
        this.snackBar.open(`Poste "${name}" ajouté à la matrice`, 'OK', { duration: 2000 });
    }

    applyToAllRow(poste: string, value: number | null): void {
        if (value === null) return;
        this.typesProduit.forEach(type => {
            this.matrix[poste][type] = value;
        });
        this.snackBar.open(`Taux de ${value}% appliqué à toutes les catégories pour: ${poste}`, 'OK', { duration: 2000 });
    }

    saveMatrix(): void {
        const rulesToUpsert: CommissionRule[] = [];
        
        Object.keys(this.matrix).forEach(poste => {
            Object.keys(this.matrix[poste]).forEach(type => {
                rulesToUpsert.push({
                    poste: poste,
                    typeProduit: type,
                    taux: this.matrix[poste][type] || 0
                });
            });
        });

        this.loading = true;
        this.personnelService.upsertCommissionRulesBulk(rulesToUpsert).subscribe({
            next: () => {
                this.snackBar.open('Configuration des commissions enregistrée avec succès', 'OK', { duration: 3000 });
                this.loadRules();
                this.loading = false;
            },
            error: (err) => {
                console.error('Error saving matrix', err);
                this.snackBar.open('Erreur lors de l\'enregistrement. Assurez-vous que le serveur est bien démarré.', 'Fermer', { duration: 5000 });
                this.loading = false;
            }
        });
    }

    deletePoste(poste: string): void {
        if (!confirm(`Supprimer le profil "${poste}" et toutes ses règles de commission ?`)) {
            return;
        }

        this.personnelService.deleteCommissionRulesByPoste(poste).subscribe({
            next: () => {
                // Remove from local state
                delete this.matrix[poste];
                this.postes = this.postes.filter(p => p !== poste);
                this.snackBar.open(`Profil "${poste}" supprimé avec succès`, 'OK', { duration: 3000 });
                this.cdr.markForCheck();
            },
            error: (err) => {
                console.error('Error deleting poste', err);
                this.snackBar.open('Erreur lors de la suppression', 'Fermer', { duration: 5000 });
            }
        });
    }
}
