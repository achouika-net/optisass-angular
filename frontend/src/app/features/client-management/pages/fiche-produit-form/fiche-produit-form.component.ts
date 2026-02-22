import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FicheService } from '../../services/fiche.service';
import { ClientManagementService } from '../../services/client.service';
import { Client } from '../../models/client.model';
import { FicheProduit, ProduitVendu, TypeFiche, StatutFiche, FicheProduitCreate } from '../../models/fiche-client.model';

import { MatTooltipModule } from '@angular/material/tooltip';

@Component({
    selector: 'app-fiche-produit-form',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatCardModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
        MatIconModule,
        MatDividerModule,
        MatProgressSpinnerModule,
        MatSnackBarModule,
        MatDatepickerModule,
        MatNativeDateModule,
        MatTooltipModule
    ],
    templateUrl: './fiche-produit-form.component.html',
    styleUrls: ['./fiche-produit-form.component.scss']
})
export class FicheProduitFormComponent implements OnInit {
    ficheForm: FormGroup;
    loading = false;
    saving = false;
    clientId: string | null = null;
    ficheId: string | null = null;
    client: Client | null = null;

    get clientDisplayName(): string {
        if (!this.client) return '';
        if ((this.client as any).nom) {
            return `${(this.client as any).nom} ${(this.client as any).prenom || ''}`.trim();
        }
        if ((this.client as any).raisonSociale) {
            return (this.client as any).raisonSociale;
        }
        return '';
    }

    constructor(
        private fb: FormBuilder,
        private route: ActivatedRoute,
        private router: Router,
        private ficheService: FicheService,
        private clientService: ClientManagementService,
        private snackBar: MatSnackBar,
        private cdr: ChangeDetectorRef
    ) {
        this.ficheForm = this.fb.group({
            dateLivraisonEstimee: [new Date(), Validators.required],
            notes: [''],
            orderItems: this.fb.array([])
        });
    }

    ngOnInit(): void {
        this.clientId = this.route.snapshot.paramMap.get('clientId');
        this.ficheId = this.route.snapshot.paramMap.get('ficheId');

        if (this.clientId) {
            this.loadClient(this.clientId);
        }

        if (this.ficheId) {
            this.loadFiche(this.ficheId);
        } else {
            // Add one empty product by default
            this.addProduct();
        }
    }

    get orderItems(): FormArray {
        return this.ficheForm.get('orderItems') as FormArray;
    }

    createProductFormGroup(product?: any): FormGroup {
        return this.fb.group({
            designation: [product?.designation || '', Validators.required],
            reference: [product?.reference || '', Validators.required],
            prixUnitaire: [product?.prixUnitaire || 0, [Validators.required, Validators.min(0)]],
            quantite: [product?.quantite || 1, [Validators.required, Validators.min(1)]]
        });
    }

    addProduct(): void {
        this.orderItems.push(this.createProductFormGroup());
    }

    removeProduct(index: number): void {
        this.orderItems.removeAt(index);
        if (this.orderItems.length === 0) {
            this.addProduct();
        }
    }

    loadClient(id: string): void {
        this.clientService.getClient(id).subscribe({
            next: (client: Client | undefined) => {
                if (client) {
                    this.client = client;
                    this.cdr.markForCheck();
                }
            },
            error: (err: any) => {
                console.error('Error loading client:', err);
                this.snackBar.open('Erreur lors du chargement du client', 'Fermer', { duration: 3000 });
            }
        });
    }

    loadFiche(id: string): void {
        this.loading = true;
        this.ficheService.getFicheById(id).subscribe({
            next: (fiche: any) => {
                if (fiche && fiche.type === TypeFiche.PRODUIT) {
                    const ficheProduit = fiche as FicheProduit;
                    this.ficheForm.patchValue({
                        dateLivraisonEstimee: ficheProduit.dateLivraisonEstimee ? new Date(ficheProduit.dateLivraisonEstimee) : new Date(),
                        notes: ficheProduit.notes || ''
                    });

                    // Clear existing products
                    while (this.orderItems.length) {
                        this.orderItems.removeAt(0);
                    }

                    // Add products from fiche
                    if (ficheProduit.produits && ficheProduit.produits.length > 0) {
                        ficheProduit.produits.forEach(item => {
                            this.orderItems.push(this.createProductFormGroup(item));
                        });
                    } else {
                        this.addProduct();
                    }

                    if (ficheProduit.clientId && !this.client) {
                        this.loadClient(ficheProduit.clientId);
                    }
                }
                this.loading = false;
                this.cdr.markForCheck();
            },
            error: (err: any) => {
                console.error('Error loading fiche:', err);
                this.snackBar.open('Erreur lors du chargement de la fiche', 'Fermer', { duration: 3000 });
                this.loading = false;
            }
        });
    }

    onSubmit(): void {
        if (this.ficheForm.invalid || !this.clientId) {
            this.snackBar.open('Veuillez remplir correctement le formulaire', 'Fermer', { duration: 3000 });
            return;
        }

        this.saving = true;
        const formValue = this.ficheForm.value;

        const produits: ProduitVendu[] = formValue.orderItems.map((item: any) => ({
            produitId: '', // TODO: find way to select existing product if needed
            designation: item.designation,
            reference: item.reference,
            prixUnitaire: item.prixUnitaire,
            quantite: item.quantite,
            prixTotal: item.prixUnitaire * item.quantite
        }));

        const montantTotal = produits.reduce((sum, p) => sum + p.prixTotal, 0);

        if (this.ficheId) {
            const updates: Partial<FicheProduit> = {
                dateLivraisonEstimee: formValue.dateLivraisonEstimee,
                notes: formValue.notes,
                produits,
                montantTotal
            };
            this.ficheService.updateFiche(this.ficheId, updates).subscribe({
                next: () => {
                    this.snackBar.open('Fiche produit enregistrée avec succès', 'Fermer', { duration: 3000 });
                    this.router.navigate(['/p/clients', this.clientId]);
                },
                error: (err: any) => {
                    console.error('Error updating fiche:', err);
                    this.snackBar.open('Erreur lors de l\'enregistrement', 'Fermer', { duration: 3000 });
                    this.saving = false;
                }
            });
        } else {
            const newFiche: FicheProduitCreate = {
                clientId: this.clientId,
                type: TypeFiche.PRODUIT,
                statut: StatutFiche.EN_COURS,
                dateLivraisonEstimee: formValue.dateLivraisonEstimee,
                notes: formValue.notes,
                produits,
                montantTotal,
                montantPaye: 0
            };

            this.ficheService.createFicheProduit(newFiche).subscribe({
                next: () => {
                    this.snackBar.open('Fiche créée avec succès', 'Fermer', { duration: 3000 });
                    this.router.navigate(['/p/clients', this.clientId]);
                },
                error: (err: any) => {
                    console.error('Error creating fiche:', err);
                    this.snackBar.open('Erreur lors de la création', 'Fermer', { duration: 3000 });
                    this.saving = false;
                }
            });
        }
    }

    onCancel(): void {
        if (this.clientId) {
            this.router.navigate(['/p/clients', this.clientId]);
        } else {
            this.router.navigate(['/p/clients']);
        }
    }
}
