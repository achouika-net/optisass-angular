# Spécification Technique - Architecture OCR

> **Version:** 1.1
> **Date:** 2026-01-14
> **Statut:** Validé
> **Module:** Core OCR

---

## Table des matières

1. [Objectif](#1-objectif)
2. [Principes d'architecture](#2-principes-darchitecture)
3. [Structure des fichiers](#3-structure-des-fichiers)
4. [Interfaces (Contrats)](#4-interfaces-contrats)
5. [Providers (Implémentations)](#5-providers-implémentations)
6. [Service OCR (Point d'entrée)](#6-service-ocr-point-dentrée)
7. [Configuration](#7-configuration)
8. [Architecture Backend (NestJS)](#8-architecture-backend-nestjs)
9. [Parsers par feature](#9-parsers-par-feature)
10. [Gestion des erreurs](#10-gestion-des-erreurs)
11. [Tests](#11-tests)
12. [Implémentation](#12-implémentation)
13. [Évolutions futures](#13-évolutions-futures)

---

## 1. Objectif

### 1.1 But principal

Fournir une couche OCR **isolée** et **extensible** permettant :

- Extraction de texte depuis images (factures, ordonnances, cartes mutuelle...)
- Changement de provider OCR sans impact sur les features
- Configuration flexible par environnement et type de document

### 1.2 Cas d'usage identifiés

| Feature     | Type de document       | Données extraites                  |
| ----------- | ---------------------- | ---------------------------------- |
| Stock Entry | Facture/BL fournisseur | Produits, quantités, prix          |
| Client      | Ordonnance médicale    | Prescription, corrections optiques |
| Client      | Carte mutuelle         | Numéro, plafonds, dates            |
| Finance     | Facture fournisseur    | Montants, TVA, échéances           |

### 1.3 Principes directeurs

| Principe                  | Description                                                        |
| ------------------------- | ------------------------------------------------------------------ |
| **Isolation totale**      | Les features ne connaissent jamais le provider utilisé             |
| **Single Responsibility** | OCR = extraction texte, Parser = interprétation métier             |
| **Open/Closed**           | Ouvert à l'extension (nouveaux providers), fermé à la modification |
| **Dependency Inversion**  | Features dépendent d'interfaces, pas d'implémentations             |

---

## 2. Principes d'architecture

### 2.1 Vocabulaire

| Terme technique | Notre nom | Rôle                                           |
| --------------- | --------- | ---------------------------------------------- |
| Port            | Interface | Contrat standard (ce que doit faire un OCR)    |
| Adapter         | Provider  | Implémentation concrète (Tesseract, OpenAI...) |
| Facade          | Service   | Point d'entrée unique pour les features        |

### 2.2 Schéma d'architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              FEATURES                                    │
│                                                                          │
│  ┌───────────────────┐  ┌───────────────────┐  ┌───────────────────┐   │
│  │    Stock Entry    │  │      Client       │  │      Finance      │   │
│  │                   │  │                   │  │                   │   │
│  │ InvoiceParser     │  │ PrescriptionParser│  │ SupplierInvoice   │   │
│  │ Service           │  │ MutuelleParser    │  │ Parser            │   │
│  └─────────┬─────────┘  └─────────┬─────────┘  └─────────┬─────────┘   │
│            │                      │                      │              │
│            └──────────────────────┼──────────────────────┘              │
│                                   │                                      │
│                       ┌───────────▼───────────┐                         │
│                       │  IDocumentParser<T>   │  ← Interface            │
│                       │  (abstract class)     │                         │
│                       └───────────────────────┘                         │
│                                                                          │
└──────────────────────────────────┬──────────────────────────────────────┘
                                   │
                    ═══════════════╪═══════════════  ISOLATION
                                   │
┌──────────────────────────────────┴──────────────────────────────────────┐
│                              CORE/OCR                                    │
│                                                                          │
│                       ┌───────────────────────┐                         │
│                       │      OcrService       │  ← Point d'entrée       │
│                       │                       │                         │
│                       │  • process()          │                         │
│                       │  • isProcessing       │                         │
│                       │  • lastError          │                         │
│                       │  • getProviders()     │                         │
│                       └───────────┬───────────┘                         │
│                                   │                                      │
│                       ┌───────────▼───────────┐                         │
│                       │     IOcrEngine        │  ← Interface            │
│                       │                       │                         │
│                       │  • process()          │                         │
│                       │  • name               │                         │
│                       │  • isAvailable        │                         │
│                       └───────────┬───────────┘                         │
│                                   │                                      │
│            ┌──────────────────────┼──────────────────────┐              │
│            │                      │                      │              │
│   ┌────────▼────────┐   ┌────────▼────────┐   ┌────────▼────────┐     │
│   │   Tesseract     │   │   OpenAI        │   │   Google        │     │
│   │   Provider      │   │   Vision        │   │   Vision        │     │
│   │                 │   │   Provider      │   │   Provider      │     │
│   │  (Front-end)    │   │  (Backend)      │   │  (Backend)      │     │
│   │   Gratuit       │   │   Payant        │   │   Payant        │     │
│   └─────────────────┘   └─────────────────┘   └─────────────────┘     │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### 2.3 Flux de données

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Image   │────▶│  Parser  │────▶│   OCR    │────▶│ Provider │
│  (File)  │     │ (Feature)│     │ Service  │     │(Tesseract)│
└──────────┘     └──────────┘     └──────────┘     └──────────┘
                       │                                 │
                       │                                 │
                       ▼                                 ▼
                ┌──────────┐                      ┌──────────┐
                │  Données │◀─────────────────────│  Texte   │
                │  Métier  │     (extraction)     │   Brut   │
                └──────────┘                      └──────────┘
```

---

## 3. Structure des fichiers

```
src/app/core/ocr/
│
├── interfaces/
│   ├── ocr-engine.interface.ts         # IOcrEngine, IOcrResult
│   ├── ocr-options.interface.ts        # IOcrOptions
│   └── document-parser.interface.ts    # IDocumentParser<T>
│
├── providers/
│   ├── tesseract.provider.ts           # TesseractProvider
│   ├── openai-vision.provider.ts       # OpenAiVisionProvider
│   └── google-vision.provider.ts       # GoogleVisionProvider
│
├── ocr.service.ts                      # OcrService (point d'entrée)
├── ocr.config.ts                       # IOcrConfig, OCR_CONFIG token
├── ocr.models.ts                       # Types et enums partagés
└── ocr.providers.ts                    # provideOcr() function
```

---

## 4. Interfaces (Contrats)

### 4.1 IOcrEngine

Interface que tous les providers doivent implémenter.

```typescript
// core/ocr/interfaces/ocr-engine.interface.ts

/**
 * Résultat d'extraction OCR.
 */
export interface IOcrResult {
  /** Texte brut extrait de l'image */
  rawText: string;

  /** Score de confiance global (0-1) */
  confidence: number;

  /** Blocs de texte avec métadonnées */
  blocks: IOcrBlock[];

  /** Nom du provider utilisé */
  provider: string;

  /** Temps de traitement en millisecondes */
  processingTime: number;
}

/**
 * Bloc de texte individuel avec position.
 */
export interface IOcrBlock {
  /** Texte du bloc */
  text: string;

  /** Score de confiance du bloc (0-1) */
  confidence: number;

  /** Position dans l'image (peut être null selon provider) */
  boundingBox: IOcrBoundingBox | null;
}

/**
 * Coordonnées d'un bloc dans l'image.
 */
export interface IOcrBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Interface que tous les providers OCR doivent implémenter.
 */
export interface IOcrEngine {
  /** Nom unique du provider */
  readonly name: string;

  /** Indique si le provider est disponible (clé API présente, etc.) */
  readonly isAvailable: boolean;

  /**
   * Traite une image et extrait le texte.
   * @param image Fichier image à traiter
   * @param options Options de traitement
   * @returns Résultat OCR
   */
  process(image: File, options?: IOcrOptions): Promise<IOcrResult>;

  /**
   * Libère les ressources (worker, etc.)
   */
  dispose?(): Promise<void>;
}
```

### 4.2 IOcrOptions

Options de configuration par appel.

```typescript
// core/ocr/interfaces/ocr-options.interface.ts

/**
 * Options pour le traitement OCR.
 */
export interface IOcrOptions {
  /** Langue du document ('fra', 'eng', etc.) */
  language?: string;

  /** Type de document pour sélection provider spécifique */
  documentType?: OcrDocumentType;

  /** Activer le prétraitement d'image (contraste, binarisation) */
  enhanceImage?: boolean;

  /** Timeout en millisecondes */
  timeout?: number;
}

/**
 * Types de documents supportés.
 * Utilisé pour sélectionner le provider optimal.
 */
export type OcrDocumentType =
  | 'invoice' // Facture fournisseur
  | 'delivery_note' // Bon de livraison
  | 'prescription' // Ordonnance médicale
  | 'insurance_card' // Carte mutuelle
  | 'generic'; // Document générique
```

### 4.3 IDocumentParser

Interface pour les parsers spécifiques aux features.

````typescript
// core/ocr/interfaces/document-parser.interface.ts

import { inject } from '@angular/core';
import { OcrService } from '../ocr.service';
import { IOcrOptions, OcrDocumentType } from './ocr-options.interface';

/**
 * Résultat de parsing d'un document.
 */
export interface IParseResult<T> {
  /** Données structurées extraites */
  data: T;

  /** Score de confiance global (0-1) */
  confidence: number;

  /** Avertissements (champs avec faible confiance) */
  warnings: string[];

  /** Temps total de traitement en millisecondes */
  processingTime: number;
}

/**
 * Résultat de validation.
 */
export interface IValidationResult {
  /** Indique si les données sont valides */
  isValid: boolean;

  /** Liste des erreurs de validation */
  errors: IValidationError[];
}

/**
 * Erreur de validation individuelle.
 */
export interface IValidationError {
  /** Chemin du champ en erreur */
  field: string;

  /** Message d'erreur */
  message: string;
}

/**
 * Classe abstraite pour les parsers de documents.
 * Chaque feature implémente son propre parser.
 *
 * @example
 * ```typescript
 * @Injectable({ providedIn: 'root' })
 * export class InvoiceParserService extends DocumentParser<IStockEntryProduct[]> {
 *   readonly documentType = 'invoice';
 *
 *   protected extractData(rawText: string, blocks: IOcrBlock[]): IStockEntryProduct[] {
 *     // Logique d'extraction spécifique aux factures
 *   }
 *
 *   validate(data: IStockEntryProduct[]): IValidationResult {
 *     // Logique de validation
 *   }
 * }
 * ```
 */
export abstract class DocumentParser<T> {
  protected readonly ocrService = inject(OcrService);

  /** Type de document pour sélection provider */
  abstract readonly documentType: OcrDocumentType;

  /**
   * Parse un document et retourne les données structurées.
   * @param file Fichier image à parser
   * @returns Résultat avec données structurées
   */
  async parse(file: File): Promise<IParseResult<T>> {
    const startTime = performance.now();

    const ocrResult = await this.ocrService.process(file, {
      documentType: this.documentType,
      language: 'fra',
    });

    const data = this.extractData(ocrResult.rawText, ocrResult.blocks);
    const warnings = this.detectWarnings(ocrResult);

    return {
      data,
      confidence: ocrResult.confidence,
      warnings,
      processingTime: performance.now() - startTime,
    };
  }

  /**
   * Extrait les données métier du texte OCR.
   * À implémenter par chaque parser.
   */
  protected abstract extractData(rawText: string, blocks: IOcrBlock[]): T;

  /**
   * Valide les données extraites.
   * À implémenter par chaque parser.
   */
  abstract validate(data: T): IValidationResult;

  /**
   * Détecte les champs avec faible confiance.
   */
  protected detectWarnings(ocrResult: IOcrResult): string[] {
    const warnings: string[] = [];

    ocrResult.blocks
      .filter((block) => block.confidence < 0.8)
      .forEach((block) => {
        warnings.push(`Texte incertain: "${block.text.substring(0, 50)}..."`);
      });

    return warnings;
  }
}
````

---

## 5. Providers (Implémentations)

### 5.1 TesseractProvider

Provider gratuit, exécution côté front-end.

```typescript
// core/ocr/providers/tesseract.provider.ts

import { Injectable, inject, OnDestroy } from '@angular/core';
import { createWorker, Worker } from 'tesseract.js';
import { IOcrEngine, IOcrResult, IOcrBlock } from '../interfaces/ocr-engine.interface';
import { IOcrOptions } from '../interfaces/ocr-options.interface';
import { OCR_CONFIG, IOcrConfig } from '../ocr.config';

@Injectable()
export class TesseractProvider implements IOcrEngine, OnDestroy {
  readonly name = 'tesseract';

  readonly #config = inject(OCR_CONFIG);
  #worker: Worker | null = null;
  #currentLanguage: string | null = null;

  get isAvailable(): boolean {
    // Toujours disponible (front-end, pas de clé API)
    return true;
  }

  /**
   * Traite une image avec Tesseract.js.
   */
  async process(image: File, options?: IOcrOptions): Promise<IOcrResult> {
    const startTime = performance.now();
    const language = options?.language ?? 'fra';

    try {
      const worker = await this.#getOrCreateWorker(language);
      const { data } = await worker.recognize(image);

      return {
        rawText: data.text,
        confidence: data.confidence / 100,
        blocks: this.#mapBlocks(data.blocks),
        provider: this.name,
        processingTime: performance.now() - startTime,
      };
    } catch (error) {
      throw new Error(
        `Tesseract OCR failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Libère le worker Tesseract.
   */
  async dispose(): Promise<void> {
    if (this.#worker) {
      await this.#worker.terminate();
      this.#worker = null;
      this.#currentLanguage = null;
    }
  }

  ngOnDestroy(): void {
    this.dispose();
  }

  /**
   * Récupère ou crée un worker pour la langue spécifiée.
   */
  async #getOrCreateWorker(language: string): Promise<Worker> {
    // Recréer le worker si la langue change
    if (this.#worker && this.#currentLanguage !== language) {
      await this.dispose();
    }

    if (!this.#worker) {
      this.#worker = await createWorker(language);
      this.#currentLanguage = language;
    }

    return this.#worker;
  }

  /**
   * Convertit les blocs Tesseract vers notre format.
   */
  #mapBlocks(blocks: Tesseract.Block[] | null): IOcrBlock[] {
    if (!blocks) return [];

    return blocks.map((block) => ({
      text: block.text,
      confidence: block.confidence / 100,
      boundingBox: block.bbox
        ? {
            x: block.bbox.x0,
            y: block.bbox.y0,
            width: block.bbox.x1 - block.bbox.x0,
            height: block.bbox.y1 - block.bbox.y0,
          }
        : null,
    }));
  }
}
```

### 5.2 OpenAiVisionProvider

Provider payant, haute précision pour documents structurés.

```typescript
// core/ocr/providers/openai-vision.provider.ts

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { IOcrEngine, IOcrResult } from '../interfaces/ocr-engine.interface';
import { IOcrOptions } from '../interfaces/ocr-options.interface';
import { OCR_CONFIG, IOcrConfig } from '../ocr.config';

interface OpenAiResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

@Injectable()
export class OpenAiVisionProvider implements IOcrEngine {
  readonly name = 'openai-vision';

  readonly #config = inject(OCR_CONFIG);
  readonly #http = inject(HttpClient);

  get isAvailable(): boolean {
    return this.#config.openaiKey !== null;
  }

  /**
   * Traite une image avec OpenAI Vision.
   */
  async process(image: File, options?: IOcrOptions): Promise<IOcrResult> {
    if (!this.#config.openaiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const startTime = performance.now();

    try {
      const base64 = await this.#fileToBase64(image);

      const response = await firstValueFrom(
        this.#http.post<OpenAiResponse>(
          'https://api.openai.com/v1/chat/completions',
          {
            model: 'gpt-4o',
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'text',
                    text: this.#getPrompt(options?.documentType),
                  },
                  {
                    type: 'image_url',
                    image_url: {
                      url: `data:${image.type};base64,${base64}`,
                    },
                  },
                ],
              },
            ],
            max_tokens: 4096,
          },
          {
            headers: {
              Authorization: `Bearer ${this.#config.openaiKey}`,
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      const rawText = response.choices[0]?.message?.content ?? '';

      return {
        rawText,
        confidence: 0.95, // OpenAI ne fournit pas de score de confiance
        blocks: [], // OpenAI ne fournit pas de positions
        provider: this.name,
        processingTime: performance.now() - startTime,
      };
    } catch (error) {
      throw new Error(
        `OpenAI Vision failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Génère le prompt selon le type de document.
   */
  #getPrompt(documentType?: string): string {
    switch (documentType) {
      case 'invoice':
        return `Extract all text from this invoice.
                Return the raw text preserving the structure.
                Include: supplier name, invoice number, date, products with quantities and prices.`;

      case 'prescription':
        return `Extract all text from this medical prescription.
                Return the raw text preserving the structure.
                Include: doctor info, patient info, prescriptions with dosages.`;

      case 'insurance_card':
        return `Extract all text from this insurance/mutual card.
                Return the raw text.
                Include: member number, coverage dates, plan details.`;

      default:
        return 'Extract all text from this document. Return only the raw text.';
    }
  }

  /**
   * Convertit un File en base64.
   */
  #fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
}
```

### 5.3 BackendOcrProvider

Provider qui délègue le traitement OCR au backend NestJS.

```typescript
// core/ocr/providers/backend-ocr.provider.ts

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { IOcrEngine, IOcrResult } from '../interfaces/ocr-engine.interface';
import { IOcrOptions } from '../interfaces/ocr-options.interface';
import { OCR_CONFIG } from '../ocr.config';

/**
 * Réponse du backend OCR.
 * Même structure que IOcrResult pour cohérence.
 */
interface IBackendOcrResponse {
  rawText: string;
  confidence: number;
  blocks: Array<{
    text: string;
    confidence: number;
    boundingBox: { x: number; y: number; width: number; height: number } | null;
  }>;
  provider: string;
  processingTime: number;
}

@Injectable()
export class BackendOcrProvider implements IOcrEngine {
  readonly name = 'backend';

  readonly #config = inject(OCR_CONFIG);
  readonly #http = inject(HttpClient);

  get isAvailable(): boolean {
    return this.#config.backendOcrUrl !== null;
  }

  /**
   * Envoie l'image au backend pour traitement OCR.
   */
  async process(image: File, options?: IOcrOptions): Promise<IOcrResult> {
    if (!this.#config.backendOcrUrl) {
      throw new Error('Backend OCR URL not configured');
    }

    const startTime = performance.now();

    try {
      const formData = new FormData();
      formData.append('image', image);

      if (options?.language) {
        formData.append('language', options.language);
      }
      if (options?.documentType) {
        formData.append('documentType', options.documentType);
      }
      if (options?.enhanceImage !== undefined) {
        formData.append('enhanceImage', String(options.enhanceImage));
      }

      const response = await firstValueFrom(
        this.#http.post<IBackendOcrResponse>(this.#config.backendOcrUrl, formData),
      );

      return {
        rawText: response.rawText,
        confidence: response.confidence,
        blocks: response.blocks,
        provider: `backend:${response.provider}`, // Ex: "backend:tesseract"
        processingTime: performance.now() - startTime,
      };
    } catch (error) {
      throw new Error(
        `Backend OCR failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}
```

### 5.4 GoogleVisionProvider

Provider payant, bon rapport qualité/prix.

```typescript
// core/ocr/providers/google-vision.provider.ts

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { IOcrEngine, IOcrResult, IOcrBlock } from '../interfaces/ocr-engine.interface';
import { IOcrOptions } from '../interfaces/ocr-options.interface';
import { OCR_CONFIG } from '../ocr.config';

interface GoogleVisionResponse {
  responses: Array<{
    fullTextAnnotation?: {
      text: string;
    };
    textAnnotations?: Array<{
      description: string;
      boundingPoly?: {
        vertices: Array<{ x: number; y: number }>;
      };
    }>;
  }>;
}

@Injectable()
export class GoogleVisionProvider implements IOcrEngine {
  readonly name = 'google-vision';

  readonly #config = inject(OCR_CONFIG);
  readonly #http = inject(HttpClient);

  get isAvailable(): boolean {
    return this.#config.googleVisionKey !== null;
  }

  /**
   * Traite une image avec Google Vision.
   */
  async process(image: File, options?: IOcrOptions): Promise<IOcrResult> {
    if (!this.#config.googleVisionKey) {
      throw new Error('Google Vision API key not configured');
    }

    const startTime = performance.now();

    try {
      const base64 = await this.#fileToBase64(image);

      const response = await firstValueFrom(
        this.#http.post<GoogleVisionResponse>(
          `https://vision.googleapis.com/v1/images:annotate?key=${this.#config.googleVisionKey}`,
          {
            requests: [
              {
                image: { content: base64 },
                features: [{ type: 'TEXT_DETECTION' }],
                imageContext: {
                  languageHints: [options?.language ?? 'fr'],
                },
              },
            ],
          },
        ),
      );

      const result = response.responses[0];
      const rawText = result?.fullTextAnnotation?.text ?? '';
      const blocks = this.#mapBlocks(result?.textAnnotations ?? []);

      return {
        rawText,
        confidence: 0.9, // Google ne fournit pas toujours de score global
        blocks,
        provider: this.name,
        processingTime: performance.now() - startTime,
      };
    } catch (error) {
      throw new Error(
        `Google Vision failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Convertit les annotations Google vers notre format.
   */
  #mapBlocks(annotations: GoogleVisionResponse['responses'][0]['textAnnotations']): IOcrBlock[] {
    if (!annotations || annotations.length === 0) return [];

    // Skip first annotation (full text)
    return annotations.slice(1).map((annotation) => {
      const vertices = annotation.boundingPoly?.vertices ?? [];
      const x = Math.min(...vertices.map((v) => v.x ?? 0));
      const y = Math.min(...vertices.map((v) => v.y ?? 0));
      const maxX = Math.max(...vertices.map((v) => v.x ?? 0));
      const maxY = Math.max(...vertices.map((v) => v.y ?? 0));

      return {
        text: annotation.description,
        confidence: 0.9,
        boundingBox:
          vertices.length > 0
            ? {
                x,
                y,
                width: maxX - x,
                height: maxY - y,
              }
            : null,
      };
    });
  }

  /**
   * Convertit un File en base64.
   */
  #fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
}
```

---

## 6. Service OCR (Point d'entrée)

### 6.1 OcrService

````typescript
// core/ocr/ocr.service.ts

import { Injectable, inject, signal } from '@angular/core';
import { IOcrEngine, IOcrResult } from './interfaces/ocr-engine.interface';
import { IOcrOptions } from './interfaces/ocr-options.interface';
import { OCR_CONFIG, IOcrConfig } from './ocr.config';
import { TesseractProvider } from './providers/tesseract.provider';
import { OpenAiVisionProvider } from './providers/openai-vision.provider';
import { GoogleVisionProvider } from './providers/google-vision.provider';

/**
 * Service OCR principal.
 * Point d'entrée unique pour toutes les opérations OCR.
 *
 * @example
 * ```typescript
 * const result = await this.ocrService.process(imageFile, {
 *   documentType: 'invoice',
 *   language: 'fra'
 * });
 * console.log(result.rawText);
 * ```
 */
@Injectable({ providedIn: 'root' })
export class OcrService {
  readonly #config = inject(OCR_CONFIG);
  readonly #providers = new Map<string, IOcrEngine>();

  // État observable
  readonly isProcessing = signal(false);
  readonly lastError = signal<string | null>(null);
  readonly lastResult = signal<IOcrResult | null>(null);

  constructor() {
    this.#registerProviders();
  }

  /**
   * Traite une image avec l'OCR configuré.
   *
   * @param image Fichier image à traiter
   * @param options Options de traitement
   * @returns Résultat OCR
   * @throws Error si le traitement échoue
   */
  async process(image: File, options?: IOcrOptions): Promise<IOcrResult> {
    this.isProcessing.set(true);
    this.lastError.set(null);

    try {
      // Validation image
      this.#validateImage(image);

      // Sélection du provider
      const providerName = this.#resolveProvider(options?.documentType);
      const provider = this.#providers.get(providerName);

      if (!provider) {
        throw new Error(`Provider "${providerName}" not found`);
      }

      if (!provider.isAvailable) {
        throw new Error(`Provider "${providerName}" is not available`);
      }

      // Traitement avec timeout
      const result = await this.#processWithTimeout(provider, image, options);

      // Fallback si confiance trop basse
      if (this.#shouldFallback(result)) {
        const fallbackResult = await this.#tryFallback(image, options);
        if (fallbackResult && fallbackResult.confidence > result.confidence) {
          this.lastResult.set(fallbackResult);
          return fallbackResult;
        }
      }

      this.lastResult.set(result);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'OCR processing failed';
      this.lastError.set(message);
      throw error;
    } finally {
      this.isProcessing.set(false);
    }
  }

  /**
   * Retourne la liste des providers disponibles.
   */
  getAvailableProviders(): string[] {
    return Array.from(this.#providers.entries())
      .filter(([_, provider]) => provider.isAvailable)
      .map(([name]) => name);
  }

  /**
   * Retourne le provider par défaut configuré.
   */
  getDefaultProvider(): string {
    return this.#config.defaultProvider;
  }

  /**
   * Enregistre tous les providers.
   */
  #registerProviders(): void {
    // Tesseract (toujours disponible)
    const tesseract = inject(TesseractProvider);
    this.#providers.set(tesseract.name, tesseract);

    // OpenAI Vision (si clé configurée)
    if (this.#config.openaiKey) {
      const openai = inject(OpenAiVisionProvider);
      this.#providers.set(openai.name, openai);
    }

    // Google Vision (si clé configurée)
    if (this.#config.googleVisionKey) {
      const google = inject(GoogleVisionProvider);
      this.#providers.set(google.name, google);
    }
  }

  /**
   * Résout le provider à utiliser.
   */
  #resolveProvider(documentType?: string): string {
    // Override par type de document
    if (documentType && this.#config.overrides[documentType]) {
      const override = this.#config.overrides[documentType];
      const provider = this.#providers.get(override);
      if (provider?.isAvailable) {
        return override;
      }
    }

    // Provider par défaut
    return this.#config.defaultProvider;
  }

  /**
   * Vérifie si un fallback est nécessaire.
   */
  #shouldFallback(result: IOcrResult): boolean {
    return (
      result.confidence < this.#config.minConfidence &&
      this.#config.fallbackProvider !== null &&
      this.#config.fallbackProvider !== result.provider
    );
  }

  /**
   * Tente le fallback avec le provider secondaire.
   */
  async #tryFallback(image: File, options?: IOcrOptions): Promise<IOcrResult | null> {
    const fallbackName = this.#config.fallbackProvider;
    if (!fallbackName) return null;

    const fallback = this.#providers.get(fallbackName);
    if (!fallback?.isAvailable) return null;

    try {
      return await fallback.process(image, options);
    } catch {
      return null;
    }
  }

  /**
   * Traite avec timeout.
   */
  async #processWithTimeout(
    provider: IOcrEngine,
    image: File,
    options?: IOcrOptions,
  ): Promise<IOcrResult> {
    const timeout = options?.timeout ?? 30000;

    return Promise.race([
      provider.process(image, options),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('OCR timeout')), timeout),
      ),
    ]);
  }

  /**
   * Valide le fichier image.
   */
  #validateImage(file: File): void {
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/tiff'];

    if (!validTypes.includes(file.type)) {
      throw new Error(`Invalid image type: ${file.type}`);
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      throw new Error('Image too large (max 10MB)');
    }
  }
}
````

---

## 7. Configuration

### 7.1 Tokens et interface

```typescript
// core/ocr/ocr.config.ts

import { InjectionToken } from '@angular/core';
import { OcrDocumentType } from './interfaces/ocr-options.interface';

/**
 * Configuration OCR.
 */
export interface IOcrConfig {
  /** Provider par défaut ('tesseract', 'openai-vision', 'google-vision', 'backend') */
  defaultProvider: string;

  /** Provider de fallback si confiance basse */
  fallbackProvider: string | null;

  /** Seuil de confiance minimum (0-1) */
  minConfidence: number;

  /** Override provider par type de document */
  overrides: Partial<Record<OcrDocumentType, string>>;

  /** URL du backend OCR (pour BackendOcrProvider) */
  backendOcrUrl: string | null;

  /** Clé API OpenAI */
  openaiKey: string | null;

  /** Clé API Google Vision */
  googleVisionKey: string | null;

  /** Clé API Azure */
  azureKey: string | null;
}

/**
 * Token d'injection pour la configuration OCR.
 */
export const OCR_CONFIG = new InjectionToken<IOcrConfig>('OCR_CONFIG');

/**
 * Configuration par défaut.
 */
export const DEFAULT_OCR_CONFIG: IOcrConfig = {
  defaultProvider: 'tesseract',
  fallbackProvider: null,
  minConfidence: 0.7,
  overrides: {},
  backendOcrUrl: null,
  openaiKey: null,
  googleVisionKey: null,
  azureKey: null,
};
```

### 7.2 Provider Angular

````typescript
// core/ocr/ocr.providers.ts

import { Provider, EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { environment } from '@env/environment';
import { OCR_CONFIG, DEFAULT_OCR_CONFIG, IOcrConfig } from './ocr.config';
import { OcrService } from './ocr.service';
import { TesseractProvider } from './providers/tesseract.provider';
import { OpenAiVisionProvider } from './providers/openai-vision.provider';
import { GoogleVisionProvider } from './providers/google-vision.provider';
import { BackendOcrProvider } from './providers/backend-ocr.provider';

/**
 * Configure le module OCR.
 *
 * @example
 * ```typescript
 * // app.config.ts
 * export const appConfig: ApplicationConfig = {
 *   providers: [
 *     provideOcr(),
 *   ]
 * };
 * ```
 */
export function provideOcr(config?: Partial<IOcrConfig>): EnvironmentProviders {
  const mergedConfig: IOcrConfig = {
    ...DEFAULT_OCR_CONFIG,
    ...environment.ocr,
    ...config,
  };

  return makeEnvironmentProviders([
    { provide: OCR_CONFIG, useValue: mergedConfig },
    OcrService,
    TesseractProvider,
    OpenAiVisionProvider,
    GoogleVisionProvider,
    BackendOcrProvider,
  ]);
}
````

### 7.3 Configuration environment

```typescript
// environments/environment.ts (Développement - OCR front-end)
export const environment = {
  production: false,
  // ...
  ocr: {
    defaultProvider: 'tesseract', // Front-end, gratuit
    fallbackProvider: null,
    minConfidence: 0.7,
    overrides: {},
    backendOcrUrl: null, // Pas de backend en dev
    openaiKey: null,
    googleVisionKey: null,
    azureKey: null,
  },
};

// environments/environment.prod.ts (Production - OCR backend)
export const environment = {
  production: true,
  // ...
  ocr: {
    defaultProvider: 'backend', // Délègue au backend
    fallbackProvider: 'tesseract', // Fallback front si backend down
    minConfidence: 0.8,
    overrides: {
      prescription: 'backend', // Haute précision pour ordonnances
    },
    backendOcrUrl: '/api/ocr/process', // URL du backend OCR
    openaiKey: null, // Clés gérées côté backend
    googleVisionKey: null,
    azureKey: null,
  },
};
```

---

## 8. Architecture Backend (NestJS)

> **Principe clé :** Le backend utilise la **même architecture** et les **mêmes interfaces** que le front-end.

### 8.1 Structure des fichiers (Backend)

```
src/
├── ocr/
│   ├── interfaces/
│   │   ├── ocr-engine.interface.ts       # Même interface que front
│   │   ├── ocr-options.interface.ts      # Même interface que front
│   │   └── ocr-result.interface.ts       # Même interface que front
│   │
│   ├── providers/
│   │   ├── tesseract.provider.ts         # Tesseract pour Node.js
│   │   ├── openai-vision.provider.ts     # OpenAI avec clé serveur
│   │   └── google-vision.provider.ts     # Google Vision avec clé serveur
│   │
│   ├── ocr.service.ts                    # Même logique que front
│   ├── ocr.controller.ts                 # Endpoint REST
│   ├── ocr.module.ts                     # Module NestJS
│   └── ocr.config.ts                     # Configuration
```

### 8.2 Interfaces partagées

Les interfaces sont **identiques** entre front et back. Options pour partager :

| Option           | Description            | Recommandation           |
| ---------------- | ---------------------- | ------------------------ |
| **Copier**       | Dupliquer les fichiers | Simple, risque de désync |
| **Lib partagée** | Package npm privé      | Idéal pour monorepo      |
| **Générer**      | OpenAPI → Types        | Si API-first             |

**Recommandation :** Commencer par copier, migrer vers lib partagée si le projet grandit.

### 8.3 OcrController

```typescript
// src/ocr/ocr.controller.ts (NestJS)

import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  Body,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { OcrService } from './ocr.service';
import { IOcrOptions } from './interfaces/ocr-options.interface';

@Controller('ocr')
export class OcrController {
  constructor(private readonly ocrService: OcrService) {}

  /**
   * Traite une image avec OCR.
   * POST /api/ocr/process
   */
  @Post('process')
  @UseInterceptors(FileInterceptor('image'))
  async process(
    @UploadedFile() file: Express.Multer.File,
    @Body('language') language?: string,
    @Body('documentType') documentType?: string,
    @Body('enhanceImage') enhanceImage?: string,
  ) {
    if (!file) {
      throw new HttpException('Image file required', HttpStatus.BAD_REQUEST);
    }

    const options: IOcrOptions = {
      language: language ?? 'fra',
      documentType: documentType as any,
      enhanceImage: enhanceImage === 'true',
    };

    try {
      const result = await this.ocrService.process(file.buffer, file.mimetype, options);
      return result; // Retourne IOcrResult
    } catch (error) {
      throw new HttpException(
        error instanceof Error ? error.message : 'OCR processing failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
```

### 8.4 OcrService (Backend)

```typescript
// src/ocr/ocr.service.ts (NestJS)

import { Injectable, Inject } from '@nestjs/common';
import { IOcrEngine, IOcrResult } from './interfaces/ocr-engine.interface';
import { IOcrOptions } from './interfaces/ocr-options.interface';
import { OCR_CONFIG, IOcrConfig } from './ocr.config';

@Injectable()
export class OcrService {
  private readonly providers = new Map<string, IOcrEngine>();

  constructor(
    @Inject(OCR_CONFIG) private readonly config: IOcrConfig,
    @Inject('TESSERACT_PROVIDER') private readonly tesseract: IOcrEngine,
    @Inject('OPENAI_PROVIDER') private readonly openai: IOcrEngine,
    @Inject('GOOGLE_PROVIDER') private readonly google: IOcrEngine,
  ) {
    this.providers.set(this.tesseract.name, this.tesseract);
    this.providers.set(this.openai.name, this.openai);
    this.providers.set(this.google.name, this.google);
  }

  /**
   * Traite une image avec le provider configuré.
   */
  async process(imageBuffer: Buffer, mimeType: string, options?: IOcrOptions): Promise<IOcrResult> {
    const providerName = this.resolveProvider(options?.documentType);
    const provider = this.providers.get(providerName);

    if (!provider || !provider.isAvailable) {
      throw new Error(`Provider "${providerName}" not available`);
    }

    return provider.process(imageBuffer, mimeType, options);
  }

  /**
   * Résout le provider selon le type de document.
   */
  private resolveProvider(documentType?: string): string {
    if (documentType && this.config.overrides[documentType]) {
      return this.config.overrides[documentType];
    }
    return this.config.defaultProvider;
  }
}
```

### 8.5 TesseractProvider (Backend - Node.js)

```typescript
// src/ocr/providers/tesseract.provider.ts (NestJS)

import { Injectable } from '@nestjs/common';
import Tesseract from 'tesseract.js';
import { IOcrEngine, IOcrResult, IOcrBlock } from '../interfaces/ocr-engine.interface';
import { IOcrOptions } from '../interfaces/ocr-options.interface';

@Injectable()
export class TesseractProvider implements IOcrEngine {
  readonly name = 'tesseract';
  readonly isAvailable = true;

  /**
   * Traite une image avec Tesseract.
   */
  async process(imageBuffer: Buffer, mimeType: string, options?: IOcrOptions): Promise<IOcrResult> {
    const startTime = performance.now();
    const language = options?.language ?? 'fra';

    const { data } = await Tesseract.recognize(imageBuffer, language);

    return {
      rawText: data.text,
      confidence: data.confidence / 100,
      blocks: this.mapBlocks(data.blocks),
      provider: this.name,
      processingTime: performance.now() - startTime,
    };
  }

  private mapBlocks(blocks: Tesseract.Block[] | null): IOcrBlock[] {
    if (!blocks) return [];

    return blocks.map((block) => ({
      text: block.text,
      confidence: block.confidence / 100,
      boundingBox: block.bbox
        ? {
            x: block.bbox.x0,
            y: block.bbox.y0,
            width: block.bbox.x1 - block.bbox.x0,
            height: block.bbox.y1 - block.bbox.y0,
          }
        : null,
    }));
  }
}
```

### 8.6 Configuration Backend

```typescript
// src/ocr/ocr.config.ts (NestJS)

export interface IOcrConfig {
  defaultProvider: string;
  fallbackProvider: string | null;
  minConfidence: number;
  overrides: Record<string, string>;
  openaiKey: string | null;
  googleVisionKey: string | null;
}

export const OCR_CONFIG = 'OCR_CONFIG';

// Chargé depuis variables d'environnement
export const ocrConfig: IOcrConfig = {
  defaultProvider: process.env.OCR_DEFAULT_PROVIDER ?? 'tesseract',
  fallbackProvider: process.env.OCR_FALLBACK_PROVIDER ?? null,
  minConfidence: parseFloat(process.env.OCR_MIN_CONFIDENCE ?? '0.7'),
  overrides: JSON.parse(process.env.OCR_OVERRIDES ?? '{}'),
  openaiKey: process.env.OPENAI_API_KEY ?? null,
  googleVisionKey: process.env.GOOGLE_VISION_KEY ?? null,
};
```

### 8.7 Module NestJS

```typescript
// src/ocr/ocr.module.ts

import { Module } from '@nestjs/common';
import { OcrController } from './ocr.controller';
import { OcrService } from './ocr.service';
import { TesseractProvider } from './providers/tesseract.provider';
import { OpenAiVisionProvider } from './providers/openai-vision.provider';
import { GoogleVisionProvider } from './providers/google-vision.provider';
import { OCR_CONFIG, ocrConfig } from './ocr.config';

@Module({
  controllers: [OcrController],
  providers: [
    { provide: OCR_CONFIG, useValue: ocrConfig },
    { provide: 'TESSERACT_PROVIDER', useClass: TesseractProvider },
    { provide: 'OPENAI_PROVIDER', useClass: OpenAiVisionProvider },
    { provide: 'GOOGLE_PROVIDER', useClass: GoogleVisionProvider },
    OcrService,
  ],
  exports: [OcrService],
})
export class OcrModule {}
```

### 8.8 Schéma de déploiement

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         DÉVELOPPEMENT                                    │
│                                                                          │
│  ┌─────────────┐                                                        │
│  │   Angular   │──── defaultProvider: 'tesseract' ────▶ Tesseract.js   │
│  │   (Front)   │     (traitement local, gratuit)                        │
│  └─────────────┘                                                        │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                          PRODUCTION                                      │
│                                                                          │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────────────────┐   │
│  │   Angular   │────▶│   Backend   │────▶│      NestJS OCR         │   │
│  │   (Front)   │     │   Provider  │     │                         │   │
│  └─────────────┘     └─────────────┘     │  defaultProvider:       │   │
│                                          │  'openai-vision'        │   │
│        defaultProvider: 'backend'        │                         │   │
│        backendOcrUrl: '/api/ocr/process' │  (clés API sécurisées)  │   │
│                                          └─────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 9. Parsers par feature

### 9.1 Exemple : InvoiceParserService

```typescript
// features/stock/stock-entry/services/invoice-parser.service.ts

import { Injectable } from '@angular/core';
import { DocumentParser, IParseResult, IValidationResult } from '@app/core/ocr';
import { IOcrBlock, OcrDocumentType } from '@app/core/ocr';
import { IStockEntryProduct } from '../models/stock-entry.model';

@Injectable({ providedIn: 'root' })
export class InvoiceParserService extends DocumentParser<IStockEntryProduct[]> {
  readonly documentType: OcrDocumentType = 'invoice';

  /**
   * Extrait les produits du texte OCR.
   */
  protected extractData(rawText: string, blocks: IOcrBlock[]): IStockEntryProduct[] {
    const lines = rawText.split('\n').filter((line) => line.trim());
    const products: IStockEntryProduct[] = [];

    for (const line of lines) {
      const product = this.#parseProductLine(line);
      if (product) {
        products.push(product);
      }
    }

    return products;
  }

  /**
   * Valide les produits extraits.
   */
  validate(products: IStockEntryProduct[]): IValidationResult {
    const errors: Array<{ field: string; message: string }> = [];

    if (products.length === 0) {
      errors.push({ field: 'products', message: 'Aucun produit détecté' });
    }

    products.forEach((product, index) => {
      if (product.warehouseAllocations.length === 0) {
        errors.push({
          field: `products[${index}].warehouseAllocations`,
          message: 'Entrepôt requis',
        });
      }

      if (!product.purchasePriceExclTax || product.purchasePriceExclTax <= 0) {
        errors.push({
          field: `products[${index}].purchasePriceExclTax`,
          message: 'Prix invalide',
        });
      }
    });

    return { isValid: errors.length === 0, errors };
  }

  /**
   * Parse une ligne de produit.
   */
  #parseProductLine(line: string): IStockEntryProduct | null {
    // Patterns courants pour factures optiques
    // Ex: "Ray-Ban RB5154 x 10 @ 45.00€"
    // Ex: "ESSILOR VARILUX 1.67 - Qté: 5 - PU: 120.00"

    const patterns = [
      // Pattern 1: "Produit x Quantité @ Prix"
      /^(.+?)\s+x\s*(\d+)\s*@\s*(\d+[.,]\d{2})/i,
      // Pattern 2: "Produit - Qté: N - PU: Prix"
      /^(.+?)\s*-\s*Qté:\s*(\d+)\s*-\s*PU:\s*(\d+[.,]\d{2})/i,
      // Pattern 3: Générique "Produit Quantité Prix"
      /^(.+?)\s+(\d+)\s+(\d+[.,]\d{2})/,
    ];

    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match) {
        return {
          productId: null, // Sera résolu par recherche
          warehouseAllocations: [],
          purchasePriceExclTax: parseFloat(match[3].replace(',', '.')),
          productType: null,
          pricingMode: null,
          coefficient: null,
          fixedAmount: null,
          fixedPrice: null,
          tvaRate: null,
          alertThreshold: null,
          brandId: null,
          modelId: null,
          lensType: null,
          lensMaterial: null,
          lensRefractiveIndex: null,
          // Métadonnées pour UI
          _designation: match[1].trim(),
          _quantity: parseInt(match[2], 10),
        };
      }
    }

    return null;
  }
}
```

### 9.2 Exemple : PrescriptionParserService

```typescript
// features/client/services/prescription-parser.service.ts

import { Injectable } from '@angular/core';
import { DocumentParser, IValidationResult } from '@app/core/ocr';
import { IOcrBlock, OcrDocumentType } from '@app/core/ocr';

export interface IPrescription {
  doctor: {
    name: string | null;
    speciality: string | null;
  };
  patient: {
    name: string | null;
  };
  date: string | null;
  rightEye: IEyePrescription | null;
  leftEye: IEyePrescription | null;
}

export interface IEyePrescription {
  sphere: number | null;
  cylinder: number | null;
  axis: number | null;
  addition: number | null;
}

@Injectable({ providedIn: 'root' })
export class PrescriptionParserService extends DocumentParser<IPrescription> {
  readonly documentType: OcrDocumentType = 'prescription';

  protected extractData(rawText: string, blocks: IOcrBlock[]): IPrescription {
    return {
      doctor: {
        name: this.#extractDoctorName(rawText),
        speciality: this.#extractSpeciality(rawText),
      },
      patient: {
        name: this.#extractPatientName(rawText),
      },
      date: this.#extractDate(rawText),
      rightEye: this.#extractEyeData(rawText, 'OD'),
      leftEye: this.#extractEyeData(rawText, 'OG'),
    };
  }

  validate(data: IPrescription): IValidationResult {
    const errors: Array<{ field: string; message: string }> = [];

    if (!data.rightEye && !data.leftEye) {
      errors.push({
        field: 'prescription',
        message: 'Aucune correction détectée',
      });
    }

    return { isValid: errors.length === 0, errors };
  }

  #extractDoctorName(text: string): string | null {
    const match = text.match(/Dr\.?\s+([A-Z][a-zéèê]+(?:\s+[A-Z][a-zéèê]+)*)/);
    return match ? match[1] : null;
  }

  #extractSpeciality(text: string): string | null {
    if (/ophtalmolog/i.test(text)) return 'Ophtalmologiste';
    if (/orthoptist/i.test(text)) return 'Orthoptiste';
    return null;
  }

  #extractPatientName(text: string): string | null {
    const match = text.match(/Patient\s*:\s*([^\n]+)/i);
    return match ? match[1].trim() : null;
  }

  #extractDate(text: string): string | null {
    const match = text.match(/(\d{2}[\/\-]\d{2}[\/\-]\d{4})/);
    return match ? match[1] : null;
  }

  #extractEyeData(text: string, eye: 'OD' | 'OG'): IEyePrescription | null {
    // Pattern: OD +2.00 (-0.50) 90° Add +2.00
    const pattern = new RegExp(
      `${eye}\\s*[:\\s]*([+-]?\\d+[.,]\\d{2})\\s*(?:\\(([+-]?\\d+[.,]\\d{2})\\))?\\s*(?:(\\d+)°)?(?:\\s*Add\\s*([+-]?\\d+[.,]\\d{2}))?`,
      'i',
    );

    const match = text.match(pattern);
    if (!match) return null;

    return {
      sphere: match[1] ? parseFloat(match[1].replace(',', '.')) : null,
      cylinder: match[2] ? parseFloat(match[2].replace(',', '.')) : null,
      axis: match[3] ? parseInt(match[3], 10) : null,
      addition: match[4] ? parseFloat(match[4].replace(',', '.')) : null,
    };
  }
}
```

---

## 10. Gestion des erreurs

### 10.1 Types d'erreurs

| Erreur                   | Cause                | Action                  |
| ------------------------ | -------------------- | ----------------------- |
| `Invalid image type`     | Format non supporté  | Message utilisateur     |
| `Image too large`        | > 10MB               | Message utilisateur     |
| `OCR timeout`            | Traitement trop long | Retry ou fallback       |
| `Provider not available` | Clé API manquante    | Fallback vers Tesseract |
| `Tesseract OCR failed`   | Erreur interne       | Retry                   |
| `OpenAI Vision failed`   | Erreur API           | Fallback                |

### 10.2 Stratégie de retry

```typescript
// Intégré dans OcrService

async #processWithRetry(
  provider: IOcrEngine,
  image: File,
  options?: IOcrOptions,
  maxRetries = 2
): Promise<IOcrResult> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await this.#processWithTimeout(provider, image, options);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');

      // Ne pas retry certaines erreurs
      if (
        lastError.message.includes('Invalid image') ||
        lastError.message.includes('too large')
      ) {
        throw lastError;
      }

      // Attendre avant retry (exponential backoff)
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
      }
    }
  }

  throw lastError;
}
```

### 10.3 Codes d'erreur

```typescript
// core/ocr/ocr.models.ts

export enum OcrErrorCode {
  INVALID_IMAGE = 'INVALID_IMAGE',
  IMAGE_TOO_LARGE = 'IMAGE_TOO_LARGE',
  TIMEOUT = 'TIMEOUT',
  PROVIDER_UNAVAILABLE = 'PROVIDER_UNAVAILABLE',
  PROCESSING_FAILED = 'PROCESSING_FAILED',
  LOW_CONFIDENCE = 'LOW_CONFIDENCE',
}

export class OcrError extends Error {
  constructor(
    public readonly code: OcrErrorCode,
    message: string,
    public readonly provider?: string,
  ) {
    super(message);
    this.name = 'OcrError';
  }
}
```

---

## 11. Tests

### 11.1 Tests unitaires Provider

```typescript
// core/ocr/providers/tesseract.provider.spec.ts

describe('TesseractProvider', () => {
  let provider: TesseractProvider;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [TesseractProvider, { provide: OCR_CONFIG, useValue: DEFAULT_OCR_CONFIG }],
    });
    provider = TestBed.inject(TesseractProvider);
  });

  afterEach(async () => {
    await provider.dispose();
  });

  it('should have correct name', () => {
    expect(provider.name).toBe('tesseract');
  });

  it('should always be available', () => {
    expect(provider.isAvailable).toBe(true);
  });

  it('should process image and return result', async () => {
    const mockFile = new File(['test'], 'test.png', { type: 'image/png' });
    const result = await provider.process(mockFile);

    expect(result).toBeDefined();
    expect(result.provider).toBe('tesseract');
    expect(result.rawText).toBeDefined();
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });
});
```

### 11.2 Tests unitaires Service

```typescript
// core/ocr/ocr.service.spec.ts

describe('OcrService', () => {
  let service: OcrService;
  let mockTesseract: jest.Mocked<TesseractProvider>;

  beforeEach(() => {
    mockTesseract = {
      name: 'tesseract',
      isAvailable: true,
      process: jest.fn(),
    } as any;

    TestBed.configureTestingModule({
      providers: [
        OcrService,
        { provide: OCR_CONFIG, useValue: DEFAULT_OCR_CONFIG },
        { provide: TesseractProvider, useValue: mockTesseract },
      ],
    });

    service = TestBed.inject(OcrService);
  });

  it('should use default provider', () => {
    expect(service.getDefaultProvider()).toBe('tesseract');
  });

  it('should list available providers', () => {
    const providers = service.getAvailableProviders();
    expect(providers).toContain('tesseract');
  });

  it('should set isProcessing during process', async () => {
    mockTesseract.process.mockResolvedValue({
      rawText: 'test',
      confidence: 0.9,
      blocks: [],
      provider: 'tesseract',
      processingTime: 100,
    });

    const file = new File(['test'], 'test.png', { type: 'image/png' });

    expect(service.isProcessing()).toBe(false);

    const promise = service.process(file);
    expect(service.isProcessing()).toBe(true);

    await promise;
    expect(service.isProcessing()).toBe(false);
  });

  it('should reject invalid image type', async () => {
    const file = new File(['test'], 'test.txt', { type: 'text/plain' });

    await expect(service.process(file)).rejects.toThrow('Invalid image type');
  });
});
```

### 11.3 Tests Parser

```typescript
// features/stock/stock-entry/services/invoice-parser.service.spec.ts

describe('InvoiceParserService', () => {
  let parser: InvoiceParserService;
  let mockOcrService: jest.Mocked<OcrService>;

  beforeEach(() => {
    mockOcrService = {
      process: jest.fn(),
    } as any;

    TestBed.configureTestingModule({
      providers: [InvoiceParserService, { provide: OcrService, useValue: mockOcrService }],
    });

    parser = TestBed.inject(InvoiceParserService);
  });

  it('should have correct document type', () => {
    expect(parser.documentType).toBe('invoice');
  });

  it('should parse product lines', async () => {
    mockOcrService.process.mockResolvedValue({
      rawText: 'Ray-Ban RB5154 x 10 @ 45.00€\nEssilor Varilux x 5 @ 120.00€',
      confidence: 0.9,
      blocks: [],
      provider: 'tesseract',
      processingTime: 100,
    });

    const file = new File(['test'], 'invoice.png', { type: 'image/png' });
    const result = await parser.parse(file);

    expect(result.data).toHaveLength(2);
    expect(result.data[0]._designation).toBe('Ray-Ban RB5154');
    expect(result.data[0]._quantity).toBe(10);
    expect(result.data[0].purchasePriceExclTax).toBe(45.0);
  });

  it('should validate products', () => {
    const products: IStockEntryProduct[] = [
      {
        productId: null,
        warehouseAllocations: [],
        purchasePriceExclTax: 0,
        // ...autres champs
      },
    ];

    const validation = parser.validate(products);

    expect(validation.isValid).toBe(false);
    expect(validation.errors).toContainEqual(
      expect.objectContaining({ field: expect.stringContaining('warehouseAllocations') }),
    );
  });
});
```

---

## 12. Implémentation

### 12.1 Phase 1 : Interfaces et configuration

**Durée estimée :** 0.5 jour

**Tâches :**

- [ ] Créer `core/ocr/interfaces/ocr-engine.interface.ts`
- [ ] Créer `core/ocr/interfaces/ocr-options.interface.ts`
- [ ] Créer `core/ocr/interfaces/document-parser.interface.ts`
- [ ] Créer `core/ocr/ocr.config.ts`
- [ ] Créer `core/ocr/ocr.models.ts`

### 12.2 Phase 2 : Providers

**Durée estimée :** 1 jour

**Tâches :**

- [ ] Installer `tesseract.js`
- [ ] Créer `core/ocr/providers/tesseract.provider.ts`
- [ ] Créer `core/ocr/providers/openai-vision.provider.ts`
- [ ] Créer `core/ocr/providers/google-vision.provider.ts`
- [ ] Tests unitaires providers

### 12.3 Phase 3 : Service OCR

**Durée estimée :** 0.5 jour

**Tâches :**

- [ ] Créer `core/ocr/ocr.service.ts`
- [ ] Créer `core/ocr/ocr.providers.ts`
- [ ] Intégrer dans `app.config.ts`
- [ ] Tests unitaires service

### 12.4 Phase 4 : Premier Parser

**Durée estimée :** 1 jour

**Tâches :**

- [ ] Créer `features/stock/stock-entry/services/invoice-parser.service.ts`
- [ ] Patterns d'extraction pour factures optiques
- [ ] Tests unitaires parser

---

## 13. Évolutions futures

### 13.1 Nouveaux providers

| Provider     | Priorité | Raison                |
| ------------ | -------- | --------------------- |
| Azure OCR    | Moyenne  | Alternative à Google  |
| AWS Textract | Basse    | Si besoin multi-cloud |
| On-premise   | Basse    | Si contraintes RGPD   |

### 13.2 Améliorations

| Amélioration        | Description                        |
| ------------------- | ---------------------------------- |
| Prétraitement image | Binarisation, correction contraste |
| Cache résultats     | Éviter re-traitement même image    |
| Analytics           | Tracking performance providers     |
| A/B testing         | Comparer providers automatiquement |

### 13.3 Nouveaux parsers

| Parser                | Feature | Priorité |
| --------------------- | ------- | -------- |
| PrescriptionParser    | Client  | Haute    |
| MutuelleParser        | Client  | Haute    |
| SupplierInvoiceParser | Finance | Moyenne  |

---

## Annexes

### A. Dépendances

```bash
npm install tesseract.js
```

### B. Types Tesseract

```typescript
// Ajouter si nécessaire
declare module 'tesseract.js' {
  export interface Block {
    text: string;
    confidence: number;
    bbox?: {
      x0: number;
      y0: number;
      x1: number;
      y1: number;
    };
  }
}
```

### C. Index exports

```typescript
// core/ocr/index.ts

export * from './interfaces/ocr-engine.interface';
export * from './interfaces/ocr-options.interface';
export * from './interfaces/document-parser.interface';
export * from './ocr.service';
export * from './ocr.config';
export * from './ocr.models';
export * from './ocr.providers';
```

---

## Historique des modifications

| Version | Date       | Auteur | Description                                             |
| ------- | ---------- | ------ | ------------------------------------------------------- |
| 1.0     | 2026-01-14 | Claude | Version initiale                                        |
| 1.1     | 2026-01-14 | Claude | Ajout BackendOcrProvider et architecture backend NestJS |
