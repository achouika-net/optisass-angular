import {
  Injectable,
  BadRequestException,
  NotFoundException,
  OnModuleInit,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LoyaltyService } from '../loyalty/loyalty.service';
import { PaiementsService } from '../paiements/paiements.service';
import { StockAvailabilityService } from './stock-availability.service';
import { Prisma } from '@prisma/client';
import { CreateFactureDto } from './dto/create-facture.dto';
import { UpdateFactureDto } from './dto/update-facture.dto';

import { ProductsService } from '../products/products.service';
import { CommissionService } from '../personnel/commission.service';

@Injectable()
export class FacturesService implements OnModuleInit {
  constructor(
    private prisma: PrismaService,
    private loyaltyService: LoyaltyService,
    private paiementsService: PaiementsService,
    private productsService: ProductsService,
    private commissionService: CommissionService,
    private stockAvailabilityService: StockAvailabilityService,
  ) { }

  async onModuleInit() {
    try {
      await this.cleanupExpiredDrafts();
    } catch (e) {
      console.error(
        '❌ [FacturesService] Failed during cleanupExpiredDrafts:',
        e,
      );
    }
    try {
      await this.migrateDraftsToDevis();
    } catch (e) {
      console.error(
        '❌ [FacturesService] Failed during migrateDraftsToDevis:',
        e,
      );
    }
    try {
      await this.migrateBroNumbersToDevis();
    } catch (e) {
      console.error(
        '❌ [FacturesService] Failed during migrateBroNumbersToDevis:',
        e,
      );
    }
  }

  async create(data: CreateFactureDto, userId?: string): Promise<any> {
    // 1. Preliminaries: Resolve client (read-only)
    const client = await this.prisma.client.findUnique({
      where: { id: data.clientId },
    });
    if (!client) {
      throw new NotFoundException(`Client ${data.clientId} non trouvé`);
    }

    const cleanData = { ...data } as any;
    delete cleanData.client;
    delete cleanData.paiements;
    delete cleanData.fiche;
    
    const invoiceCentreId = cleanData.centreId || client.centreId;

    // 2. [RECOVERY] Check for existing ficheId BEFORE transaction
    // This handles the "Upsert" logic if ficheId already has an invoice to avoid breaking transactions mid-stream.
    if (cleanData.ficheId) {
      const existing = await this.prisma.facture.findFirst({
        where: { ficheId: cleanData.ficheId },
      });
      if (existing) {
        console.log(`♻️ [UPSERT] Found existing invoice for fiche ${cleanData.ficheId}. Switching to update.`);
        return this.update(
          {
            where: { id: existing.id },
            data: { ...cleanData, statut: cleanData.statut || 'DEVIS_EN_COURS' },
          },
          userId,
        );
      }
    }

    // 3. ATOMIC TRANSACTION
    return this.prisma.$transaction(async (tx) => {
      // 3.1. Resolve Vendeur
      let resolvedVendeurId = cleanData.vendeurId || cleanData.proprietes?.vendeurId;
      if (!resolvedVendeurId && userId) {
        const user = await tx.user.findUnique({
          where: { id: userId },
          include: { employee: true },
        });
        if (user?.employee) resolvedVendeurId = user.employee.id;
      }

      // 3.2. Generate Numero ATOMICALLY inside the transaction
      const type = cleanData.type || 'DEVIS';
      const numero = await this.generateNextNumber(type, tx);

      // 3.3. Create Document
      let facture = await tx.facture.create({
        data: {
          ...cleanData,
          numero,
          vendeurId: resolvedVendeurId || null,
          centreId: invoiceCentreId,
          statut: cleanData.statut || (type === 'DEVIS' ? 'DEVIS_EN_COURS' : 'VALIDE'),
          resteAPayer: cleanData.totalTTC || 0,
        },
      });

      console.log(`✅ [CREATE] ${facture.type} ${facture.numero} created.`);

      // 3.4. Stock & Points Logic
      // [FIX] Loyalty points can only be used on official sales (Factures, Bons de Commande, etc.), NOT Devis.
      const isOfficial = ['FACTURE', 'BL', 'AVOIR', 'BON_COMM', 'BON_COMMANDE'].includes(facture.type);
      const isValidated = ['VALIDE', 'PAYEE', 'PARTIEL', 'VENTE_EN_INSTANCE'].includes(facture.statut);

      // Only decrement stock for official validated documents or forced (Devis usually don't impact stock)
      const shouldDecrement = (isOfficial && isValidated) || (facture.proprietes as any)?.forceStockDecrement === true;
      if (shouldDecrement) {
        await this.decrementStockForInvoice(tx, facture, userId);
      }

      // Spend Points if they are being used (Deduction is immediate on save if specified)
      // [FIX] ONLY spend points if the document is official (not a DEVIS)
      const props = (facture.proprietes as any) || {};
      const pointsToUse = Number(props.pointsUtilises || 0);
      const pointsAlreadySpent = props.pointsSpent === true;

      if (isOfficial && pointsToUse > 0 && !pointsAlreadySpent) {
        console.log(`🎯 [FIDELIO] Deducting ${pointsToUse} points for official document ${facture.numero}`);
        await this.loyaltyService.spendPoints(
          facture.clientId,
          pointsToUse,
          `Utilisation sur ${facture.type} ${facture.numero}`,
          facture.id,
          tx,
        );
        
        // Update document to mark points as spent
        facture = await tx.facture.update({
          where: { id: facture.id },
          data: {
            proprietes: {
              ...props,
              pointsSpent: true,
            },
          },
        });
      }

      // [RÈGLE MÉTIER] Les points Fidelio sont accordés lors de la CRÉATION DE FICHE (awardPointsForFolderCreation),
      // PAS lors de la création d'un BC ou d'une Facture. Supprimé: awardPointsForPurchase.

      // Calculate commissions for validated documents
      if (facture.vendeurId && isValidated) {
        await this.commissionService.calculateForInvoice(facture.id, tx);
      }

      // Final Fetch to ensure all relations and metadata are current
      return tx.facture.findUnique({
        where: { id: facture.id },
        include: { client: true, fiche: true, paiements: true }
      }) as any;
    });
  }

