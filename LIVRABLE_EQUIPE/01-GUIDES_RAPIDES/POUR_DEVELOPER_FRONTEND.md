# 👨‍🎨 GUIDE RAPIDE - DÉVELOPPEUR FRONTEND

**Temps de lecture**: 15 minutes  
**Objectif**: Démarrer implémentation écrans

---

## 🎯 RÉSUMÉ

OptiSaas = Frontend Angular gérant interface pour gestion optique

**Tech**: Angular 15+, TypeScript, RxJS, Reactive Forms, Material Design

**Votre travail**: Créer écrans responsifs, forms validées, appels API, gestion état

---

## 📱 ÉCRANS PRINCIPAUX À IMPLÉMENTER

### Tier 1: CRITIQUES
```
✅ Dashboard           → KPIs, graphiques, widgets
✅ Liste Factures      → Table, filtres, pagination
✅ Détail Facture      → Voir/éditer/PDF/paiements
✅ Créer Facture       → Wizard client→produits→paiement
✅ Gestion Clients     → CRUD clients + fiches
```

### Tier 2: IMPORTANTS
```
📦 Stock Management    → Inventaire, mouvements, alertes
💳 Paiements           → Enregistrer, modes, historique
💼 Personnel           → Employés, paie, commissions
⚙️ Settings            → Configuration, validations
```

### Tier 3: SUPPORT
```
📊 Rapports            → Tableaux bord analytiques
👥 User Management     → Rôles, permissions
🏢 Groupes/Centres     → Multi-centre gestion
```

---

## 🏗️ STRUCTURE QUE VOUS ALLEZ RENCONTRER

```
frontend/src/app/features/
├── dashboard/
│   ├── pages/
│   │   └── dashboard.component.ts
│   ├── services/
│   │   └── dashboard.service.ts
│   └── models/
│       └── dashboard.model.ts
│
├── finance/
│   ├── pages/
│   │   ├── facture-list.component
│   │   └── facture-detail.component
│   ├── dialogs/
│   │   └── paiement-dialog.component
│   ├── services/
│   │   └── facture.service.ts
│   └── models/
│       └── facture.model.ts
│
└── [+ 16 autres modules...]

Pattern: Pages → Services → API Backend
```

---

## 💡 FLUX UTILISATEUR CLÉS

### Cycle Vente Complet (Ce que fait l'utilisateur)
```
1. Chercher/créer CLIENT
   └─ Form: nom, téléphone, email

2. Créer FICHE (dossier optique)
   └─ Form: prescription (sphère, cylindre, axe)

3. Sélectionner PRODUITS
   └─ Autocomplete: montures, verres, lentilles

4. Voir DÉVIS (auto-calc: HT, TVA, TTC)
   └─ Display: montants, remise si convention

5. VALIDER Devis
   └─ Système check stock automatiquement

6. ENREGISTRER PAIEMENT
   └─ Form: mode (espèces/carte/chèque), montant

7. Voir FACTURE FINALE (PDF généré)
   └─ Email client
```

### Points Fidélité (Affichage)
```
Client voir:
├─ Points actuels (solde)
├─ Historique (gagnés/utilisés)
├─ Réseau parrainage (filleuls)
└─ Remise possible (si 500+ pts)
```

---

## 📝 VALIDATIONS UI ESSENTIELLES

```typescript
// Client Form
- Email: unique, format @
- Téléphone: 10 chiffres
- Nom: non-vide

// Fiche Prescription
- Sphère: -20 à +20
- Cylindre: -8 à 0
- Axe: 0 à 180

// Facture Paiement
- Montant: > 0, ≤ resteAPayer
- Mode: ESPECES|CARTE|CHEQUE|VIREMENT
- Référence: si chèque/virement

// Stock Movement
- Quantité: > 0, ≤ quantitéDisponible
- Entrepôt source ≠ Entrepôt destination (si transfert)
```

---

## 🔗 APPELS API (PATTERNS)

### Lister Factures
```typescript
// facture.service.ts
@Injectable()
export class FactureService {
  constructor(private http: HttpClient) {}
  
  getFactures(filters: {
    type?: string;
    statut?: string;
    dateStart?: Date;
    dateEnd?: Date;
    page?: number;
    limit?: number;
  }) {
    return this.http.get<Facture[]>('/api/factures', { params: filters });
  }
}

// component.ts
export class FactureListComponent {
  factures$: Observable<Facture[]>;
  
  constructor(private factureService: FactureService) {
    this.factures$ = this.factureService.getFactures({
      limit: 50,
      page: 1
    });
  }
}

// template.html
<table>
  <tr *ngFor="let facture of (factures$ | async)">
    <td>{{ facture.numero }}</td>
    <td>{{ facture.totalTTC | currency }}</td>
  </tr>
</table>
```

### Créer Facture (Wizard)
```typescript
// Multi-step form
@Component({
  template: `
    <mat-stepper>
      <mat-step label="Client">
        <!-- Rechercher/créer client -->
      </mat-step>
      <mat-step label="Produits">
        <!-- Ajouter monture, verres, lentilles -->
      </mat-step>
      <mat-step label="Aperçu">
        <!-- Voir HT, TVA, TTC, remises -->
      </mat-step>
      <mat-step label="Paiement">
        <!-- Enregistrer paiement -->
      </mat-step>
    </mat-stepper>
  `
})
```

### Enregistrer Paiement
```typescript
// Payment Dialog
registerPayment(paiement: {
  factureId: string;
  montant: number;
  mode: 'ESPECES' | 'CARTE' | 'CHEQUE' | 'VIREMENT';
  reference?: string;
}) {
  return this.http.post('/api/paiements', paiement)
    .pipe(
      tap(result => {
        // ✅ Auto-updates:
        // - Facture.statut (PAYEE/PARTIELLE)
        // - Facture.resteAPayer
        // - Points créés
        // - OperationCaisse créée
        // - Commission calculée
      })
    );
}
```

