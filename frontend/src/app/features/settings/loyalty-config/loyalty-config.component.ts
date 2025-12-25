import { Component, OnInit, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDividerModule } from '@angular/material/divider';
import { HttpClient } from '@angular/common/http';
import { API_URL } from '../../../config/api.config';

@Component({
    selector: 'app-loyalty-config',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        MatCardModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
        MatIconModule,
        MatSnackBarModule,
        MatDividerModule
    ],
    templateUrl: './loyalty-config.component.html',
    styleUrls: ['./loyalty-config.component.scss']
})
export class LoyaltyConfigComponent implements OnInit {
    config: any = {
        pointsPerDH: 0.1,
        referrerBonus: 50,
        refereeBonus: 20,
        folderCreationBonus: 30,
        rewardThreshold: 500,
        pointsToMADRatio: 0.1
    };
    isEditing = false;
    loading = false;

    constructor(private http: HttpClient, private snackBar: MatSnackBar, private ngZone: NgZone) { }

    ngOnInit(): void {
        this.loadConfig();
    }

    loadConfig(): void {
        this.loading = true;
        this.http.get(`${API_URL}/loyalty/config?t=${new Date().getTime()}`).subscribe({
            next: (data) => {
                this.ngZone.run(() => {
                    this.config = data;
                    this.loading = false;
                    this.isEditing = false;
                });
            },
            error: (err) => {
                console.error('Failed to load loyalty config', err);
                this.ngZone.run(() => {
                    this.snackBar.open('Erreur lors du chargement de la configuration', 'Fermer', { duration: 3000 });
                    this.loading = false;
                });
            }
        });
    }

    startEditing(): void {
        this.isEditing = true;
    }

    cancelEditing(): void {
        this.isEditing = false;
        this.loadConfig(); // Reload to discard changes
    }

    saveConfig(): void {
        console.log('[LOYALTY CONFIG] Saving config:', this.config);
        this.loading = true;
        this.http.post(`${API_URL}/loyalty/config`, this.config).subscribe({
            next: (response) => {
                console.log('[LOYALTY CONFIG] Save successful:', response);
                this.ngZone.run(() => {
                    this.snackBar.open('Configuration enregistrée avec succès', 'Fermer', { duration: 3000 });
                    this.loading = false;
                    this.isEditing = false;
                    // Reload to confirm (without toggling loading again immediately if possible, but loadConfig does it)
                    this.loadConfig();
                });
            },
            error: (err) => {
                console.error('[LOYALTY CONFIG] Save failed:', err);
                this.ngZone.run(() => {
                    this.snackBar.open('Erreur lors de l\'enregistrement: ' + (err.error?.message || err.message), 'Fermer', { duration: 5000 });
                    this.loading = false;
                });
            }
        });
    }
}