  private async generateNextNumber(type: string, tx?: any): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = this.getPrefix(type);
    const prisma = tx || this.prisma;

    // Find last document starting with this prefix for current year
    const lastDoc = await prisma.facture.findFirst({
      where: {
        numero: {
          startsWith: `${prefix}-${year}-`,
        },
      },
      orderBy: {
        numero: 'desc',
      },
    });

    let sequence = 1;
    if (lastDoc) {
      // Robust extraction of the last part
      const parts = lastDoc.numero.split('-');
      const lastPart = parts[parts.length - 1].trim();
      const lastSeq = parseInt(lastPart);
      if (!isNaN(lastSeq)) {
        sequence = lastSeq + 1;
      }
    }

    // Standard format: PREFIX-YEAR-SEQUENCE (Zero-padded to 3)
    return `${prefix}-${year}-${sequence.toString().padStart(3, '0')}`;
  }

  // Helper: Decrement Stock for Valid Invoice (Principal Warehouses)
  private async decrementStockForInvoice(
    tx: any,
    invoice: any,
    userId?: string,
  ) {
    console.log(
      `🎬[DEBUG] Starting Stock Decrement for ${invoice.numero}(${invoice.id})`,
    );

    // Load full invoice with line items to ensure we have the latest JSON data
    const fullInvoice = await tx.facture.findUnique({
      where: { id: invoice.id },
      include: { client: true },
    });

    if (!fullInvoice) {
      console.log(`❌[DEBUG] Invoice not found in DB: ${invoice.id} `);
      return;
    }

    const props = (fullInvoice.proprietes as any) || {};
    const forceDecrement =
      props.forceStockDecrement === true ||
      props.forceStockDecrement === 'true';

    console.log(
      `🔍[DEBUG] Properties for ${fullInvoice.numero}: stockDecremented = ${props.stockDecremented}, forceStockDecrement = ${forceDecrement} `,
    );

    if (props.stockDecremented === true || props.stockDecremented === 'true') {
      console.log(
        `⏩[DEBUG] SKIP: Stock already marked as decremented for ${fullInvoice.numero} (Idempotency enforced)`,
      );
      return;
    }

    // Parse lines safely
    let linesToProcess: any[] = [];
    try {
      linesToProcess =
        typeof fullInvoice.lignes === 'string'
          ? JSON.parse(fullInvoice.lignes)
          : (fullInvoice.lignes as any[]);
    } catch (e) {
      console.error(
        `❌[DEBUG] Failed to parse lines for ${fullInvoice.numero}: `,
        e,
      );
    }

    if (!Array.isArray(linesToProcess) || linesToProcess.length === 0) {
      console.log(
        `⏩[DEBUG] SKIP: No lines to process in invoice ${fullInvoice.numero} `,
      );
      return;
    }

    console.log(`📋[DEBUG] Found ${linesToProcess.length} lines.Processing...`);

    for (const line of linesToProcess) {
      const pid = line.productId;
      const qte = Number(line.qte);

      if (isNaN(qte) || qte <= 0) {
        console.log(
          `   🚫[DEBUG] Skipping line: "${line.description}"(Invalid Qty: ${qte})`,
        );
        continue;
      }

      console.log(
        `   🔎[DEBUG] Eval: "${line.description}" | PID: ${pid} | Qty: ${qte} `,
      );

      let product: any = null;
      if (pid) {
        product = await tx.product.findUnique({
          where: { id: pid },
          include: { entrepot: true },
        });
      }

      const invoiceCentreId =
        fullInvoice.centreId || fullInvoice.client?.centreId;

      if (
        !product ||
        (product.entrepot?.centreId !== invoiceCentreId && invoiceCentreId)
      ) {
        console.log(
          `   🔄[DEBUG] Falling back to model-based search for: "${line.description}" (Product Wh: ${product?.entrepot?.centreId || 'None'} vs Invoice Centre: ${invoiceCentreId})`,
        );

        const targetCentreId = invoiceCentreId;

        if (targetCentreId) {
          const localMatch = await this.productsService.findLocalCounterpart({
            designation: (line.designation || line.description || '').trim(),
            codeInterne: (line.codeInterne || line.reference || '').trim(),
            codeBarres: (line.codeBarres || '').trim(),
            centreId: targetCentreId,
          });

          if (localMatch) {
            console.log(
              `   ✨[DEBUG] Found local counterpart: ${localMatch.id} (${localMatch.designation})`,
            );
            product = localMatch;
          } else {
            console.log(
              `   ⚠️ [DEBUG] No local counterpart found for: "${line.description}" in center ${targetCentreId}`,
            );
          }
        }
      }

      if (!product) {
        console.log(
          `   ❌[DEBUG] Product NOT FOUND locally: ${pid} (${line.description})`,
        );
        continue;
      }

      const entrepotId = line.entrepotId || product.entrepotId; // Use line warehouse if specified
      const isEligible = !!entrepotId;

      if (isEligible) {
        const actionDesc =
          fullInvoice.type === 'AVOIR' ? 'Incrementing' : 'Decrementing';

        // [FIX] Movement quantity should be negative for exits (SORTIE_VENTE)
        const moveQty = fullInvoice.type === 'AVOIR' ? qte : -qte;

        const stockChange =
          fullInvoice.type === 'AVOIR'
            ? { increment: qte }
            : { decrement: qte };
        const moveType =
          fullInvoice.type === 'AVOIR' ? 'ENTREE_RETOUR' : 'SORTIE_VENTE';

        // [STRICT CHECK] Prevent negative stock for sales
        if (fullInvoice.type !== 'AVOIR' && (product.quantiteActuelle as number) < qte) {
          const msg = `Stock insuffisant pour "${product.designation}" (Réf: ${line.reference || 'N/A'}). Disponible: ${product.quantiteActuelle}, Requis: ${qte}`;
          console.error(`❌[STOCK] ${msg}`);
          throw new BadRequestException(msg);
        }

        await tx.product.update({
          where: { id: product.id },
          data: { quantiteActuelle: stockChange },
        });

        // Log movement
        await tx.mouvementStock.create({
          data: {
            type: moveType,
            quantite: moveQty,
            produitId: product.id,
            entrepotSourceId: fullInvoice.type === 'AVOIR' ? null : entrepotId,
            entrepotDestinationId:
              fullInvoice.type === 'AVOIR' ? entrepotId : null,
            factureId: fullInvoice.id,
            prixAchatUnitaire: product.prixAchatHT,
            prixVenteUnitaire:
              fullInvoice.type === 'AVOIR' ? undefined : line.prixUnitaireTTC,
            motif: fullInvoice.fiche
              ? `Vente Monture - Fiche n° ${fullInvoice.fiche.numero}${fullInvoice.fiche.dateCreation ? ' du ' + new Date(fullInvoice.fiche.dateCreation).toLocaleDateString('fr-FR') : ''} (${fullInvoice.statut})`
              : `Facturation ${fullInvoice.numero} (${fullInvoice.statut})`,
            utilisateur: userId ? `User ${userId} ` : 'System',
            userId: userId || null,
            dateMovement: new Date(),
          },
        });
        console.log(`   ✅[DEBUG] Success: ${actionDesc} complete.`);
      }
    }

    // Flag as processed and CLEAR force flag
    await tx.facture.update({
      where: { id: fullInvoice.id },
      data: {
        proprietes: {
          ...props,
          stockDecremented: true,
          forceStockDecrement: false,
          dateStockDecrement: new Date(),
        },
      },
    });
    console.log(
      `🎬[DEBUG] Stock Decrement Complete & Flagged for ${fullInvoice.numero}`,
    );
  }

  async verifyProductsAreReceived(lignes: any[], type?: string) {
    if (type === 'AVOIR' || type === 'AVOIR_FOURNISSEUR' || type === 'BON_COMM')
      return;
    if (!Array.isArray(lignes)) return;

    for (const line of lignes) {
      const pid = line.productId;
      if (!pid) continue;

      const product = await this.prisma.product.findUnique({
        where: { id: pid },
        select: {
          id: true,
          designation: true,
          specificData: true,
          entrepot: { select: { centreId: true } },
        },
      });

      if (product && product.entrepot?.centreId && type !== 'AVOIR') {
        const sd = (product.specificData as any) || {};
        if (sd.pendingIncoming) {
          const status = sd.pendingIncoming.status || 'RESERVED';
          const detail =
            status === 'SHIPPED'
              ? "en cours d'expédition"
              : 'réservé à la source';
          throw new BadRequestException(
            `Impossible de valider la facture : le produit "${product.designation}" est ${detail} (Transfert en cours). ` +
            `Veuillez d'abord confirmer la réception du produit pour alimenter le stock local.`,
          );
        }
      }
    }
  }

  async checkStockAvailability(id: string) {
    return this.stockAvailabilityService.checkAvailability(id);
  }

  async findAll(params: {
    skip?: number;
    take?: number;
    cursor?: Prisma.FactureWhereUniqueInput;
    where?: Prisma.FactureWhereInput;
    orderBy?: Prisma.FactureOrderByWithRelationInput;
  }) {
    const { skip, take = 10, cursor, where, orderBy } = params;
    const factures = await this.prisma.facture.findMany({
      skip,
      take,
      cursor,
      where,
      orderBy,
      include: {
        client: true,
        fiche: true,
        paiements: true,
      },
    });
    return factures;
  }

  async findOne(id: string) {
    return this.prisma.facture.findUnique({
      where: { id },
      include: {
        client: true,
        fiche: true,
        paiements: true,
      },
    });
  }

  // Helper: Restore Stock for Cancelled Invoice (Increments stock back)
  private async restoreStockForCancelledInvoice(tx: any, invoice: any) {
    console.log(
      `🔄[DEBUG] Starting Stock Restoration for ${invoice.numero}(${invoice.id})`,
    );

    const fullInvoice = await tx.facture.findUnique({
      where: { id: invoice.id },
      include: { client: true },
    });

    if (!fullInvoice) return;

    const props = (fullInvoice.proprietes as any) || {};
    if (!props.stockDecremented) {
      console.log(
        `⏩[DEBUG] Stock was never decremented for ${fullInvoice.numero}. Skipping.`,
      );
      return;
    }

    // Parse lines safely
    let linesToProcess: any[] = [];
    try {
      linesToProcess =
        typeof fullInvoice.lignes === 'string'
          ? JSON.parse(fullInvoice.lignes)
          : (fullInvoice.lignes as any[]);
    } catch (e) {
      console.error(
        `❌[DEBUG] Failed to parse lines for restoration of ${fullInvoice.numero}: `,
        e,
      );
    }

    const invoiceCentreId =
      fullInvoice.centreId || fullInvoice.client?.centreId;

    for (const line of linesToProcess) {
      const qte = Number(line.qte);
      const pid = line.productId;
      if (!pid || isNaN(qte) || qte <= 0) continue;

      let product = await tx.product.findUnique({
        where: { id: pid },
        include: { entrepot: true },
      });

      // Fallback matching
      if (
        !product ||
        (product.entrepot?.centreId !== invoiceCentreId && invoiceCentreId)
      ) {
        const targetCentreId = invoiceCentreId;
        if (targetCentreId) {
          const localMatch = await this.productsService.findLocalCounterpart({
            designation: (line.designation || line.description || '').trim(),
            codeInterne: (line.codeInterne || line.reference || '').trim(),
            codeBarres: (line.codeBarres || '').trim(),
            centreId: targetCentreId,
          });
          if (localMatch) product = localMatch;
        }
      }

      if (product) {
        await tx.product.update({
          where: { id: product.id },
          data: { quantiteActuelle: { increment: qte } },
        });

        await tx.mouvementStock.create({
          data: {
            produitId: product.id,
            entrepotDestinationId: product.entrepotId,
            factureId: fullInvoice.id,
            type: 'ENTREE_RETOUR',
            quantite: qte,
            motif: `Annulation/Conversion ${invoice.numero} - Stock restauré`,
            utilisateur: 'System',
            dateMovement: new Date(),
          },
        });
      }
    }

    // Mark as stock restored
    await tx.facture.update({
      where: { id: invoice.id },
      data: {
        proprietes: {
          ...props,
          stockDecremented: false,
          stockRestored: true,
          restoredAt: new Date(),
        },
      },
    });
  }

  async update(
    params: {
      where: Prisma.FactureWhereUniqueInput;
      data: UpdateFactureDto;
    },
    userId?: string,
    tx?: Prisma.TransactionClient,
  ) {
    const runUpdate = async (txClient: Prisma.TransactionClient) => {
      const { where, data } = params;

      // 1. Initial Load & Centre Inheritance
      const currentFacture = (await txClient.facture.findUnique({
        where,
        include: { paiements: true, client: true },
      })) as any;

      if (!currentFacture) {
        throw new NotFoundException(`Facture ${where.id} non trouvée`);
      }

      // Inherit centreId from client if missing
      if (!data.centreId && !currentFacture.centreId && (data.clientId || currentFacture.clientId)) {
        const cid = data.clientId || currentFacture.clientId;
        const targetClient = await txClient.client.findUnique({ where: { id: cid }, select: { centreId: true } });
        if (targetClient?.centreId) {
          data.centreId = targetClient.centreId;
        }
      }

      // 2. Transition Logic: DEVIS/BROUILLON -> Official Document
      const num = (currentFacture.numero || '').trim().toUpperCase();
      const isCurrentlyDevis =
        (currentFacture.type === 'DEVIS' ||
          currentFacture.statut === 'BROUILLON' ||
          num.startsWith('DEV') ||
          num.startsWith('BRO')) &&
        currentFacture.type !== 'FACTURE';

      const effectiveType = data.type || currentFacture.type;

      if (
        isCurrentlyDevis &&
        ['BON_COMM', 'BON_COMMANDE', 'BON_DE_COMMANDE', 'FACTURE', 'BL'].includes(effectiveType)
      ) {
        // Run stock check before transition
        const stockCheck = await this.checkStockAvailability(currentFacture.id);
        if (stockCheck.hasConflicts) {
          throw new ConflictException({
            message: 'Impossible de transformer : produits en rupture de stock.',
            conflicts: stockCheck.conflicts,
          });
        }

        console.log(`📌 [TRANSITION] ${currentFacture.numero} -> ${effectiveType}`);
        data.numero = await this.generateNextNumber(effectiveType, txClient);
        
        if (['BON_COMM', 'BON_COMMANDE', 'BON_DE_COMMANDE'].includes(effectiveType)) {
          data.statut = 'VENTE_EN_INSTANCE';
        }
      }

      // 3. Fiscal Flow Trigger (Validation with number change)
      const isBecomingValid = data.statut === 'VALIDE';
      const isTargetingBC = ['BON_COMM', 'BON_DE_COMMANDE', 'BON_COMMANDE'].includes(data.type || '');
      const isFirstValidation = !currentFacture.numero?.startsWith('FAC');
      const amountChanged = data.totalTTC !== undefined && Math.abs((data.totalTTC || 0) - (currentFacture.totalTTC || 0)) > 0.1;

      const shouldTriggerFiscalFlow = isBecomingValid && !isTargetingBC && (isFirstValidation || amountChanged || (data.proprietes as any)?.forceFiscal === true);

      if (shouldTriggerFiscalFlow) {
        await this.verifyProductsAreReceived(currentFacture.lignes as any[], 'FACTURE');
        
        const targetType = data.type || currentFacture.type;
        const officialNumber = await this.generateNextNumber(targetType, txClient);

        // Prepare new invoice data
        const { client, paiements, fiche, id, ...existingFlat } = currentFacture;
        const { client: dClient, paiements: dPai, fiche: dFiche, ...incomingData } = data as any;

        const cleanProprietes = {
          ...((existingFlat.proprietes as any) || {}),
          ...((incomingData.proprietes as any) || {}),
          stockDecremented: false,
          dateStockDecrement: null,
          ancienneReference: currentFacture.numero,
          forceStockDecrement: true,
        };

        const newInvoiceData: Prisma.FactureUncheckedCreateInput = {
          ...existingFlat,
          ...incomingData,
          proprietes: cleanProprietes,
          numero: officialNumber,
          statut: 'VALIDE',
          dateEmission: new Date(),
          type: data.type || 'FACTURE',
          clientId: currentFacture.clientId,
          centreId: currentFacture.centreId,
        };

        // Handle AVOIR for old official invoice if necessary
        if (currentFacture.numero.startsWith('FAC')) {
          console.log(`ℹ️ [FISCAL] official invoice conversion. Creating AVOIR for ${currentFacture.numero}`);
          const avoirData: Prisma.FactureUncheckedCreateInput = {
            type: 'AVOIR',
            statut: 'VALIDE',
            numero: await this.generateNextNumber('AVOIR', txClient),
            dateEmission: new Date(),
            clientId: currentFacture.clientId,
            centreId: currentFacture.centreId,
            lignes: (currentFacture.lignes as any[]).map(l => ({ ...l, prixUnitaireTTC: -l.prixUnitaireTTC, totalTTC: -l.totalTTC })),
            totalHT: -currentFacture.totalHT,
            totalTVA: -currentFacture.totalTVA,
            totalTTC: -currentFacture.totalTTC,
            resteAPayer: 0,
            proprietes: { ...(currentFacture.proprietes as any), stockDecremented: false, factureOriginale: currentFacture.numero, isAutoGenerated: true },
          };
          const autoAvoir = await txClient.facture.create({ data: avoirData as any });
          if ((currentFacture.proprietes as any)?.stockDecremented) {
            await this.decrementStockForInvoice(txClient, autoAvoir, userId);
          }
        } else {
          // Silent restoration for drafts
          await this.restoreStockForCancelledInvoice(txClient, currentFacture);
        }

        // Cancel Old First to free up the @unique ficheId
        await txClient.facture.update({
          where: { id: currentFacture.id },
          data: { statut: 'ANNULEE', resteAPayer: 0, ficheId: null }
        });

        const newInvoice = await txClient.facture.create({ data: newInvoiceData as any });
        
        // Add replacement note to Old
        await txClient.facture.update({
          where: { id: currentFacture.id },
          data: { notes: `Remplacée par ${newInvoice.numero}` }
        });

        // Move Payments
        const pMove = await txClient.paiement.findMany({ where: { factureId: currentFacture.id } });
        const totalPaid = pMove.reduce((s, p) => s + Number(p.montant), 0);
        if (pMove.length > 0) {
          await txClient.paiement.updateMany({ where: { factureId: currentFacture.id }, data: { factureId: newInvoice.id } });
        }

        // Determine Final Status
        let finalStatut = 'VALIDE';
        let reste = Math.max(0, Number(newInvoice.totalTTC) - totalPaid);
        if (totalPaid >= Number(newInvoice.totalTTC) - 0.05) {
          finalStatut = 'PAYEE';
          reste = 0;
        } else if (totalPaid > 0) {
          finalStatut = 'PARTIEL';
        }

        const finalInvoice = await txClient.facture.update({
          where: { id: newInvoice.id },
          data: { ficheId: currentFacture.ficheId, statut: finalStatut, resteAPayer: reste }
        });

        // Stock and Loyalty for Final
        await this.decrementStockForInvoice(txClient, finalInvoice, userId);
        if (finalInvoice.vendeurId) await this.commissionService.calculateForInvoice(finalInvoice.id, txClient);
        await this.loyaltyService.awardPointsForPurchase(finalInvoice.id, txClient);
        
        return finalInvoice;
      }

      // 4. Normal Update Flow
      console.log(`[DIAGNOSTIC] FacturesService.update called for ${where.id}. Data:`, data.proprietes ? JSON.stringify(data.proprietes) : 'undef');
      const allowedFields = ['numero','type','dateEmission','dateEcheance','statut','clientId','ficheId','totalHT','totalTVA','totalTTC','resteAPayer','lignes','proprietes','parentFactureId','montantLettres','notes','centreId','exportComptable','typeOperation','vendeurId'];
      const cleanData: any = {};
      for (const field of allowedFields) { if (data[field] !== undefined) cleanData[field] = data[field]; }

      // Merge properties safely
      if (cleanData.proprietes) {
        const p = (currentFacture.proprietes as any) || {};
        cleanData.proprietes = {
          ...p,
          ...cleanData.proprietes,
          // [PROTECTION] These flags are server-controlled — never allow frontend to downgrade them
          stockDecremented: p.stockDecremented || cleanData.proprietes.stockDecremented,
          pointsSpent: p.pointsSpent || cleanData.proprietes.pointsSpent,
          pointsAwarded: p.pointsAwarded || cleanData.proprietes.pointsAwarded,
        };
      }

      // [FIX] Ensure isOfficialDoc checks against the NEW type if updated, or the OLD type if not. Include BON_COMM.
      const updatedType = cleanData.type || currentFacture.type;
      const isOfficialDoc = ['FACTURE', 'BL', 'AVOIR', 'BON_COMM', 'BON_COMMANDE'].includes(updatedType);

      // FIDELIO Adjustments - ONLY for official documents!
      if (isOfficialDoc && cleanData.proprietes?.pointsUtilises !== undefined) {
        const oldP = Number((currentFacture.proprietes as any)?.pointsUtilises || 0);
        const newP = Number(cleanData.proprietes.pointsUtilises);
        const delta = newP - oldP;
        
        // If it wasn't spent before (e.g. was a Devis), and now we are checking out as BC:
        // oldP might be 50, but it was never deducted because it was a Devis.
        // We need a more robust check based on 'pointsSpent' flag.
        const wasSpent = (currentFacture.proprietes as any)?.pointsSpent === true;
        
        if (!wasSpent && newP > 0) {
           console.log(`🎯 [FIDELIO] Upgrading doc to Official. Initial deduction of ${newP} points for ${currentFacture.numero}`);
           await this.loyaltyService.spendPoints(currentFacture.clientId, newP, `Utilisation sur ${updatedType} ${currentFacture.numero}`, currentFacture.id, txClient);
           cleanData.proprietes.pointsSpent = true;
        } else if (wasSpent && delta !== 0) {
           console.log(`🎯 [FIDELIO] Adjusting points for Official doc. Delta: ${delta} points for ${currentFacture.numero}`);
           await this.loyaltyService.spendPoints(currentFacture.clientId, delta, `Ajustement sur ${updatedType} ${currentFacture.numero}`, currentFacture.id, txClient);
           // If newP is 0, we still marked it spent, but the delta (-oldP) refunded them.
           cleanData.proprietes.pointsSpent = newP > 0;
        }
      }

      const updated = await txClient.facture.update({ where, data: cleanData });

      // Post-Update Stock/Commission
      const isVal = ['VALIDE', 'PAYEE', 'PARTIEL', 'VENTE_EN_INSTANCE'].includes(updated.statut);
      if ((isOfficialDoc && isVal) || (updated.proprietes as any)?.forceStockDecrement === true) {
        await this.decrementStockForInvoice(txClient, updated, userId);
        if (updated.vendeurId) await this.commissionService.calculateForInvoice(updated.id, txClient);
        // [RÈGLE MÉTIER] Les points Fidelio sont accordés lors de la CRÉATION DE FICHE uniquement.
        // PAS ici (BC/Facture update). Supprimé: awardPointsForPurchase.
      }

      if (updated.statut === 'ANNULEE' && (updated.proprietes as any)?.restoreStock === true) {
        await this.restoreStockForCancelledInvoice(txClient, updated);
      }

      return updated;
    };

    return tx ? runUpdate(tx) : this.prisma.$transaction(async (newTx) => runUpdate(newTx));
  }

  async remove(where: Prisma.FactureWhereUniqueInput) {
    const facture = await this.prisma.facture.findUnique({ where, include: { paiements: true } });
    if (!facture) throw new NotFoundException('Facture non trouvée');

    const num = facture.numero.toUpperCase();
    const isOfficial = !num.startsWith('BRO') && !num.startsWith('DEV');
    
    let isLast = true;
    if (isOfficial) {
      const next = await this.prisma.facture.findFirst({
        where: {
          type: facture.type,
          numero: {
            gt: facture.numero,
            startsWith: this.getPrefix(facture.type)
          }
        }
      });
      isLast = !next;
    }

    if (isLast) {
      return this.prisma.facture.delete({ where });
    } else {
      const avoirNumero = await this.generateNextNumber('AVOIR');
      const avoir = await this.prisma.facture.create({
        data: {
          numero: avoirNumero, type: 'AVOIR', clientId: facture.clientId, statut: 'VALIDE', dateEmission: new Date(),
          totalHT: -Math.abs(facture.totalHT), totalTVA: -Math.abs(facture.totalTVA), totalTTC: -Math.abs(facture.totalTTC), resteAPayer: 0,
          lignes: (facture.lignes as any[]).map(l => ({ ...l, prixUnitaireTTC: -Math.abs(l.prixUnitaireTTC), totalTTC: -Math.abs(l.totalTTC) })),
          notes: `Avoir sur ${facture.numero}`, proprietes: { ...(facture.proprietes as any), ficheId: facture.ficheId }
        }
      });
      await this.prisma.facture.update({ where: { id: facture.id }, data: { statut: 'ANNULEE', resteAPayer: 0 } });
      return { action: 'AVOIR_CREATED', avoir };
    }
  }

  private getPrefix(type: string): string {
    switch (type) {
      case 'FACTURE': return 'Fact';
      case 'DEVIS': return 'Devis';
      case 'AVOIR': return 'AVR';
      case 'BL': return 'BL';
      case 'BON_COMM': case 'BON_COMMANDE': return 'BC';
      default: return 'DOC';
    }
  }

  private async applyPendingFidelioRewards(factureId: string, tx: any) {
    try {
      const invoice = await tx.facture.findUnique({ where: { id: factureId } });
      if (!invoice || invoice.resteAPayer <= 0) return;
      const rewards = await tx.rewardRedemption.findMany({ where: { clientId: invoice.clientId, isUsed: false }, orderBy: { redeemedAt: 'asc' } });
      if (rewards.length === 0) return;
      
      let remaining = invoice.resteAPayer;
      for (const r of rewards) {
        if (remaining <= 0) break;
        const amount = Math.min(r.madValue, remaining);
        const p = await tx.paiement.create({
          data: { montant: amount, mode: 'FIDELIO', statut: 'ENCAISSE', reference: `Bonus Fidelio - ${r.pointsUsed} pts`, notes: 'Paiement auto points', factureId: invoice.id, date: new Date() }
        });
        await tx.rewardRedemption.update({ where: { id: r.id }, data: { isUsed: true, paiementId: p.id } });
        remaining -= amount;
      }

      if (remaining < invoice.resteAPayer) {
        const remRounded = Math.max(0, parseFloat(remaining.toFixed(2)));
        let newStatut = invoice.statut;
        if (remRounded <= 0 && invoice.statut !== 'PAYEE') newStatut = 'PAYEE';
        else if (remRounded > 0 && invoice.statut !== 'PARTIEL' && invoice.type === 'FACTURE') newStatut = 'PARTIEL';
        await tx.facture.update({ where: { id: factureId }, data: { resteAPayer: remRounded, statut: newStatut } });
      }
    } catch (e) {
      console.error('❌ [FIDELIO] Reward apply fail:', e);
    }
  }

  async createExchange(invoiceId: string, items: any[], centreId: string) {
    if (!centreId) throw new BadRequestException('ID du centre manquant');
    const original = await this.prisma.facture.findUnique({ where: { id: invoiceId } });
    if (!original) throw new NotFoundException('Facture initiale non trouvée');

    const lines = (typeof original.lignes === 'string' ? JSON.parse(original.lignes) : original.lignes) as any[];

    return this.prisma.$transaction(async (tx) => {
      const newNum = await this.generateNextNumber('FACTURE', tx);
      const avNum = await this.generateNextNumber('AVOIR', tx);
      
      const avoir = await tx.facture.create({
        data: {
          numero: avNum, type: 'AVOIR', statut: 'VALIDE', clientId: original.clientId, parentFactureId: original.id, dateEmission: new Date(),
          totalHT: -original.totalHT, totalTVA: -original.totalTVA, totalTTC: -original.totalTTC, resteAPayer: 0,
          lignes: lines.map(l => ({ ...l, prixUnitaireTTC: -l.prixUnitaireTTC, totalTTC: -l.totalTTC })),
          notes: `Avoir facture n° : ${original.numero}`, proprietes: { factureOriginale: original.numero, ficheId: original.ficheId }, centreId: original.centreId
        }
      });

      await tx.facture.update({ where: { id: original.id }, data: { statut: 'ANNULEE', ficheId: null, resteAPayer: 0, notes: `Remplacée par ${newNum}` } });

      const defectiveWh = await this.getOrCreateDefectiveWarehouse(tx, centreId);
      for (const item of items) {
        const line = lines[item.lineIndex];
        if (line && line.productId) {
          const prod = await tx.product.findUnique({ where: { id: line.productId } });
          if (prod) {
            const targetWh = item.reason === 'DEFECTUEUX' ? defectiveWh.id : line.entrepotId;
            await tx.product.update({ where: { id: prod.id }, data: { quantiteActuelle: { increment: item.quantiteRetour } } });
            await tx.mouvementStock.create({
               data: { type: 'ENTREE_RETOUR_CLIENT', quantite: item.quantiteRetour, produitId: prod.id, entrepotDestinationId: targetWh, factureId: original.id, motif: `Retour ${item.reason}`, utilisateur: 'System' }
            });
          }
        }
      }

      const newLines = lines.map((l, i) => {
        const ret = items.find(r => r.lineIndex === i);
        if (ret) {
          const isMonture = l.designation?.toLowerCase().includes('monture');
          return { ...l, designation: isMonture ? 'Monture Client' : l.designation, prixUnitaireTTC: 0, totalHT: 0, totalTVA: 0, totalTTC: 0, productId: null };
        }
        return l;
      });

      const nTTC = newLines.reduce((s, l) => s + l.totalTTC, 0);
      const newInvoice = await tx.facture.create({
        data: { numero: newNum, type: 'FACTURE', statut: 'VALIDE', clientId: original.clientId, centreId: original.centreId, dateEmission: new Date(), lignes: newLines, totalTTC: nTTC, resteAPayer: nTTC, ficheId: original.ficheId, parentFactureId: original.id }
      });

      const pTrans = await tx.paiement.findMany({ where: { factureId: original.id } });
      const totalP = pTrans.reduce((s, p) => s + p.montant, 0);
      await tx.paiement.updateMany({ where: { factureId: original.id }, data: { factureId: newInvoice.id } });

      if (totalP > nTTC) {
        const diff = totalP - nTTC;
        const ref = await tx.paiement.create({ data: { factureId: newInvoice.id, montant: -diff, mode: 'ESPECES', statut: 'DECAISSEMENT', date: new Date(), notes: 'Rendu monnaie' } });
        await this.paiementsService.handleCaisseIntegration(tx, ref, newInvoice);
      }

      await tx.facture.update({ where: { id: newInvoice.id }, data: { resteAPayer: Math.max(0, nTTC - totalP) } });

      return { avoir, newInvoice };
    });
  }

  async cleanupExpiredDrafts() {
    const twoMonthsAgo = new Date(); twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
    const expired = await this.prisma.facture.findMany({ where: { statut: 'BROUILLON', dateEmission: { lt: twoMonthsAgo }, paiements: { none: {} } } });
    if (expired.length > 0) {
      await this.prisma.facture.updateMany({ where: { id: { in: expired.map(d => d.id) } }, data: { statut: 'ANNULEE', notes: 'Expiré' } });
    }
  }

  async migrateDraftsToDevis() {
    await this.prisma.facture.updateMany({ where: { statut: 'BROUILLON', type: 'FACTURE' }, data: { type: 'DEVIS' } });
  }

  async migrateBroNumbersToDevis() {
    const drafts = await this.prisma.facture.findMany({ where: { numero: { startsWith: 'BRO-' } } });
    for (const d of drafts) {
      await this.prisma.facture.update({ where: { id: d.id }, data: { numero: d.numero.replace('BRO-', 'Devis-') } });
    }
  }

  private async getOrCreateDefectiveWarehouse(tx: any, centreId: string) {
    let wh = await tx.entrepot.findFirst({ where: { centreId, nom: { contains: 'défectueux', mode: 'insensitive' } } });
    if (!wh) {
      wh = await tx.entrepot.create({ data: { nom: 'Entrepot Défectueux', type: 'TRANSIT', centreId } });
    }
    return wh;
  }
}