---

## 📊 ÉLÉMENTS UI COURANTS

### Table avec Filtres
```typescript
@Component({
  template: `
    <div>
      <mat-form-field>
        <mat-label>Type</mat-label>
        <mat-select [(ngModel)]="filters.type">
          <mat-option value="FACTURE">Facture</mat-option>
          <mat-option value="DEVIS">Devis</mat-option>
        </mat-select>
      </mat-form-field>
      
      <table mat-table [dataSource]="factures$">
        <!-- Colonnes -->
      </table>
      
      <mat-paginator 
        [length]="total"
        [pageSize]="50"
        (page)="onPageChange($event)"
      ></mat-paginator>
    </div>
  `
})
```

### Form Réactif
```typescript
export class ClientFormComponent {
  form: FormGroup;
  
  constructor(private fb: FormBuilder) {
    this.form = this.fb.group({
      nomComplet: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      telephone: ['', [Validators.pattern(/^\d{10}$/)]],
      type: ['PARTICULIER', Validators.required]
    });
  }
  
  submit() {
    if (this.form.valid) {
      this.clientService.create(this.form.value).subscribe(...);
    }
  }
}
```

### Affichage Conditionnel (Statuts)
```html
<!-- Voir statut facture + actions possibles -->
<div [ngSwitch]="facture.statut">
  <div *ngSwitchCase="'DEVIS_EN_COURS'">
    <button (click)="valider()">Valider</button>
    <button (click)="modifier()">Modifier</button>
  </div>
  <div *ngSwitchCase="'VALIDEE'">
    <button (click)="enregistrerPaiement()">Enregistrer Paiement</button>
  </div>
  <div *ngSwitchCase="'PAYEE'">
    <p>Facture payée ✅</p>
    <button (click)="genererAvoir()">Générer Avoir</button>
  </div>
</div>
```

---

## 🎨 UX PRINCIPLES

### Validations Inline
```typescript
// Quand utilisateur tape:
- Email: Check format EN TEMPS RÉEL (rouge/vert)
- Montant: Check > 0 (rouge si négatif)
- Stock: Check quantité dispo (message alerte)
```

### Feedback utilisateur
```typescript
// Action API:
- Loading spinner pendant requête
- Message succès (snackbar vert)
- Message erreur (snackbar rouge, détail)
- Auto-refresh table après création
```

### Responsive
```typescript
// Desktop (> 1200px)
- Tables full width
- Dialogs larges
- Sidebars

// Tablet (600-1200px)
- Tables scrollables horizontal
- Dialogs medium
- Menu burger

// Mobile (< 600px)
- Stack vertical
- Dialogs fullscreen
- Drawer navigation
```

---

## 🔐 SÉCURITÉ UI

### Permissions Affichage
```typescript
// Ne pas afficher bouton si user n'a pas permission
<button *ngIf="hasPermission('VALIDER_FACTURES')">
  Valider
</button>

// Check permission backend + frontend
```

### Données Sensibles
```typescript
// Masquer/tronquer données
- Email: user@*** (caché)
- SIRET: 123 45* ****
- Bancaire: ****5678

// Lazy-load sur demande
```

---

## 📚 DOCUMENTS À CONSULTER

### Urgent
- **[../03-SPECIFICATIONS/SPECIFICATION_FINALE_OPTISAAS.md](../03-SPECIFICATIONS/SPECIFICATION_FINALE_OPTISAAS.md)**
  - Section 4: Modules frontend
  - Section 9: Wireframes UI

### Important
- **[../02-DOCUMENTATION_TECHNIQUE/FLUX_PROCESSUS.md](../02-DOCUMENTATION_TECHNIQUE/FLUX_PROCESSUS.md)**
  - Workflows utilisateur

- **[../03-SPECIFICATIONS/DTOCS_MODELES.md](../03-SPECIFICATIONS/DTOCS_MODELES.md)**
  - Validations pour forms

---

## ⚡ PREMIERS PAS (1h)

### 20 min: Lecture
1. [SPECIFICATION_FINALE_OPTISAAS.md](../03-SPECIFICATIONS/SPECIFICATION_FINALE_OPTISAAS.md) section 4 (modules FE)
2. [SPECIFICATION_FINALE_OPTISAAS.md](../03-SPECIFICATIONS/SPECIFICATION_FINALE_OPTISAAS.md) section 9 (wireframes)

### 20 min: Setup
```bash
npm install
npm start
# Ouvrir http://localhost:4200
```

### 20 min: Inspection
1. Ouvrir `/src/app/features/` dans VSCode
2. Consulter module existant (structure)
3. Vérifier pattern: pages → services → API

---

## ✅ CHECKLIST AVANT DE CODER

- [ ] Lire [SPECIFICATION_FINALE_OPTISAAS.md](../03-SPECIFICATIONS/SPECIFICATION_FINALE_OPTISAAS.md) sections 4 et 9
- [ ] Setup local: `npm install && npm start`
- [ ] Consulter [DTOCS_MODELES.md](../03-SPECIFICATIONS/DTOCS_MODELES.md) pour validations
- [ ] Inspecter module existant pour pattern
- [ ] Comprendre cycle vente (6 étapes ci-dessus)
- [ ] Prêt ✅

---

## 🚀 BON CODE!

Questions? → [../04-RESSOURCES/FAQ_COMMUNES.md](../04-RESSOURCES/FAQ_COMMUNES.md)
