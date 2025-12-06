import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatRadioModule } from '@angular/material/radio';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { ClientService } from '../services/client.service';
import {
  TypeClient,
  TitreClient,
  TypeCouverture,
  StatutClient,
  Client,
  ClientCreate,
  RoleClientFamille,
  LienParental,
  CorrectionVisuelle,
  DureePort,
  TypePieceIdentite,
  ClientProfessionnel,
  ModalitePaiement,
  EcheancePaiement,
  TacheContact,
  CanalCommunication
} from '../models/client.model';

@Component({
  selector: 'app-client-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatSelectModule,
    MatRadioModule,
    MatCheckboxModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatExpansionModule,
    MatIconModule,
    MatTabsModule
  ],
  templateUrl: './client-form.component.html',
  styleUrl: './client-form.component.scss'
})
export class ClientFormComponent implements OnInit {
  clientForm!: FormGroup;
  isEditMode = signal(false);
  clientId = signal<string | null>(null);
  loading = signal(false);

  // Enums pour les templates
  TypeClient = TypeClient;
  TitreClient = TitreClient;
  TypeCouverture = TypeCouverture;
  StatutClient = StatutClient;
  RoleClientFamille = RoleClientFamille;
  LienParental = LienParental;
  CorrectionVisuelle = CorrectionVisuelle;
  DureePort = DureePort;
  ModalitePaiement = ModalitePaiement;
  EcheancePaiement = EcheancePaiement;
  TacheContact = TacheContact;
  CanalCommunication = CanalCommunication;

  // Listes pour les selects
  titres = Object.values(TitreClient);
  typesCouverture = Object.values(TypeCouverture);
  statuts = Object.values(StatutClient);
  rolesClientFamille = Object.values(RoleClientFamille);
  liensParentaux = Object.values(LienParental);
  correctionsVisuelles = Object.values(CorrectionVisuelle);
  dureesPort = Object.values(DureePort);
  typesPieceIdentite = Object.values(TypePieceIdentite);
  modalitesPaiement = Object.values(ModalitePaiement);
  echeancesPaiement = Object.values(EcheancePaiement);
  tachesContact = Object.values(TacheContact);
  canauxCommunication = Object.values(CanalCommunication);

  constructor(
    private fb: FormBuilder,
    private clientService: ClientService,
    private router: Router,
    private route: ActivatedRoute
  ) { }

  ngOnInit(): void {
    this.initForm();

    // Vérifier si on est en mode édition
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEditMode.set(true);
      this.clientId.set(id);
      this.loadClient(id);
    }

    // Écouter les changements de type de client
    this.clientForm.get('typeClient')?.valueChanges.subscribe(type => {
      this.onTypeClientChange(type);
    });

    // Écouter les changements de couverture sociale
    this.clientForm.get('couvertureSocialeActif')?.valueChanges.subscribe(actif => {
      this.toggleCouvertureSocialeFields(actif);
    });

    // Écouter les changements de rôle famille
    this.clientForm.get('roleFamille')?.valueChanges.subscribe(role => {
      this.toggleFamilleFields(role);
    });

    // Écouter les changements de convention
    this.clientForm.get('convention.actif')?.valueChanges.subscribe(actif => {
      this.toggleConventionFields(actif);
    });


    // Écouter les changements de titre pour adapter les champs d'identité
    this.clientForm.get('titre')?.valueChanges.subscribe(titre => {
      this.onTitreChange(titre);
    });

