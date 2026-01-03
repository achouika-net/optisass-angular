import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MarketingService } from '../../client-management/services/marketing.service';

@Component({
    selector: 'app-marketing-config',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatCardModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
        MatIconModule,
        MatSnackBarModule
    ],
    templateUrl: './marketing-config.component.html',
    styleUrls: ['./marketing-config.component.scss']
})
export class MarketingConfigComponent implements OnInit {
    configForm: FormGroup;
    loading = signal(false);
    saving = signal(false);

    constructor(
        private fb: FormBuilder,
        private marketingService: MarketingService,
        private snackBar: MatSnackBar
    ) {
        this.configForm = this.fb.group({
            // WhatsApp
            whatsappApiUrl: [''],
            whatsappInstanceId: [''],
            whatsappToken: [''],
            // SMS
            smsGatewayUrl: [''],
            smsApiKey: [''],
            // Email
            smtpHost: [''],
            smtpPort: [587, [Validators.required, Validators.min(1)]],
            smtpUser: [''],
            smtpPass: [''],
            smtpFrom: ['']
        });
    }

    ngOnInit(): void {
        this.loadConfig();
    }

    loadConfig() {
        this.loading.set(true);
        this.marketingService.getConfig().subscribe({
            next: (config) => {
                if (config) {
                    this.configForm.patchValue(config);
                }
                this.loading.set(false);
            },
            error: (err) => {
                this.snackBar.open('Erreur lors du chargement de la configuration', 'Fermer', { duration: 3000 });
                this.loading.set(false);
            }
        });
    }

    saveConfig() {
        if (this.configForm.invalid) return;

        this.saving.set(true);
        this.marketingService.updateConfig(this.configForm.value).subscribe({
            next: () => {
                this.snackBar.open('Configuration enregistrée avec succès', 'Fermer', { duration: 3000 });
                this.saving.set(false);
            },
            error: (err) => {
                this.snackBar.open('Erreur lors de l\'enregistrement', 'Fermer', { duration: 3000 });
                this.saving.set(false);
                console.error('Save error:', err);
            }
        });
    }
}
