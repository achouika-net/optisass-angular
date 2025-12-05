import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatTabsModule } from '@angular/material/tabs';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDividerModule } from '@angular/material/divider';
import { FicheService } from '../../services/fiche.service';
import { ClientService } from '../../services/client.service';
import { FicheLentillesCreate, TypeFiche, StatutFiche } from '../../models/fiche-client.model';
import { Client, TypeClient, ClientParticulier, ClientProfessionnel } from '../../models/client.model';
import { ContactLensType, ContactLensUsage } from '../../../../shared/interfaces/product.interface';

@Component({
    selector: 'app-lentilles-form',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatTabsModule,
        MatCardModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatButtonModule,
        MatIconModule,
        MatDatepickerModule,
        MatNativeDateModule,
        MatCheckboxModule,
        MatDividerModule
    ],
    templateUrl: './lentilles-form.component.html',
    styleUrls: ['./lentilles-form.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class LentillesFormComponent implements OnInit {
    ficheForm: FormGroup;
    clientId: string | null = null;
    client: Client | null = null;
    activeTab = 0;
    loading = false;
    isEditMode = false;
    ficheId: string | null = null;

    // Enums for dropdowns
    lensTypes = Object.values(ContactLensType);
    lensUsages = Object.values(ContactLensUsage);

    constructor(
        private fb: FormBuilder,
        private route: ActivatedRoute,
        private router: Router,
        private ficheService: FicheService,
        private clientService: ClientService,
        private cdr: ChangeDetectorRef
    ) {
        this.ficheForm = this.initForm();
    }

    ngOnInit(): void {
        this.clientId = this.route.snapshot.paramMap.get('clientId');
        this.ficheId = this.route.snapshot.paramMap.get('id');

        if (this.clientId) {
            this.loadClient();
        }

        if (this.ficheId && this.ficheId !== 'new') {
            this.isEditMode = true;
            this.loadFiche();
        }
    }

    initForm(): FormGroup {
        return this.fb.group({
            // Ordonnance
            ordonnance: this.fb.group({
                datePrescription: [new Date()],
                prescripteur: [''],
                od: this.fb.group({
                    sphere: [''],
                    cylindre: [''],
                    axe: [''],
                    addition: [''],
                    k1: [''], // Kératométrie
                    k2: ['']
                }),
                og: this.fb.group({
                    sphere: [''],
                    cylindre: [''],
                    axe: [''],
                    addition: [''],
                    k1: [''],
                    k2: ['']
                })
            }),

            // Sélection Lentilles
            lentilles: this.fb.group({
                type: [ContactLensType.MENSUELLE, Validators.required],
                usage: [ContactLensUsage.MYOPIE, Validators.required],
                diffLentilles: [false],
                od: this.fb.group({
                    marque: ['', Validators.required],
                    modele: [''],
                    rayon: ['', Validators.required], // BC
                    diametre: ['', Validators.required], // DIA
                    sphere: [''],
                    cylindre: [''],
                    axe: [''],
                    addition: [''],
                    prix: ['']
                }),
                og: this.fb.group({
                    marque: ['', Validators.required],
                    modele: [''],
                    rayon: ['', Validators.required],
                    diametre: ['', Validators.required],
                    sphere: [''],
                    cylindre: [''],
                    axe: [''],
                    addition: [''],
                    prix: ['']
                })
            }),

            // Adaptation & Essai
            adaptation: this.fb.group({
                dateEssai: [new Date()],
                dateControle: [''],
                acuiteOD: [''],
                acuiteOG: [''],
                confort: [''], // Note ou observation
                centrage: [''],
                mobilite: [''],
                validation: [false],
                remarques: ['']
            })
        });
    }

    loadClient(): void {
        if (!this.clientId) return;
        this.clientService.getClient(this.clientId).subscribe(client => {
            this.client = client || null;
            this.cdr.markForCheck();
        });
    }

    loadFiche(): void {
        // TODO: Implement load logic when backend is ready
    }

    // Getters for form groups
    get ordonnanceGroup(): FormGroup { return this.ficheForm.get('ordonnance') as FormGroup; }
    get lentillesGroup(): FormGroup { return this.ficheForm.get('lentilles') as FormGroup; }
    get adaptationGroup(): FormGroup { return this.ficheForm.get('adaptation') as FormGroup; }

    get diffLentilles(): boolean {
        return this.lentillesGroup.get('diffLentilles')?.value;
    }

    get clientName(): string {
        if (!this.client) return '';
        if (this.client.typeClient === TypeClient.PARTICULIER) {
            return `${(this.client as ClientParticulier).nom} ${(this.client as ClientParticulier).prenom}`;
        } else if (this.client.typeClient === TypeClient.PROFESSIONNEL) {
            return (this.client as ClientProfessionnel).raisonSociale;
        }
        return 'Client Anonyme';
    }

    setActiveTab(index: number): void {
        this.activeTab = index;
    }

    nextTab(): void {
        if (this.activeTab < 2) {
            this.activeTab++;
        }
    }

    prevTab(): void {
        if (this.activeTab > 0) {
            this.activeTab--;
        }
    }

    onSubmit(): void {
        if (this.ficheForm.invalid || !this.clientId) return;

        this.loading = true;
        const formValue = this.ficheForm.value;

        // Calculate total amount (mock logic)
        const prixOD = parseFloat(formValue.lentilles.od.prix) || 0;
        const prixOG = parseFloat(formValue.lentilles.diffLentilles ? formValue.lentilles.og.prix : formValue.lentilles.od.prix) || 0;
        const total = prixOD + prixOG;

        // Mapping to FicheLentillesCreate model
        const ficheData: FicheLentillesCreate = {
            clientId: this.clientId,
            type: TypeFiche.LENTILLES,
            statut: StatutFiche.EN_COURS,
            montantTotal: total,
            montantPaye: 0,
            prescription: formValue.ordonnance,
            lentilles: {
                type: formValue.lentilles.type,
                usage: formValue.lentilles.usage,
                od: formValue.lentilles.od,
                og: formValue.lentilles.diffLentilles ? formValue.lentilles.og : formValue.lentilles.od
            },
            adaptation: formValue.adaptation
        };

        this.ficheService.createFicheLentilles(ficheData).subscribe({
            next: () => {
                this.loading = false;
                this.router.navigate(['/p/clients', this.clientId]);
            },
            error: (err) => {
                console.error('Error creating fiche lentilles:', err);
                this.loading = false;
                this.cdr.markForCheck();
            }
        });
    }

    goBack(): void {
        if (this.clientId) {
            this.router.navigate(['/p/clients', this.clientId]);
        } else {
            this.router.navigate(['/p/clients']);
        }
    }
}
