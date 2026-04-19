# 🤖 GUIDE RAPIDE - AI ASSISTANTS / GÉNÉRATION CODE

**Temps de lecture**: 10 minutes  
**Objectif**: Instructions pour AI générer code prêt-production

---

## 🎯 WORKFLOW OPTIMAL

```
INPUT:  Structure + Règles métier
 ↓
PROCESS: Generate code Type-safe
 ↓
OUTPUT: Production-ready TypeScript
```

---

## 📥 INPUTS STRUCTURÉS

### 1️⃣ Source de Vérité: JSON
```
Fichier: ANALYSE_OPTISAAS_COMPLETE.json

Contient:
├─ modules_backend (32 entrées complet)
├─ modules_frontend (18 entrées)
├─ modeles_prisma (24 schémas)
├─ flux_processus (6 workflows)
└─ enumerations (20+ types)

Usage: Parser JSON → extraire endpoint/validations → générer
```

### 2️⃣ Contexte Métier: Spécification
```
Fichier: SPECIFICATION_FINALE_OPTISAAS.md section 5

Contient: Règles métier par domaine
├─ Factures (5.1)
├─ Stock (5.2)
├─ Fidélité (5.3)
├─ Commissions (5.4)
├─ Caisse (5.5)
└─ Comptabilité (5.6)

Usage: Pour logique métier complexe (transactions, calculs)
```

### 3️⃣ Validations: DTOs
```
Fichier: DTOCS_MODELES.md

Contient: DTOs + validations précises
├─ Create/Update/Response DTOs
├─ Validators (Min, Max, Pattern, etc.)
├─ Enums et constantes
└─ Formules calculs

Usage: Copier-coller directement dans code
```

---

## 🔧 PATTERNS CODE ATTENDUS

### Backend (NestJS + Prisma)

#### Pattern 1: Service Simple
```typescript
// PROMPT:
"Generate NestJS service for Products module with CRUD operations, 
including validation from DTOCS_MODELES.md and multi-tenant isolation 
using centreId from ANALYSE_OPTISAAS_COMPLETE.json"

// OUTPUT ATTENDU:
@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}
  
  async create(data: CreateProductDto, userCentreId: string) {
    // ✓ Validation: DTOs validators appliqués
    // ✓ Multi-tenant: where centreId = userCentreId
    // ✓ Audit: userId tracé
    return this.prisma.product.create({ data });
  }
  
  async findMany(centreId: string) {
    // ✓ Multi-tenant: filtrage strict
    return this.prisma.product.findMany({
      where: { centreId }
    });
  }
}
```

#### Pattern 2: Service Complexe (Transactions)
```typescript
// PROMPT:
"Generate NestJS service for Factures creation with:
1. Atomic transaction (Prisma)
2. Stock verification (rule from section 5.2)
3. Loyalty points calculation (rule from section 5.3)
4. Commission calculation (rule from section 5.4)
Include validation and multi-tenant isolation.
Use DTOCS_MODELES.md for validation details."

// OUTPUT ATTENDU:
async create(data: CreateFactureDto, userId: string) {
  return this.prisma.$transaction(async (tx) => {
    // Step 1: Validate & create
    const facture = await tx.facture.create({...});
    
    // Step 2: Check stock
    if (facture.statut === 'VALIDEE') {
      for (const ligne of facture.lignes) {
        const stock = await tx.product.findUnique({...});
        if (stock.quantiteActuelle < ligne.quantite) {
          throw new Error('Stock insuffisant');
        }
      }
    }
    
    // Step 3: Calculate & apply points
    if (facture.statut === 'PAYEE') {
      const points = facture.totalTTC * 0.1; // Rule 5.3
      await tx.pointsHistory.create({...});
    }
    
    // Step 4: Calculate commission
    if (facture.vendeurId) {
      const commission = await this.calculateCommission(facture, tx);
      await tx.commission.create({...});
    }
    
    return facture;
  });
}
```

### Frontend (Angular)

#### Pattern 1: Service API
```typescript
// PROMPT:
"Generate Angular service for Factures API calls using HttpClient,
including error handling and RxJS operators.
Use endpoints from ANALYSE_OPTISAAS_COMPLETE.json"

// OUTPUT ATTENDU:
@Injectable()
export class FactureService {
  constructor(private http: HttpClient) {}
  
  getFactures(filters: FactureFilters): Observable<Facture[]> {
    return this.http.get<Facture[]>('/api/factures', 
      { params: this.buildParams(filters) }
    ).pipe(
      retry(1),
      catchError(this.handleError)
    );
  }
  
  create(data: CreateFactureDto): Observable<Facture> {
    return this.http.post<Facture>('/api/factures', data)
      .pipe(catchError(this.handleError));
  }
}
```

