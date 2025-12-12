import { Component, Input, Output, EventEmitter, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { OptilensService, AutoMeasures, ClinicalParams, LensSuggestion } from '../../../../../../core/services/optilens-measures.service';

@Component({
    selector: 'app-adaptation-moderne',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatCardModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatButtonModule,
        MatIconModule,
        MatProgressSpinnerModule,
        MatDatepickerModule,
        MatNativeDateModule
    ],
    templateUrl: './adaptation-moderne.component.html',
    styleUrls: ['./adaptation-moderne.component.scss']
})
export class AdaptationModerneComponent implements OnInit {
    @Input() formGroup!: FormGroup;
    @Output() suggestionGenerated = new EventEmitter<LensSuggestion>();

    suggestion: LensSuggestion | null = null;
    validationErrors: string[] = [];
    showInfo = false;  // Pour afficher le message d'info tablette

    constructor(
        private optilensService: OptilensService,
        private cdr: ChangeDetectorRef
    ) { }

    ngOnInit() {
        // Auto-générer suggestion si des mesures existent déjà
        if (this.hasMeasures()) {
            this.generateSuggestion();
        }
    }

    /**
     * Affiche les informations sur la capture automatique avec tablette
     */
    showTabletInfo() {
        this.showInfo = true;
    }

    /**
     * Génère une suggestion basée sur les mesures actuelles
     */
    generateSuggestion() {
        this.validationErrors = [];

        const measures: AutoMeasures = {
            hvid: this.formGroup.get('hvid')?.value,
            pupilPhot: this.formGroup.get('pupilPhot')?.value,
            pupilMes: this.formGroup.get('pupilMes')?.value,
            but: this.formGroup.get('but')?.value,
            schirmer: this.formGroup.get('schirmer')?.value,
            k1: this.formGroup.get('k1')?.value,
            k2: this.formGroup.get('k2')?.value
        };

        const clinical: ClinicalParams = {
            blinkFreq: this.formGroup.get('blinkFreq')?.value,
            blinkAmp: this.formGroup.get('blinkAmp')?.value,
            tonus: this.formGroup.get('tonus')?.value
        };

        // Valider les mesures
        const validation = this.optilensService.validateMeasures(measures);

        if (!validation.valid) {
            this.validationErrors = validation.missing.map((m: string) => `Mesure manquante: ${m}`);
            return;
        }

        // Générer la suggestion
        this.suggestion = this.optilensService.generateSuggestion(measures, clinical);

        // Forcer la détection de changement Angular
        this.cdr.detectChanges();

        this.suggestionGenerated.emit(this.suggestion);
    }

    /**
     * Applique la suggestion au formulaire
     */
    applySuggestion() {
        if (!this.suggestion) return;

        this.formGroup.patchValue({
            suggestedType: this.suggestion.type,
            suggestedDiameter: this.suggestion.diameter,
            suggestedBC: this.suggestion.baseCurve,
            suggestedMaterial: this.suggestion.material
        });
    }

    /**
     * Vérifie si des mesures existent
     */
    private hasMeasures(): boolean {
        return !!(
            this.formGroup.get('hvid')?.value ||
            this.formGroup.get('but')?.value ||
            this.formGroup.get('schirmer')?.value
        );
    }

    /**
     * Obtient la couleur de la barre de confiance
     */
    getConfidenceColor(confidence: number): string {
        if (confidence >= 80) return 'success';
        if (confidence >= 60) return 'warn';
        return 'accent';
    }
}