    // Écouter les changements de TVA
    this.clientForm.get('tvaAssujetti')?.valueChanges.subscribe(assujetti => {
      const authControl = this.clientForm.get('numeroAutorisation');
      if (assujetti) {
        authControl?.setValidators([Validators.required]);
      } else {
        authControl?.clearValidators();
        authControl?.setValue('');
      }
      authControl?.updateValueAndValidity();
    });
  }

  private initForm(): void {
    this.clientForm = this.fb.group({
      // Type de client (obligatoire)
      typeClient: [TypeClient.PARTICULIER, Validators.required],

      // Champs communs
      telephone: [''],
      ville: [''],
      adresse: [''],
      statut: [StatutClient.ACTIF, Validators.required],

      // Champs Client Particulier
      titre: [TitreClient.MR],
      nom: [''],
      prenom: [''],
      typePieceIdentite: [TypePieceIdentite.CIN],
      numeroPieceIdentite: [''],
      cinParent: [''],
      dateNaissance: [null],
      email: ['', Validators.email],

      // Couverture sociale
      couvertureSocialeActif: [false],
      couvertureSocialeType: [null],
      couvertureSocialeNumero: [''],

      // Dossier médical
      dossierMedical: this.fb.group({
        // Antécédents visuels
        correctionActuelle: [null],
        dureePort: [null],
        traumatisme: [false],
        operation: [false],
        inflammation: [false],
        sensibiliteLumiere: [false],
        secheresse: [false],
        antecedentsFamiliaux: this.fb.group({
          glaucome: [false],
          dmla: [false],
          diabete: [false],
          autres: ['']
        }),

        // Antécédents médicaux généraux
        maladiesChroniques: this.fb.group({
          actif: [false],
          details: ['']
        }),
        traitementMedicamenteux: this.fb.group({
          actif: [false],
          details: ['']
        }),
        allergies: this.fb.group({
          actif: [false],
          details: ['']
        }),

        // Habitudes et confort
        ecranPlus4h: [false],
        ressenti: this.fb.group({
          fatigue: [false],
          mauxTete: [false],
          visionFloue: [false],
          picotements: [false],
          difficultePresLoin: [false]
        }),
        sport: this.fb.group({
          actif: [false],
          details: ['']
        }),
        remarques: [''],
        notes: ['']
      }),

      // Groupe Famille
      roleFamille: [''],
      lienParental: [''],
      nomFamille: [''],
      beneficiaireOptique: [false],
      responsableFinancier: [false],
      mutuellePartagee: [false],
      adressePartagee: [false],

      // Champs Client Professionnel
      raisonSociale: [''],
      identifiantFiscal: [''],
      ice: [''],
      registreCommerce: [''],
      patente: [''],
      typePartenariat: [''],
      facturationGroupee: [false],
      tvaAssujetti: [false],
      numeroAutorisation: [''],
      // Convention (pour Professionnels)
      convention: this.fb.group({
        actif: [false],
        nomConvention: [''],
        contactNom: [''],
        contactPrenom: [''],
        contactTelephone: [''],
        remiseOfferte: [null],
        modalitePaiement: [null],
        echeancePaiement: [null]
      }),
      contacts: this.fb.array([])
    });

    // Initialiser avec les validateurs pour le type par défaut
    this.onTypeClientChange(TypeClient.PARTICULIER);
  }

  private onTypeClientChange(type: TypeClient): void {
    // Réinitialiser tous les validateurs
    this.clearAllValidators();

    switch (type) {
      case TypeClient.PARTICULIER:
        this.setParticulierValidators();
        break;
      case TypeClient.ANONYME:
        this.setAnonymeValidators();
        break;
      case TypeClient.PROFESSIONNEL:
        this.setProfessionnelValidators();
        break;
    }

    // Mettre à jour la validation
    Object.keys(this.clientForm.controls).forEach(key => {
      this.clientForm.get(key)?.updateValueAndValidity();
    });
  }

  private clearAllValidators(): void {
    const fields = ['titre', 'nom', 'prenom', 'numeroPieceIdentite', 'dateNaissance', 'telephone', 'ville', 'email',
      'raisonSociale', 'identifiantFiscal', 'ice'];
    fields.forEach(field => {
      this.clientForm.get(field)?.clearValidators();
    });
  }

  private setParticulierValidators(): void {
    this.clientForm.get('titre')?.setValidators([Validators.required]);
    this.clientForm.get('nom')?.setValidators([Validators.required]);
    this.clientForm.get('prenom')?.setValidators([Validators.required]);
    this.clientForm.get('prenom')?.setValidators([Validators.required]);
    // Validation dynamique gérée par onTitreChange
    // this.clientForm.get('numeroPieceIdentite')?.setValidators([Validators.required, Validators.minLength(5)]);
    this.onTitreChange(this.clientForm.get('titre')?.value);
    this.clientForm.get('dateNaissance')?.setValidators([Validators.required]);
    this.clientForm.get('telephone')?.setValidators([Validators.required]);
    this.clientForm.get('ville')?.setValidators([Validators.required]);
  }

  private setAnonymeValidators(): void {
    // Aucun champ obligatoire pour anonyme
  }

  private setProfessionnelValidators(): void {
    this.clientForm.get('raisonSociale')?.setValidators([Validators.required]);
    this.clientForm.get('identifiantFiscal')?.setValidators([Validators.required]);
    this.clientForm.get('ice')?.setValidators([Validators.required]);
    this.clientForm.get('telephone')?.setValidators([Validators.required]);
    this.clientForm.get('email')?.setValidators([Validators.required, Validators.email]);
    this.clientForm.get('ville')?.setValidators([Validators.required]);
    this.clientForm.get('ville')?.setValidators([Validators.required]);
  }

  private toggleConventionFields(actif: boolean): void {
    const group = this.clientForm.get('convention') as FormGroup;
    if (actif) {
      group.get('nomConvention')?.setValidators([Validators.required]);
    } else {
      group.get('nomConvention')?.clearValidators();
    }
    group.get('nomConvention')?.updateValueAndValidity();
  }

  private toggleCouvertureSocialeFields(actif: boolean): void {
    const control = this.clientForm.get('couvertureSocialeType');
    if (actif) {
      control?.setValidators([Validators.required]);
    } else {
      control?.clearValidators();
    }
    control?.updateValueAndValidity();
  }

  private toggleFamilleFields(role: RoleClientFamille): void {
    const lienControl = this.clientForm.get('lienParental');
    const nomFamilleControl = this.clientForm.get('nomFamille');

    if (role === RoleClientFamille.MEMBRE) {
      lienControl?.setValidators([Validators.required]);
      nomFamilleControl?.setValidators([Validators.required]);
    } else {
      lienControl?.clearValidators();
      nomFamilleControl?.clearValidators();
      lienControl?.setValue('');
      nomFamilleControl?.setValue('');
    }
    lienControl?.updateValueAndValidity();
    nomFamilleControl?.updateValueAndValidity();
  }

  private onTitreChange(titre: TitreClient): void {
    const numPieceControl = this.clientForm.get('numeroPieceIdentite');
    const cinParentControl = this.clientForm.get('cinParent');

    if (titre === TitreClient.ENF) {
      // Si enfant : Numéro pièce masqué/optionnel, CIN Parent requis
      numPieceControl?.clearValidators();
      cinParentControl?.setValidators([Validators.required, Validators.minLength(5)]);
    } else {
      // Si adulte : Numéro pièce requis, CIN Parent masqué/optionnel
      cinParentControl?.clearValidators();
      numPieceControl?.setValidators([Validators.required, Validators.minLength(5)]);
    }

    numPieceControl?.updateValueAndValidity();
    cinParentControl?.updateValueAndValidity();
  }

  get contacts(): FormArray {
    return this.clientForm.get('contacts') as FormArray;
  }

  addContact(): void {
    const contactGroup = this.fb.group({
      nom: ['', Validators.required],
      prenom: ['', Validators.required],
      fonction: ['', Validators.required],
      telephone: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      taches: [[]],
      canal: ['']
    });
    this.contacts.push(contactGroup);
  }

  removeContact(index: number): void {
    this.contacts.removeAt(index);
  }

  private loadClient(id: string): void {
    this.loading.set(true);
    this.clientService.getClient(id).subscribe({
      next: (client) => {
        if (client) {
          this.populateForm(client);
        }
        this.loading.set(false);
      },
      error: (error) => {
        console.error('Erreur lors du chargement du client:', error);
        this.loading.set(false);
      }
    });
  }

  private populateForm(client: Client): void {
    // 1. Définir les valeurs de base
    this.clientForm.patchValue({
      typeClient: client.typeClient,
      telephone: client.telephone,
      ville: client.ville,
      adresse: client.adresse,
      statut: client.statut || StatutClient.ACTIF
    });

    // 2. Mettre à jour les validateurs selon le type
    this.onTypeClientChange(client.typeClient);

    // 3. Remplir les champs spécifiques
    if (client.typeClient === TypeClient.PARTICULIER) {
      this.clientForm.patchValue({
        titre: client.titre,
        nom: client.nom,
        prenom: client.prenom,
        typePieceIdentite: client.typePieceIdentite,
        numeroPieceIdentite: client.numeroPieceIdentite,
        cinParent: client.cinParent,
        dateNaissance: client.dateNaissance,
        email: client.email
      });

      // Convention retirée pour Particulier ici (plus d'onglet)


      // Couverture sociale
      if (client.couvertureSociale) {
        this.clientForm.patchValue({
          couvertureSocialeActif: client.couvertureSociale.actif,
          couvertureSocialeType: client.couvertureSociale.type,
          couvertureSocialeNumero: client.couvertureSociale.numeroAdhesion
        });
        this.toggleCouvertureSocialeFields(true);
      }

      // Dossier médical
      if (client.dossierMedical) {
        this.clientForm.patchValue({
          dossierMedical: client.dossierMedical
        });
      }

      // Groupe Famille
      if (client.groupeFamille) {
        this.clientForm.patchValue({
          roleFamille: client.groupeFamille.role,
          lienParental: client.groupeFamille.lienParental,
          nomFamille: client.groupeFamille.nomFamille,
          beneficiaireOptique: client.groupeFamille.beneficiaireOptique,
          responsableFinancier: client.groupeFamille.responsableFinancier,
          mutuellePartagee: client.groupeFamille.mutuellePartagee,
          adressePartagee: client.groupeFamille.adressePartagee
        });
        this.toggleFamilleFields(client.groupeFamille.role);
      }

    } else if (client.typeClient === TypeClient.PROFESSIONNEL) {
      this.clientForm.patchValue({
        raisonSociale: client.raisonSociale,
        identifiantFiscal: client.identifiantFiscal,
        ice: client.ice,
        registreCommerce: client.registreCommerce,
        patente: client.patente,
        typePartenariat: client.typePartenariat,
        facturationGroupee: client.facturationGroupee,
        tvaAssujetti: client.tvaAssujetti,
        numeroAutorisation: client.numeroAutorisation,
        email: client.email
      });

      // Update validation for TVA manually if needed since we just patched
      if (client.tvaAssujetti) {
        this.clientForm.get('numeroAutorisation')?.setValidators([Validators.required]);
        this.clientForm.get('numeroAutorisation')?.updateValueAndValidity();
      }

      // Convention
      if (client.convention) {
        this.clientForm.patchValue({
          convention: client.convention
        });
        this.toggleConventionFields(client.convention.actif);
      }

      // Contacts
      if (client.contacts && client.contacts.length > 0) {
        client.contacts.forEach(contact => {
          const contactGroup = this.fb.group({
            nom: [contact.nom, Validators.required],
            prenom: [contact.prenom, Validators.required],
            fonction: [contact.fonction, Validators.required],
            telephone: [contact.telephone, Validators.required],
            email: [contact.email, [Validators.required, Validators.email]],
            taches: [contact.taches || []],
            canal: [contact.canal || '']
          });
          this.contacts.push(contactGroup);
        });
      }
    }
  }

  onSubmit(): void {
    if (this.clientForm.invalid) {
      this.clientForm.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    const clientData = this.buildClientData();

    if (this.isEditMode() && this.clientId()) {
      this.updateClient(this.clientId()!, clientData);
    } else {
      this.createClient(clientData);
    }
  }

  private buildClientData(): any {
    const formValue = this.clientForm.value;
    const typeClient = formValue.typeClient;

    // Champs de base présents pour Anonyme aussi
    const baseData = {
      typeClient,
      telephone: formValue.telephone || undefined,
      ville: formValue.ville || undefined,
      adresse: formValue.adresse || undefined,
      statut: formValue.statut
    };

    if (typeClient === TypeClient.PARTICULIER) {
      return {
        ...baseData,
        typeClient: TypeClient.PARTICULIER,
        titre: formValue.titre,
        nom: formValue.nom,
        prenom: formValue.prenom,
        typePieceIdentite: formValue.typePieceIdentite,
        numeroPieceIdentite: formValue.numeroPieceIdentite,
        cinParent: formValue.cinParent || undefined,
        dateNaissance: formValue.dateNaissance,
        telephone: formValue.telephone,
        email: formValue.email || undefined,
        ville: formValue.ville,
        // Convention supprimée
        couvertureSociale: formValue.couvertureSocialeActif ? {
          actif: true,
          type: formValue.couvertureSocialeType,
          numeroAdhesion: formValue.couvertureSocialeNumero
        } : undefined,
        dossierMedical: formValue.dossierMedical,
        groupeFamille: formValue.roleFamille ? {
          role: formValue.roleFamille,
          lienParental: formValue.roleFamille === RoleClientFamille.MEMBRE ? formValue.lienParental : undefined,
          nomFamille: formValue.roleFamille === RoleClientFamille.MEMBRE ? formValue.nomFamille : undefined,
          beneficiaireOptique: formValue.beneficiaireOptique,
          responsableFinancier: formValue.responsableFinancier,
          mutuellePartagee: formValue.mutuellePartagee,
          adressePartagee: formValue.adressePartagee
        } : undefined
      };
    } else if (typeClient === TypeClient.PROFESSIONNEL) {
      return {
        ...baseData,
        typeClient: TypeClient.PROFESSIONNEL,
        raisonSociale: formValue.raisonSociale,
        identifiantFiscal: formValue.identifiantFiscal,
        ice: formValue.ice,
        registreCommerce: formValue.registreCommerce || undefined,
        patente: formValue.patente || undefined,
        telephone: formValue.telephone,
        email: formValue.email,
        ville: formValue.ville,
        typePartenariat: formValue.typePartenariat || undefined,
        facturationGroupee: formValue.facturationGroupee,
        tvaAssujetti: formValue.tvaAssujetti,
        numeroAutorisation: formValue.numeroAutorisation || undefined,
        convention: formValue.convention,
        contacts: formValue.contacts || []
      };
    } else {
      // Anonyme
      return {
        ...baseData,
        typeClient: TypeClient.ANONYME,
        nom: formValue.nom || undefined,
        prenom: formValue.prenom || undefined
      };
    }
  }

  private createClient(clientData: any): void {
    this.clientService.createClient(clientData).subscribe({
      next: (newClient) => {
        this.loading.set(false);
        // Rediriger vers la page de détail du client
        this.router.navigate(['/p/clients', newClient.id]);
      },
      error: (error) => {
        console.error('Erreur lors de la création du client:', error);
        this.loading.set(false);
        alert(error.message || 'Erreur lors de la création du client');
      }
    });
  }

  private updateClient(id: string, clientData: any): void {
    this.clientService.updateClient(id, clientData as Partial<Client>).subscribe({
      next: () => {
        this.loading.set(false);
        this.router.navigate(['/p/clients']);
      },
      error: (error) => {
        console.error('Erreur lors de la mise à jour du client:', error);
        this.loading.set(false);
        alert(error.message || 'Erreur lors de la mise à jour du client');
      }
    });
  }

  onCancel(): void {
    this.router.navigate(['/p/clients']);
  }
}