#### Pattern 2: Reactive Component
```typescript
// PROMPT:
"Generate Angular component for Facture list with:
1. Table with filters (type, statut, date range)
2. Pagination (50 items/page)
3. RxJS observables with async pipe
4. Validations from DTOCS_MODELES.md for filter forms
5. Responsive design (Material)"

// OUTPUT ATTENDU:
@Component({
  selector: 'app-facture-list',
  templateUrl: './facture-list.component.html'
})
export class FactureListComponent implements OnInit {
  factures$: Observable<Facture[]>;
  filters = new FormGroup({
    type: new FormControl(''),
    statut: new FormControl(''),
    dateStart: new FormControl('')
  });
  
  constructor(private factureService: FactureService) {}
  
  ngOnInit() {
    this.factures$ = this.filters.valueChanges.pipe(
      startWith({}),
      switchMap(filters => 
        this.factureService.getFactures(filters)
      )
    );
  }
}
```

---

## 🎯 PROMPTS PAR CAS D'USAGE

### Cas 1: Implémenter un Module Complet
```
Generate complete [MODULE_NAME] module for NestJS including:

1. DTOs (Create, Update, Response) with validation from DTOCS_MODELES.md
2. Service with business logic from SPECIFICATION_FINALE section 5
3. Controller with CRUD endpoints
4. Module configuration
5. Multi-tenant isolation (centreId filtering)
6. Error handling + validation
7. Audit logging (userId, action, timestamp)

Reference endpoints from ANALYSE_OPTISAAS_COMPLETE.json module [MODULE_NAME]

Make it production-ready with proper typing and error handling.
```

### Cas 2: Générer Validations
```
Generate TypeScript DTO validation class for [ENTITY_NAME]:

Use validation rules from DTOCS_MODELES.md
Use data types from SPECIFICATION_FINALE section 3
Use enumerations from ANALYSE_OPTISAAS_COMPLETE.json

Include class-validator decorators (@IsString, @Min, @Pattern, etc.)
Include error messages in French.
```

### Cas 3: Calculer Règle Métier
```
Implement TypeScript function for [BUSINESS_RULE]:

Rule definition: [Copy from SPECIFICATION_FINALE section 5]
Input parameters: [List from DTOCS_MODELES.md]
Output format: [Describe expected result]
Edge cases: [List from validations section]

Include proper typing, validation, and audit logging.
```

### Cas 4: Frontend Form
```
Generate Angular reactive form component for [FEATURE]:

Form fields from DTOCS_MODELES.md [ENTITY]Dto
Validations from same DTO
API endpoint from ANALYSE_OPTISAAS_COMPLETE.json
Make responsive (Material Design)
Include error messages in French
Submit to [API_ENDPOINT]
```

---

## ✅ VALIDATION CHECKLIST (Post-Generation)

- [ ] Code compile sans erreurs TypeScript
- [ ] Tous les imports/exports présents
- [ ] Multi-tenant isolation appliquée (centreId filtering)
- [ ] Validations DTO complètes (pas de data bypass)
- [ ] Transactions atomiques (Prisma $transaction si applicable)
- [ ] Error handling avec messages appropriés
- [ ] Audit trail sur CREATE/UPDATE (userId logged)
- [ ] Tests unitaires inclus
- [ ] Commentaires sur logique métier complexe
- [ ] Type-safety 100% (pas d'any)

---

## 📊 RÉFÉRENCE STRUCTURE JSON

```json
{
  "modules_backend": [
    {
      "nom": "factures",
      "endpoints": [
        {
          "method": "POST",
          "path": "/factures",
          "validation": { ... },
          "business_rules": [ ... ]
        }
      ],
      "entities": [ "Facture" ],
      "integrations": [ "paiements", "loyalty", "stock-movements" ]
    }
  ],
  "modeles_prisma": [
    {
      "nom": "Facture",
      "fields": [ ... ],
      "relations": [ ... ],
      "enums": [ "DEVIS", "FACTURE", "AVOIR" ]
    }
  ]
}
```

---

## 🚀 QUICK COMMANDS

```bash
# Parse JSON for module
cat ANALYSE_OPTISAAS_COMPLETE.json | jq '.modules_backend[] | select(.nom=="factures")'

# Extract DTO validations
grep -A 20 "CreateFactureDto" DTOCS_MODELES.md

# Find business rule
grep -n "5.1" SPECIFICATION_FINALE_OPTISAAS.md
```

---

## 📞 SI BLOCAGE

**"Rule pas claire"**
→ Read SPECIFICATION_FINALE section 5 + Validations section 7

**"API endpoint missing"**
→ Check ANALYSE_OPTISAAS_COMPLETE.json module

**"DTO validation incomplete"**
→ See DTOCS_MODELES.md [ENTITY]Dto section

**"Business logic error"**
→ Check transaction requirements (section 6 flux processus)

---

## ✨ TIPS

1. **Always use transactions** pour opérations multi-step
2. **Always filter by centreId** (multi-tenant obligatoire)
3. **Always validate DTOs** (doublon backend+frontend)
4. **Always log audit trail** (userId, action, timestamp)
5. **Always handle errors** gracefully with French messages
6. **Always add unit tests** (couverture > 80%)
7. **Always type strictly** (pas d'any!)

---

**Bon code génératif! 🤖**
