# 👓 ANALYSE APPROFONDIE - MÉTIER OPTIQUE AVANCÉ

**Date**: 2026-04-19  
**Status**: 🔴 **GAP IDENTIFIÉ - À IMPLÉMENTER**  
**Audience**: Développeurs, Product, Opticiens

---

## 📋 TABLE DES MATIÈRES

1. [OCR Ordonnance & Facture](#ocr-ordonnance--facture)
2. [Extraction et Injection de Données](#extraction-et-injection-de-données)
3. [Suggestions IA](#suggestions-ia)
4. [Essayage Virtuel](#essayage-virtuel)
5. [Fiche Montage/Centrage Virtuel](#fiche-montagcentrage-virtuel)
6. [Suivi Bon de Commande](#suivi-bon-de-commande)
7. [Architecture Technique](#architecture-technique)

---

## 🔴 ÉTAT ACTUEL - GAPS CRITIQUES

| Feature | Status | Implémentation | Priority |
|---------|--------|-----------------|----------|
| **OCR Ordonnance** | ❌ Manquant | 0% | 🔴 CRITIQUE |
| **OCR Facture** | ❌ Manquant | 0% | 🔴 CRITIQUE |
| **Extraction données** | ❌ Manquant | 0% | 🟠 HAUTE |
| **Injection auto** | ❌ Manquant | 0% | 🟠 HAUTE |
| **IA Suggestions** | ❌ Manquant | 0% | 🟠 HAUTE |
| **Essayage Virtual** | ❌ Manquant | 0% | 🟡 MOYENNE |
| **Montage Virtual** | ❌ Manquant | 0% | 🟡 MOYENNE |
| **Suivi BC Avancé** | ⚠️ Basique | 20% | 🟡 MOYENNE |

---

## 🔍 OCR ORDONNANCE & FACTURE

### 1.1 Ordonnance (Prescription Optique)

**Format Standard Marocain**:
```
┌─────────────────────────────────────┐
│ ORDONNANCE OPTIQUE                  │
├─────────────────────────────────────┤
│ DONNÉES À EXTRAIRE:                 │
│                                     │
│ Patient: [Nom Complet]              │
│ Date: [JJ/MM/YYYY]                  │
│ Opticien: [Dr. XXX]                │
│                                     │
│ ┌─ OEIL DROIT (OD) ────────────────┐│
│ │ Sphère (SPH):    +2.50           ││
│ │ Cylindre (CYL):  -0.75           ││
│ │ Axe (AXE):       180°            ││
│ │ Addition (ADD):  +2.00           ││
│ │ Distance P/V:    14mm            ││
│ └─────────────────────────────────┘│
│                                     │
│ ┌─ OEIL GAUCHE (OG) ───────────────┐│
│ │ Sphère (SPH):    +1.50           ││
│ │ Cylindre (CYL):  -0.50           ││
│ │ Axe (AXE):       175°            ││
│ │ Addition (ADD):  +2.00           ││
│ │ Distance P/V:    14mm            ││
│ └─────────────────────────────────┘│
│                                     │
│ Type: Lunettes / Lentilles         │
│ Observations: [Notes optométriste]  │
└─────────────────────────────────────┘
```

**Implémentation OCR**:

```typescript
// backend/src/features/ocr/ocr.service.ts

import Tesseract from 'tesseract.js';
import * as sharp from 'sharp';

interface OrdonnanceExtracted {
  patient: {
    nom: string;
    prenom: string;
    dateNaissance?: string;
  };
  date: Date;
  opticien: string;
  oeil_droit: {
    sph: number;
    cyl: number;
    axe: number;
    add?: number;
    distancePV?: number;
  };
  oeil_gauche: {
    sph: number;
    cyl: number;
    axe: number;
    add?: number;
    distancePV?: number;
  };
  type: 'LUNETTES' | 'LENTILLES' | 'MIXTE';
  observations: string;
  confidence: number; // 0-100
}

@Injectable()
export class OcrService {
  async extractOrdonnance(imageBuffer: Buffer): Promise<OrdonnanceExtracted> {
    // 1. Pré-traitement image
    const processedImage = await this.preprocessImage(imageBuffer);

    // 2. OCR avec Tesseract
    const result = await Tesseract.recognize(
      processedImage,
      'fra',  // Français
      {
        logger: (m) => console.log('OCR:', m),
      }
    );

    // 3. Parse texte brut avec regex
    const text = result.data.text;
    const extracted = this.parseOrdonnanceText(text);

    // 4. Validation données
    this.validateOrdonnanceData(extracted);

    return extracted;
  }

  private async preprocessImage(buffer: Buffer): Promise<Buffer> {
    // Enhancer image pour meilleur OCR
    return await sharp(buffer)
      .grayscale()           // Convertir en B&W
      .threshold(150)        // Binary threshold
      .sharpen()             // Nettoyer
      .normalize()           // Normaliser contraste
      .toBuffer();
  }

  private parseOrdonnanceText(text: string): OrdonnanceExtracted {
    // Regex patterns
    const patterns = {
      sph: /SPH[:\s]+(-?\d+\.\d{2})/gi,
      cyl: /CYL[:\s]+(-?\d+\.\d{2})/gi,
      axe: /AXE[:\s]+(\d+)/gi,
      add: /ADD[:\s]+(\+?\d+\.\d{2})/gi,
      nom: /NOM[:\s]+([A-ZÀÂÄÉ][A-ZÀÂÄÉa-zàâäé\s-]+)/i,
      date: /(\d{2}\/\d{2}\/\d{4})/,
    };

    const lines = text.split('\n');
    let inOdSection = false;
    let inOgSection = false;
    const ordonnance: any = {
      oeil_droit: {},
      oeil_gauche: {},
    };

    for (const line of lines) {
      const upper = line.toUpperCase();

      // Detect sections
      if (upper.includes('OD') || upper.includes('DROIT')) inOdSection = true;
      if (upper.includes('OG') || upper.includes('GAUCHE')) inOgSection = true;

      // Extract values
      let match;
      if ((match = patterns.sph.exec(line)) && inOdSection) {
        ordonnance.oeil_droit.sph = parseFloat(match[1]);
      }
      if ((match = patterns.cyl.exec(line)) && inOdSection) {
        ordonnance.oeil_droit.cyl = parseFloat(match[1]);
      }
      if ((match = patterns.axe.exec(line)) && inOdSection) {
        ordonnance.oeil_droit.axe = parseInt(match[1]);
      }
      // ... même logique pour OG
    }

    return ordonnance as OrdonnanceExtracted;
  }

  private validateOrdonnanceData(data: OrdonnanceExtracted): void {
    // Validations optométriques
    if (Math.abs(data.oeil_droit.sph) > 20) {
      throw new Error('Sphère OD invalide (> 20D)');
    }
    if (data.oeil_droit.axe < 0 || data.oeil_droit.axe > 180) {
      throw new Error('Axe OD invalide (0-180°)');
    }
  }
}
```

**Endpoint**:
```typescript
@Post('extract-ordonnance')
@UseInterceptors(FileInterceptor('ordonnance'))
async extractOrdonnance(@UploadedFile() file: Express.Multer.File) {
  return this.ocrService.extractOrdonnance(file.buffer);
}
```

---

### 1.2 Facture Fournisseur (Extraction Automatique)

**Données à extraire**:
- Numéro facture
- Date
- Montant TTC/HT
- Articles (quantité, prix, description)
- Fournisseur
- Numéro commande associé

**Implémentation**:
```typescript
interface FactureExtracted {
  numero: string;
  date: Date;
  fournisseur: string;
  montantHT: number;
  montantTTC: number;
  tva: number;
  articles: Array<{
    description: string;
    quantite: number;
    prixUnitaire: number;
    total: number;
  }>;
  numeroCommande?: string;
}

async extractFacture(imageBuffer: Buffer): Promise<FactureExtracted> {
  const result = await Tesseract.recognize(imageBuffer, 'fra');
  const text = result.data.text;

  // Parse avec regex spécifiques invoices
  const patterns = {
    numero: /FACTURE[:\s]+N°?([0-9A-Z-]+)/i,
    date: /DATE[:\s]+(\d{2}\/\d{2}\/\d{4})/i,
    montantTTC: /TOTAL TTC[:\s]+(\d+[.,]\d{2})/i,
    articles: /(\d+)\s+×?\s+([A-Z0-9-]+)\s+([0-9.,]+)\s+([0-9.,]+)/g,
  };

  const facture: any = {};
  
  // Extract each field
  let match;
  if ((match = patterns.numero.exec(text))) {
    facture.numero = match[1];
  }
  // ... extract other fields

  return facture as FactureExtracted;
}
```

---

## 💾 EXTRACTION ET INJECTION DE DONNÉES

### 2.1 Architecture d'Injection

```typescript
// backend/src/features/ocr/injection.service.ts

interface InjectionConfig {
  ordonnanceId: string;
  fichId: string;
  centreId: string;
  autoCorrect: boolean; // Correction automatique si confiance > 95%
  requireConfirmation: boolean; // Demander confirmation sinon
}

@Injectable()
export class InjectionService {
  constructor(
    private prisma: PrismaService,
    private fichesService: FichesService,
    private auditService: AuditService,
  ) {}

  /**
   * Injecter données OCR dans fiche existante
   * Avec validation et audit trail
   */
  async injectOrdonnanceData(
    config: InjectionConfig,
    ocrData: OrdonnanceExtracted,
  ): Promise<{ success: boolean; fiche: Fiche; warnings: string[] }> {
    
    const warnings: string[] = [];

    // 1. Validation confiance
    if (ocrData.confidence < 80) {
      if (config.requireConfirmation) {
        throw new Error('Confiance OCR insuffisante (<80%). Confirmation requise.');
      }
      warnings.push(`⚠️ Confiance OCR basse: ${ocrData.confidence}%`);
    }

    // 2. Récupérer fiche
    const fiche = await this.prisma.fiche.findUnique({
      where: { id: config.fichId },
    });

    if (!fiche) throw new BadRequestException('Fiche not found');

    // 3. Mapper données OCR → Fiche content
    const newContent = this.mapOrdonnanceToFiche(ocrData, fiche.content as any);

    // 4. Validation métier
    this.validateFicheContent(newContent);

    // 5. Mise à jour avec audit trail
    const updatedFiche = await this.prisma.fiche.update({
      where: { id: config.fichId },
      data: { content: newContent },
    });

    // 6. Log audit
    await this.auditService.logAction(
      'INJECT_OCR_DATA',
      config.centreId,
      {
        ordonnanceId: config.ordonnanceId,
        fieldsInjected: Object.keys(newContent),
        confidence: ocrData.confidence,
        autoCorrect: config.autoCorrect,
      },
    );

    return {
      success: true,
      fiche: updatedFiche,
      warnings,
    };
  }

  private mapOrdonnanceToFiche(
    ocr: OrdonnanceExtracted,
    currentContent: any,
  ): any {
    return {
      ...currentContent,
      ordonnance: {
        date: ocr.date,
        opticien: ocr.opticien,
        od: {
          sph: ocr.oeil_droit.sph,
          cyl: ocr.oeil_droit.cyl,
          axe: ocr.oeil_droit.axe,
          add: ocr.oeil_droit.add,
        },
        og: {
          sph: ocr.oeil_gauche.sph,
          cyl: ocr.oeil_gauche.cyl,
          axe: ocr.oeil_gauche.axe,
          add: ocr.oeil_gauche.add,
        },
      },
      typeVue: ocr.type,
      observations: ocr.observations,
    };
  }

  private validateFicheContent(content: any): void {
    // Validations métier optique
    const od = content.ordonnance?.od;
    const og = content.ordonnance?.og;

    if (od && Math.abs(od.sph - og.sph) > 8) {
      console.warn('⚠️ Écart sphère important entre OD/OG');
    }

    if (od?.axe < 0 || od?.axe > 180) {
      throw new BadRequestException('Axe invalide');
    }
  }
}
```

**Workflow d'Injection**:
```
┌─────────────────────────┐
│ 1. Upload Ordonnance    │
│    (JPG/PDF)            │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│ 2. OCR + Extraction     │
│    Tesseract.js         │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│ 3. Confidence Check     │
│    Confidence > 80%?    │
└────────────┬────────────┘
             │
      ┌──────┴──────┐
      │             │
   OUI│             │NON
      │             │
      ▼             ▼
   AUTO      CONFIRM
   INJECT    NEEDED
      │             │
      └──────┬──────┘
             │
             ▼
┌─────────────────────────┐
│ 4. Inject + Audit       │
│    Update Fiche         │
└─────────────────────────┘
```

---

## 🤖 SUGGESTIONS IA

### 3.1 Recommandation Produits

**Logique de Suggestion**:
```typescript
interface ProductSuggestion {
  productId: string;
  nom: string;
  raison: string; // Why recommended
  confidence: number; // 0-100
  prix: number;
  stock: number;
}

@Injectable()
export class AISuggestionService {
  constructor(
    private prisma: PrismaService,
  ) {}

  async suggestProducts(fiche: Fiche): Promise<ProductSuggestion[]> {
    const content = fiche.content as any;
    const ordonnance = content.ordonnance || {};
    const suggestions: ProductSuggestion[] = [];

    // 1. Basé sur prescription
    const prescriptionBased = await this.suggestByPrescription(ordonnance);
    suggestions.push(...prescriptionBased);

    // 2. Basé sur historique client
    const historyBased = await this.suggestByHistory(fiche.clientId);
    suggestions.push(...historyBased);

    // 3. Basé sur stock/tendances
    const trendBased = await this.suggestByTrends();
    suggestions.push(...trendBased);

    // 4. Scorer et ranker
    return this.rankSuggestions(suggestions);
  }

  private async suggestByPrescription(ordonnance: any): Promise<ProductSuggestion[]> {
    const suggestions: ProductSuggestion[] = [];

    const od = ordonnance.od || {};
    const og = ordonnance.og || {};

    // Logique 1: Verres selon puissance
    if (Math.abs(od.sph) > 4 || Math.abs(og.sph) > 4) {
      // Haute correction → verres amincis
      const thinLenses = await this.prisma.product.findMany({
        where: {
          type: 'VERRES',
          tags: { has: 'AMINCIS' },
        },
        take: 3,
      });
      suggestions.push(
        ...thinLenses.map((p) => ({
          productId: p.id,
          nom: p.nom,
          raison: 'Verres amincis pour forte correction',
          confidence: 85,
          prix: p.prix,
          stock: p.stock,
        }))
      );
    }

    // Logique 2: Lentilles selon astigmatisme
    if (od.cyl !== 0 && og.cyl !== 0) {
      const toricLenses = await this.prisma.product.findMany({
        where: {
          type: 'LENTILLES',
          tags: { has: 'TORIQUE' },
        },
        take: 2,
      });
      suggestions.push(
        ...toricLenses.map((p) => ({
          productId: p.id,
          nom: p.nom,
          raison: 'Lentilles toriques (astigmatisme détecté)',
          confidence: 90,
          prix: p.prix,
          stock: p.stock,
        }))
      );
    }

    // Logique 3: Anti-UV/Blue-light si ajout
    if (od.add || og.add) {
      const specialGlasses = await this.prisma.product.findMany({
        where: {
          type: 'VERRES',
          tags: {
            hasSome: ['ANTIREFLET', 'BLUELIGHT'],
          },
        },
        take: 2,
      });
      suggestions.push(
        ...specialGlasses.map((p) => ({
          productId: p.id,
          nom: p.nom,
          raison: 'Protection anti-reflet/lumière bleue recommandée',
          confidence: 75,
          prix: p.prix,
          stock: p.stock,
        }))
      );
    }

    return suggestions;
  }

  private async suggestByHistory(clientId: string): Promise<ProductSuggestion[]> {
    // Récupérer fiches précédentes du client
    const previousFiches = await this.prisma.fiche.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    const suggestions: ProductSuggestion[] = [];
    const previousProducts = new Set();

    // Extraire produits utilisés précédemment
    previousFiches.forEach((fiche) => {
      const content = fiche.content as any;
      if (content.monture?.marque) previousProducts.add(content.monture.marque);
      if (content.verres?.marque) previousProducts.add(content.verres.marque);
    });

    // Suggérer mêmes marques (client fidèle)
    for (const marque of previousProducts) {
      const products = await this.prisma.product.findMany({
        where: { marque: String(marque) },
        take: 1,
      });
      suggestions.push(
        ...products.map((p) => ({
          productId: p.id,
          nom: p.nom,
          raison: `Client fidèle marque ${marque}`,
          confidence: 80,
          prix: p.prix,
          stock: p.stock,
        }))
      );
    }

    return suggestions;
  }

  private rankSuggestions(suggestions: ProductSuggestion[]): ProductSuggestion[] {
    return suggestions
      .filter((s) => s.stock > 0) // Only in stock
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5); // Top 5
  }
}
```

---

## 👓 ESSAYAGE VIRTUEL

### 4.1 Architecture

**Tech Stack**:
- Frontend: Three.js + WebGL
- Backend: Node.js avec processing 3D
- Models: Montures 3D (repository)

**Données Nécessaires**:
```typescript
interface MontureFaceData {
  id: string;
  nom: string;
  modelUrl: string; // S3 URL to 3D model
  formeFace: 'ROND' | 'CARRE' | 'OVALE' | 'LOSANGE' | 'CŒUR';
  largeur: number; // mm
  hauteur: number; // mm
  couleurs: string[]; // hex colors
  styles: string[]; // CLASSIQUE, SPORT, MODE, etc
}

interface VirtualTryOnRequest {
  montureId: string;
  photoSelfie: Buffer; // User's face photo
  faceAnalysis: FaceAnalysisResult; // From face detection
}
```

**Workflow**:
```
1. Upload selfie
        ↓
2. Face detection (landmarks: eyes, nose, face outline)
        ↓
3. Head rotation normalization
        ↓
4. Load 3D monture model
        ↓
5. Position monture sur face
        ↓
6. Render + display
        ↓
7. User can rotate/zoom
        ↓
8. Save as "favorite"
```

**Implementation**:
```typescript
// backend/src/features/virtual-try-on/vto.service.ts

import * as faceapi from '@vladmandic/face-api';

@Injectable()
export class VirtualTryOnService {
  async analyzeUserFace(photoBuffer: Buffer): Promise<FaceAnalysisResult> {
    // Load face detection model
    await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
    await faceapi.nets.faceLandmark68Net.loadFromUri('/models');

    // Detect face
    const img = await this.loadImage(photoBuffer);
    const detections = await faceapi
      .detectAllFaces(img, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks();

    if (!detections || detections.length === 0) {
      throw new Error('Aucun visage détecté');
    }

    const landmarks = detections[0].landmarks;

    // Extract key measurements
    return {
      eyeDistance: this.calculateDistance(
        landmarks.getLeftEye()[0], 
        landmarks.getRightEye()[0]
      ),
      faceWidth: this.calculateDistance(
        landmarks.getJawOutline()[0],
        landmarks.getJawOutline()[15]
      ),
      faceHeight: this.calculateDistance(
        landmarks.getJawOutline()[8],
        landmarks.getNose()[0]
      ),
      landmarks: landmarks.positions,
      headRotation: this.estimateHeadRotation(landmarks),
    };
  }

  /**
   * Recommander montures selon morphologie
   */
  async recommendMonturesByFace(
    faceAnalysis: FaceAnalysisResult,
  ): Promise<MontureFaceData[]> {
    // Determine face shape (OVAL, SQUARE, ROUND, etc)
    const faceShape = this.analyzeFaceShape(faceAnalysis);

    // Match montages to face shape
    const recommendations = await this.prisma.product.findMany({
      where: {
        type: 'MONTURES',
        formeFace: this.getRecommendedShapes(faceShape),
      },
      take: 6,
    });

    return recommendations.map(this.toMontureFaceData);
  }

  private analyzeFaceShape(analysis: FaceAnalysisResult): string {
    // Simple heuristic based on width/height ratio
    const ratio = analysis.faceWidth / analysis.faceHeight;

    if (ratio > 1.3) return 'CARRE';
    if (ratio > 1.1) return 'OVALE';
    if (ratio > 0.9 && ratio < 1.1) return 'ROND';
    return 'LOSANGE';
  }

  private getRecommendedShapes(shape: string): string[] {
    // Match recommendations
    const recommendations: { [key: string]: string[] } = {
      CARRE: ['ROND', 'OVALE'],       // Soften square faces
      OVALE: ['CARRE', 'GEOMETRIQUE'], // Accent oval faces
      ROND: ['CARRE', 'RECTANGULAIRE'], // Lengthen round faces
      LOSANGE: ['ROND', 'CARRE'],
    };
    return recommendations[shape] || ['OVALE'];
  }
}
```

**Frontend (Three.js)**:
```typescript
// frontend/src/app/features/vto/vto.component.ts

export class VTOComponent {
  @ViewChild('canvas') canvas!: ElementRef;

  private scene: THREE.Scene;
  private camera: THREE.Camera;
  private renderer: THREE.WebGLRenderer;
  private montureModel: THREE.Group;

  async loadMontureAndRender(montureId: string) {
    // 1. Load 3D model
    const model = await this.loadGLTF(`/models/montures/${montureId}.gltf`);

    // 2. Position on face
    this.positionMontureOnFace(model, this.faceAnalysis);

    // 3. Add to scene
    this.scene.add(model);

    // 4. Render
    this.animate();
  }

  private positionMontureOnFace(
    model: THREE.Group,
    faceAnalysis: FaceAnalysisResult,
  ) {
    // Position montage based on eye distance
    model.position.y = faceAnalysis.eyeDistance / 2;
    model.scale.set(
      faceAnalysis.eyeDistance / 100,
      faceAnalysis.eyeDistance / 100,
      faceAnalysis.eyeDistance / 100,
    );
  }

  saveFavorite() {
    // Screenshot + save
    const screenshot = this.renderer.domElement.toDataURL('image/png');
    this.vtoService.saveFavorite(this.montureId, screenshot);
  }
}
```

---

## 📐 FICHE MONTAGE/CENTRAGE VIRTUEL

### 5.1 Calcul Virtuel de Centrage

**Données d'Entrée**:
- Prescription (SPH, CYL, AXE)
- Dimension monture
- Écart pupillaire (EP)
- Distance P-V (vergence)

**Calculs**:
```typescript
interface CentringCalculation {
  verre_od: {
    diametre: number;
    epaisseur_centre: number;
    epaisseur_bord: number;
    poids: number;
  };
  verre_og: {
    diametre: number;
    epaisseur_centre: number;
    epaisseur_bord: number;
    poids: number;
  };
  positionnement: {
    hauteur: number;
    inclinaison: number; // degrees
    convergence: number;
  };
  avertissements: string[];
}

@Injectable()
export class CentringService {
  /**
   * Calculer centrage optimal selon prescription et monture
   */
  calculateCentring(
    prescription: {
      od: { sph: number; cyl: number; axe: number };
      og: { sph: number; cyl: number; axe: number };
    },
    montureSpecs: {
      largeur: number; // mm
      hauteur: number; // mm
      ecartInterne: number; // distance between lens centers
    },
    patient: { ep: number; distancePV: number },
  ): CentringCalculation {
    const calculation: CentringCalculation = {
      verre_od: this.calculateLensDimensions(prescription.od, montureSpecs),
      verre_og: this.calculateLensDimensions(prescription.og, montureSpecs),
      positionnement: this.calculatePositioning(patient, montureSpecs),
      avertissements: [],
    };

    // Validations
    if (prescription.od.sph > 6 || prescription.og.sph > 6) {
      calculation.avertissements.push(
        'Forte puissance: vérifier épaisseur verres'
      );
    }

    if (
      Math.abs(prescription.od.sph - prescription.og.sph) > 3
    ) {
      calculation.avertissements.push(
        'Écart sphère important OD/OG: centrage critique'
      );
    }

    return calculation;
  }

  private calculateLensDimensions(
    prescription: { sph: number; cyl: number; axe: number },
    montureSpecs: any,
  ) {
    // Formule: Épaisseur centre/bord selon Abbe et indice
    const indexVerre = 1.56; // standard CR39
    const aberrationAllowed = 0.5; // mm acceptable aberration

    const diametre = montureSpecs.largeur + 2; // Add 2mm margin
    const rayonCourbure = this.calculateRadius(prescription.sph, indexVerre);
    const epaisseurCentre = this.calculateCenterThickness(
      rayonCourbure,
      diametre,
      indexVerre,
    );
    const epaisseurBord = this.calculateEdgeThickness(
      rayonCourbure,
      diametre,
      indexVerre,
      prescription.cyl,
    );

    const poidsEstime = this.estimateWeight(
      diametre,
      epaisseurCentre,
      indexVerre,
    );

    return {
      diametre,
      epaisseur_centre: epaisseurCentre,
      epaisseur_bord: epaisseurBord,
      poids: poidsEstime,
    };
  }

  private calculateRadius(sph: number, indexVerre: number): number {
    // Ray Tracing formula: n = (R - t/2) / R
    // Simplified: R = 1000 / (2 * (n - 1) * sph)
    return 1000 / (2 * (indexVerre - 1) * sph);
  }

  private calculatePositioning(
    patient: { ep: number; distancePV: number },
    montureSpecs: any,
  ) {
    return {
      hauteur: montureSpecs.hauteur / 2 + 2, // Centered + 2mm above
      inclinaison: 10, // Typical pantoscopic tilt
      convergence: patient.ep - montureSpecs.ecartInterne,
    };
  }
}
```

**Rapport Virtuel**:
```json
{
  "fiche_id": "FICHE-2026-001",
  "date": "2026-04-19",
  "prescription": {
    "od": { "sph": "+2.50", "cyl": "-0.75", "axe": "180°" },
    "og": { "sph": "+1.50", "cyl": "-0.50", "axe": "175°" }
  },
  "centring_calculation": {
    "verre_od": {
      "diametre": "62mm",
      "epaisseur_centre": "2.1mm",
      "epaisseur_bord": "3.8mm",
      "poids": "12g"
    },
    "verre_og": {
      "diametre": "62mm",
      "epaisseur_centre": "1.8mm",
      "epaisseur_bord": "3.5mm",
      "poids": "11g"
    },
    "positionnement": {
      "hauteur": "33mm",
      "inclinaison": "10°",
      "convergence": "2mm"
    },
    "avertissements": []
  },
  "equipment_recommendations": [
    {
      "type": "Dégressif 4 zones",
      "raison": "Addition présente",
      "prix": "85 DH"
    }
  ]
}
```

---

## 📦 SUIVI BON DE COMMANDE

### 6.1 État Actuel (Basique)

```typescript
// État actuel - simplifié
followiBonCommande?: {
  fournisseur: string;
  referenceCommande: string;
  dateCommande?: string;
  dateLivraison?: string;
  statut?: string; // 'EN_ATTENTE' | 'EN_COURS' | 'LIVREE'
}
```

### 6.2 Améliorations Proposées

**Structure Enrichie**:
```typescript
interface BonCommandeAvance {
  // Identifiants
  id: string;
  numeroBC: string;
  fournisseur: {
    id: string;
    nom: string;
    contact: string;
    email: string;
    api?: string; // Tracking API if available
  };

  // Dates
  dateCommande: Date;
  dateLivraisonEstimee: Date;
  dateLivraison?: Date;

  // Contenu
  articles: Array<{
    productId: string;
    quantite: number;
    prixUnitaire: number;
    code_fournisseur: string;
  }>;

  // Suivi
  statut: 'DRAFT' | 'ENVOYEE' | 'CONFIRMEE' | 'EN_COURS' | 'PARTIELLEMENT_LIVREE' | 'LIVREE' | 'ANNULEE';
  progressionPhysique: number; // 0-100%

  // Tracking détaillé
  tracking: Array<{
    date: Date;
    statut: string;
    description: string;
    localisation?: string; // Si tracking géographique
    document?: string; // Photo, ticket, etc
  }>;

  // Gestion des retards
  alertes: Array<{
    type: 'RETARD' | 'MANQUANT' | 'ENDOMMAGE' | 'NON_CONFORMITE';
    date: Date;
    description: string;
    resolution?: string;
  }>;

  // Coûts
  montantHT: number;
  fraisPort: number;
  montantTTC: number;
  montantFacture?: number; // Si facture reçue

  // Réconciliation
  articleLivres: Array<{
    productId: string;
    quantiteLivree: number;
    quantiteRecue: number; // Peut différer si casse
    controlQualite: boolean;
  }>;

  notes: string;
}

@Injectable()
export class BonCommandeService {
  async createBC(data: {
    fichId: string;
    fournisseurId: string;
    articles: any[];
  }): Promise<BonCommande> {
    const bc = await this.prisma.bonCommande.create({
      data: {
        numero: this.generateBCNumber(),
        fiche: { connect: { id: data.fichId } },
        fournisseur: { connect: { id: data.fournisseurId } },
        statut: 'DRAFT',
        dateCommande: new Date(),
        articles: data.articles,
      },
    });

    // Audit
    await this.auditService.logAction('CREATE_BON_COMMANDE', {
      bcId: bc.id,
      numeroArticles: data.articles.length,
      montantTotal: data.articles.reduce((sum, a) => sum + a.total, 0),
    });

    return bc;
  }

  /**
   * Mettre à jour statut avec tracking
   */
  async updateTracking(
    bcId: string,
    update: {
      statut: string;
      description: string;
      localisation?: string;
      document?: Buffer; // Photo
    },
  ) {
    const bc = await this.prisma.bonCommande.findUnique({
      where: { id: bcId },
    });

    // Ajouter tracking
    const tracking = [
      ...(bc.tracking || []),
      {
        date: new Date(),
        statut: update.statut,
        description: update.description,
        localisation: update.localisation,
      },
    ];

    // Calculer progression
    const progression = this.calculateProgress(tracking);

    // Update
    const updated = await this.prisma.bonCommande.update({
      where: { id: bcId },
      data: {
        statut: update.statut,
        tracking,
        progressionPhysique: progression,
      },
    });

    // Notification if status changed
    if (bc.statut !== update.statut) {
      await this.notifyStatusChange(bc, updated);
    }

    return updated;
  }

  /**
   * Réconciliation livraison vs commande
   */
  async reconcileLivraison(
    bcId: string,
    articleLivres: Array<{
      productId: string;
      quantiteLivree: number;
      controlQualite: boolean;
      photos?: Buffer[];
    }>,
  ) {
    const bc = await this.prisma.bonCommande.findUnique({
      where: { id: bcId },
    });

    const alertes: any[] = [];

    // Comparer vs commande
    for (const livré of articleLivres) {
      const commande = bc.articles.find(
        (a) => a.productId === livré.productId
      );

      if (!commande) {
        alertes.push({
          type: 'MANQUANT',
          description: `Article ${livré.productId} livré mais non commandé`,
          date: new Date(),
        });
      }

      if (livré.quantiteLivree < commande.quantite) {
        alertes.push({
          type: 'MANQUANT',
          description: `Article ${livré.productId}: ${livré.quantiteLivree}/${commande.quantite}`,
          date: new Date(),
        });
      }
    }

    // Update
    return await this.prisma.bonCommande.update({
      where: { id: bcId },
      data: {
        statut: 'LIVREE',
        articleLivres,
        alertes: { set: alertes },
        dateLivraison: new Date(),
      },
    });
  }

  private calculateProgress(tracking: any[]): number {
    // Heuristique simple
    const statutProgression: { [key: string]: number } = {
      'ENVOYEE': 25,
      'EN_COURS': 50,
      'EN_LIVRAISON': 75,
      'PARTIELLEMENT_LIVREE': 90,
      'LIVREE': 100,
    };

    const lastStatus = tracking[tracking.length - 1]?.statut;
    return statutProgression[lastStatus] || 0;
  }
}
```

**Intégration API Fournisseurs**:
```typescript
// Exemple: Intégration API fournisseur pour tracking automatique

async integrateSupplierAPI(fournisseurId: string, numeroBC: string) {
  const supplier = await this.prisma.fournisseur.findUnique({
    where: { id: fournisseurId },
  });

  if (!supplier.api) return; // Skip if no API

  try {
    // Call supplier API
    const response = await axios.get(
      `${supplier.api.endpoint}/orders/${numeroBC}`,
      {
        headers: { 'Authorization': `Bearer ${supplier.api.token}` },
      }
    );

    // Extract tracking info
    const tracking = {
      date: new Date(),
      statut: this.mapSupplierStatus(response.data.status),
      description: response.data.tracking_message,
      localisation: response.data.location,
    };

    // Auto-update
    await this.updateTracking(numeroBC, tracking);
  } catch (e) {
    console.error('Supplier API error:', e);
  }
}

private mapSupplierStatus(supplierStatus: string): string {
  const mapping: { [key: string]: string } = {
    'PENDING': 'EN_ATTENTE',
    'PROCESSING': 'EN_COURS',
    'SHIPPED': 'EN_LIVRAISON',
    'DELIVERED': 'LIVREE',
  };
  return mapping[supplierStatus] || supplierStatus;
}
```

---

## 🏗️ ARCHITECTURE TECHNIQUE

### 7.1 Structure Dossiers

```
backend/
├── src/
│   └── features/
│       ├── ocr/
│       │   ├── ocr.service.ts          # OCR Ordonnance/Facture
│       │   ├── injection.service.ts    # Injection données
│       │   ├── ocr.controller.ts
│       │   └── ocr.module.ts
│       │
│       ├── ai-suggestions/
│       │   ├── suggestions.service.ts  # IA recommandations
│       │   ├── suggestions.controller.ts
│       │   └── ai-suggestion.module.ts
│       │
│       ├── virtual-try-on/
│       │   ├── vto.service.ts          # Virtual Try-On
│       │   ├── vto.controller.ts
│       │   └── vto.module.ts
│       │
│       ├── centring/
│       │   ├── centring.service.ts     # Calcul montage
│       │   ├── centring.controller.ts
│       │   └── centring.module.ts
│       │
│       └── bon-commande/
│           ├── bc.service.ts           # Suivi BC avancé
│           ├── bc-tracking.service.ts
│           ├── bc.controller.ts
│           └── bc.module.ts

frontend/
├── src/app/
│   └── features/
│       ├── ocr-upload/
│       ├── virtual-try-on/
│       └── bon-commande-tracking/

models/
├── montures/                           # 3D models
│   ├── marque1_model1.gltf
│   └── ...
└── faces/                              # Face detection models
    ├── face-detection.model
    └── landmarks.model
```

### 7.2 Dépendances

```bash
# OCR
npm install tesseract.js sharp

# Face Detection & Virtual Try-On
npm install @vladmandic/face-api three gltf-loader

# IA/ML
npm install tensorflow @tensorflow/tfjs-node

# Document Processing
npm install pdf-parse pdfkit

# Payment/Tracking
npm install axios # For supplier APIs
```

---

## 📊 ROADMAP IMPLÉMENTATION

### Phase 1 (Mois 1-2) - OCR & Injection
- [ ] OCR Ordonnance (Tesseract)
- [ ] OCR Facture (Tesseract)
- [ ] Injection semi-auto (confirmation requise)
- [ ] Validation données

### Phase 2 (Mois 2-3) - IA & Suggestions
- [ ] Logique suggestions basées prescription
- [ ] Logique suggestions basées historique
- [ ] Ranking & scoring

### Phase 3 (Mois 3-4) - Virtual Try-On
- [ ] Face detection
- [ ] 3D model loading
- [ ] Montage positioning
- [ ] Frontend Three.js

### Phase 4 (Mois 4-5) - Centring Virtuel
- [ ] Calcul centrage
- [ ] Rapport généré
- [ ] Visualisation

### Phase 5 (Mois 5-6) - Suivi BC Avancé
- [ ] Tracking enrichi
- [ ] Intégration APIs fournisseurs
- [ ] Réconciliation livraison

---

**Status**: 🔴 **ANALYSE COMPLÈTE - À IMPLÉMENTER**

*Généré par: Copilot AI - Analyse Métier Optique Avancée*  
*Date: 2026-04-19*
