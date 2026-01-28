import { Injectable, BadRequestException, NotFoundException, InternalServerErrorException, OnModuleInit, ConflictException } from '@nestjs/common';
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
            console.error('❌ [FacturesService] Failed during cleanupExpiredDrafts:', e);
        }
        try {
            await this.migrateDraftsToDevis();
        } catch (e) {
            console.error('❌ [FacturesService] Failed during migrateDraftsToDevis:', e);
        }
        try {
            await this.migrateBroNumbersToDevis();
        } catch (e) {
            console.error('❌ [FacturesService] Failed during migrateBroNumbersToDevis:', e);
        }
    }

    async create(data: CreateFactureDto, userId?: string) {
        // 1. Vérifier que le client existe
        const client = await this.prisma.client.findUnique({
            where: { id: data.clientId }
        });

        if (!client) {
            throw new NotFoundException(`Client ${data.clientId} non trouvé`);
        }

        // 2. Valider les lignes (si c'est un objet JSON)
        if (!data.lignes || (Array.isArray(data.lignes) && data.lignes.length === 0)) {
            // Allow empty lines if it's an AVOIR (auto-generated) or strict? 
            // Usually Avoir copies lines. So we should be good.
            throw new BadRequestException('La facture doit contenir au moins une ligne');
        }

        // 3. Generate number based on status
        const type = data.type; // FACTURE, DEVIS, AVOIR, BL
        let numero = '';

        if (data.statut === 'BROUILLON' || data.statut === 'DEVIS_EN_COURS') {
            // Temporary number for drafts/in-progress devis
            numero = `Devis - ${new Date().getTime()} `;
        } else {
            numero = await this.generateNextNumber(type);
        }

        console.log('💾 Creating facture with proprietes:', data.proprietes);

        // 4. Créer la facture
        // 4. Créer la facture
        // 4. Créer la facture - FIX: Sanitize input to remove nested relations
        const { client: ignoredClient, paiements, fiche, ...cleanData } = data as any;

        // Guard: Verify all products are received before validation
        if (data.statut === 'VALIDE') {
            await this.verifyProductsAreReceived(data.lignes, data.type);
        }

        // Handle vendeurId if passed, otherwise try to resolve from userId
        let vendeurId = data.vendeurId || (data.proprietes as any)?.vendeurId;
        if (!vendeurId && userId) {
            const user = await this.prisma.user.findUnique({
                where: { id: userId },
                include: { employee: true }
            });
            if (user?.employee) {
                console.log(`👤 [FacturesService] Auto-resolved vendeurId ${user.employee.id} from userId ${userId}`);
                vendeurId = user.employee.id;
            }
        }

        let facture;
        try {
            facture = await this.prisma.facture.create({
                data: {
                    ...cleanData,
                    numero,
                    statut: data.statut || 'BROUILLON',
                    resteAPayer: data.totalTTC || 0,
                    vendeurId: vendeurId || null
                }
            });
        } catch (error) {
            if (error.code === 'P2002' && error.meta?.target?.includes('ficheId')) {
                console.warn(`⚠️ Invoice already exists for ficheId ${cleanData.ficheId}. Switching to UPDATE/UPSERT strategy.`);

                // Fetch existing invoice
                const existing = await this.prisma.facture.findFirst({
                    where: { ficheId: cleanData.ficheId }
                });

                if (existing) {
                    console.log(`🔄 [CONFLICT Handled] Converting existing invoice ${existing.id} (${existing.statut}) to target status: ${data.statut}`);

                    // [FIX] Exclude 'numero' from the update payload. 
                    // We must NOT try to change the number of an existing invoice during this recovery.
                    const { numero, ...updateData } = data;

                    return this.update({
                        where: { id: existing.id },
                        data: {
                            ...updateData,
                            proprietes: {
                                ...(existing.proprietes as any || {}),
                                ...(data.proprietes || {})
                            }
                        } as unknown as UpdateFactureDto
                    });
                }
            }
            throw error;
        }

        console.log('✅ Facture created with proprietes:', facture.proprietes);

        const isOfficial = facture.type === 'FACTURE' || facture.type === 'BON_COMM' || facture.type === 'BL';
        const isInstance = facture.statut === 'VENTE_EN_INSTANCE' || facture.statut === 'BON_DE_COMMANDE';
        const isValidated = facture.statut === 'VALIDE' || facture.statut === 'PAYEE' || facture.statut === 'PARTIEL';

        const shouldDecrement = (isOfficial && (isInstance || isValidated)) ||
            (facture.proprietes as any)?.forceStockDecrement === true;

        if (shouldDecrement) {
            await this.decrementStockForInvoice(this.prisma, facture, userId);
            await this.loyaltyService.awardPointsForPurchase(facture.id);

            // [NEW] Commission Trigger
            if ((facture as any).vendeurId) {
                try {
                    await this.commissionService.calculateForInvoice(facture.id);
                } catch (e) {
                    console.error('⚠️ [COMMISSION] Failed to calculate commissions during creation:', e);
                }
            }

            // Deduct points if used
            const pointsUtilises = (facture.proprietes as any)?.pointsUtilises;
            if (pointsUtilises > 0) {
                await this.loyaltyService.spendPoints(
                    facture.clientId,
                    pointsUtilises,
                    `Utilisation de points sur facture ${facture.numero} `,
                    facture.id
                );
            }
        }

        return facture;
    }

    private async generateNextNumber(type: string, tx?: any): Promise<string> {
        const year = new Date().getFullYear();
        const prefix = this.getPrefix(type);
        const prisma = tx || this.prisma;

        // Find last document starting with this prefix for current year
        // We search for both "PFX-YEAR-" and "PFX -YEAR-" formats to be safe
        const lastDoc = await prisma.facture.findFirst({
            where: {
                numero: {
                    contains: `${prefix}`
                },
                createdAt: {
                    gte: new Date(`${year}-01-01`),
                    lte: new Date(`${year}-12-31`)
                }
            },
            orderBy: {
                numero: 'desc'
            }
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
    private async decrementStockForInvoice(tx: any, invoice: any, userId?: string) {
        console.log(`🎬[DEBUG] Starting Stock Decrement for ${invoice.numero}(${invoice.id})`);

        // Load full invoice with line items to ensure we have the latest JSON data
        const fullInvoice = await tx.facture.findUnique({
            where: { id: invoice.id },
            include: { client: true }
        });

        if (!fullInvoice) {
            console.log(`❌[DEBUG] Invoice not found in DB: ${invoice.id} `);
            return;
        }

        const props = fullInvoice.proprietes as any || {};
        const forceDecrement = props.forceStockDecrement === true || props.forceStockDecrement === 'true';

        console.log(`🔍[DEBUG] Properties for ${fullInvoice.numero}: stockDecremented = ${props.stockDecremented}, forceStockDecrement = ${forceDecrement} `);

        if ((props.stockDecremented === true || props.stockDecremented === 'true')) {
            console.log(`⏩[DEBUG] SKIP: Stock already marked as decremented for ${fullInvoice.numero} (Idempotency enforced)`);
            return;
        }

        // Parse lines safely
        let linesToProcess: any[] = [];
        try {
            linesToProcess = typeof fullInvoice.lignes === 'string' ? JSON.parse(fullInvoice.lignes) : (fullInvoice.lignes as any[]);
        } catch (e) {
            console.error(`❌[DEBUG] Failed to parse lines for ${fullInvoice.numero}: `, e);
        }

        if (!Array.isArray(linesToProcess) || linesToProcess.length === 0) {
            console.log(`⏩[DEBUG] SKIP: No lines to process in invoice ${fullInvoice.numero} `);
            return;
        }

        console.log(`📋[DEBUG] Found ${linesToProcess.length} lines.Processing...`);

        for (const line of linesToProcess) {
            const pid = line.productId;
            const qte = Number(line.qte);

            if (isNaN(qte) || qte <= 0) {
                console.log(`   🚫[DEBUG] Skipping line: "${line.description}"(Invalid Qty: ${qte})`);
                continue;
            }

            console.log(`   🔎[DEBUG] Eval: "${line.description}" | PID: ${pid} | Qty: ${qte} `);

            let product: any = null;
            if (pid) {
                product = await tx.product.findUnique({
                    where: { id: pid },
                    include: { entrepot: true }
                });
            }

            // FALLBACK: Model-Based Matching if PID not found or from wrong center
            // (Common in inter-center transfers where PID changes)
            // Use fullInvoice.centreId (if available) or fullInvoice.client.centreId
            const invoiceCentreId = fullInvoice.centreId || fullInvoice.client?.centreId;

            if (!product || (product.entrepot?.centreId !== invoiceCentreId && invoiceCentreId)) {
                console.log(`   🔄[DEBUG] Falling back to model-based search for: "${line.description}" (Product Wh: ${product?.entrepot?.centreId || 'None'} vs Invoice Centre: ${invoiceCentreId})`);

                const targetCentreId = invoiceCentreId;

                if (targetCentreId) {
                    const localMatch = await this.productsService.findLocalCounterpart({
                        designation: (line.designation || line.description || '').trim(),
                        codeInterne: (line.codeInterne || line.reference || '').trim(),
                        codeBarres: (line.codeBarres || '').trim(),
                        centreId: targetCentreId
                    });

                    if (localMatch) {
                        console.log(`   ✨[DEBUG] Found local counterpart: ${localMatch.id} (${localMatch.designation})`);
                        product = localMatch as any;
                    } else {
                        console.log(`   ⚠️ [DEBUG] No local counterpart found for: "${line.description}" in center ${targetCentreId}`);
                    }
                }
            }

            if (!product) {
                console.log(`   ❌[DEBUG] Product NOT FOUND locally: ${pid} (${line.description})`);
                continue;
            }

            const entrepotType = product.entrepot?.type;
            const entrepotId = line.entrepotId || product.entrepotId; // Use line warehouse if specified
            const forceDecrement = props.forceStockDecrement === true || props.forceStockDecrement === 'true';

            // BROADEN ELIGIBILITY: Allow all warehouses for invoices/avoirs
            const isEligible = !!entrepotId;

            console.log(`   📊[DEBUG] Product: ${product.designation} | Warehouse: ${entrepotType || 'None'} | Force: ${forceDecrement} | Eligible: ${isEligible} | Type: ${fullInvoice.type} `);

            if (isEligible) {
                const actionDesc = fullInvoice.type === 'AVOIR' ? 'Incrementing' : 'Decrementing';

                // [FIX] Movement quantity should be negative for exits (SORTIE_VENTE)
                const moveQty = fullInvoice.type === 'AVOIR' ? qte : -qte;

                const stockChange = fullInvoice.type === 'AVOIR' ? { increment: qte } : { decrement: qte };
                const moveType = fullInvoice.type === 'AVOIR' ? 'ENTREE_RETOUR' : 'SORTIE_VENTE';

                // [STRICT CHECK] Prevent negative stock for sales
                if (fullInvoice.type !== 'AVOIR' && product.quantiteActuelle < qte) {
                    const msg = `Stock insuffisant pour "${product.designation}" (Réf: ${line.reference || 'N/A'}). Disponible: ${product.quantiteActuelle}, Requis: ${qte}`;
                    console.error(`❌[STOCK] ${msg}`);
                    throw new BadRequestException(msg);
                }


                await tx.product.update({
                    where: { id: product.id },
                    data: { quantiteActuelle: stockChange }
                });

                // Log movement
                await tx.mouvementStock.create({
                    data: {
                        type: moveType,
                        quantite: moveQty, // [FIXED] Signed quantity
                        produitId: product.id,
                        entrepotSourceId: fullInvoice.type === 'AVOIR' ? null : entrepotId,
                        entrepotDestinationId: fullInvoice.type === 'AVOIR' ? entrepotId : null,
                        factureId: fullInvoice.id,
                        prixAchatUnitaire: product.prixAchatHT,
                        prixVenteUnitaire: fullInvoice.type === 'AVOIR' ? undefined : line.prixUnitaireTTC,
                        motif: `Facturation ${fullInvoice.numero} (${fullInvoice.statut})`,
                        utilisateur: userId ? `User ${userId} ` : 'System',
                        userId: userId || null,
                        dateMovement: new Date()
                    }
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
                    forceStockDecrement: false, // ALWAYS clear force flag after we actually do it
                    dateStockDecrement: new Date()
                }
            }
        });
        console.log(`🎬[DEBUG] Stock Decrement Complete & Flagged for ${fullInvoice.numero}`);
    }


    async verifyProductsAreReceived(lignes: any[], type?: string) {
        if (type === 'AVOIR' || type === 'AVOIR_FOURNISSEUR' || type === 'BON_COMM') return;
        if (!Array.isArray(lignes)) return;

        for (const line of lignes) {
            const pid = line.productId;
            if (!pid) continue;

            let product = await this.prisma.product.findUnique({
                where: { id: pid },
                select: { id: true, designation: true, specificData: true, entrepot: { select: { centreId: true } } }
            });

            // FALLBACK logic: if PID is from another center, find local counterpart to check its status
            if (product && product.entrepot?.centreId && type !== 'AVOIR') {
                // We need the center context. If we don't have an invoice object here, 
                // we might need to assume the center of the first product or pass centreId.
                // But usually, verifyProductsAreReceived is called with lines that SHOULD be local.
                const sd = (product.specificData as any) || {};
                if (sd.pendingIncoming) {
                    const status = sd.pendingIncoming.status || 'RESERVED';
                    const detail = status === 'SHIPPED' ? 'en cours d\'expédition' : 'réservé à la source';
                    throw new BadRequestException(
                        `Impossible de valider la facture : le produit "${product.designation}" est ${detail} (Transfert en cours). ` +
                        `Veuillez d'abord confirmer la réception du produit pour alimenter le stock local.`
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
        const { skip, take = 50, cursor, where, orderBy } = params;
        const factures = await this.prisma.facture.findMany({
            skip,
            take,
            cursor,
            where,
            orderBy,
            include: {
                client: true,
                fiche: true,
                paiements: true
            }
        });

        // [AUTO-REPAIR] Transition DEVIS with payments to BON_COMM
        // This fixes legacy Devis that missed the real-time transition trigger
        const needsRepair = factures.filter(f => f.type === 'DEVIS' && (f.paiements?.length > 0 || f.statut === 'PARTIEL' || f.statut === 'PAYEE'));

        if (needsRepair.length > 0) {
            console.log(`🔧 [AUTO-REPAIR] Found ${needsRepair.length} paid Devis to transition to BC.`);
            for (const f of needsRepair) {
                const newNumero = await this.generateNextNumber('BON_COMM');
                await this.prisma.facture.update({
                    where: { id: f.id },
                    data: {
                        type: 'BON_COMM',
                        statut: 'VENTE_EN_INSTANCE',
                        numero: newNumero
                    }
                });
                f.type = 'BON_COMM';
                f.statut = 'VENTE_EN_INSTANCE';
                f.numero = newNumero;
            }
        }

        return factures;
    }



    async findOne(id: string) {
        return this.prisma.facture.findUnique({
            where: { id },
            include: {
                client: true,
                fiche: true,
                paiements: true
            }
        });
    }

    // Helper: Restore Stock for Cancelled Invoice (Increments stock back)
    private async restoreStockForCancelledInvoice(tx: any, invoice: any) {
        console.log(`🔄[DEBUG] Starting Stock Restoration for ${invoice.numero}(${invoice.id})`);

        const fullInvoice = await tx.facture.findUnique({
            where: { id: invoice.id },
            include: { client: true }
        });

        if (!fullInvoice) return;

        const props = (fullInvoice.proprietes as any) || {};
        if (!props.stockDecremented) {
            console.log(`⏩[DEBUG] Stock was never decremented for ${fullInvoice.numero}. Skipping.`);
            return;
        }

        // Parse lines safely
        let linesToProcess: any[] = [];
        try {
            linesToProcess = typeof fullInvoice.lignes === 'string' ? JSON.parse(fullInvoice.lignes) : (fullInvoice.lignes as any[]);
        } catch (e) {
            console.error(`❌[DEBUG] Failed to parse lines for restoration of ${fullInvoice.numero}: `, e);
        }

        const invoiceCentreId = fullInvoice.centreId || fullInvoice.client?.centreId;

        for (const line of linesToProcess) {
            const qte = Number(line.qte);
            const pid = line.productId;
            if (!pid || isNaN(qte) || qte <= 0) continue;

            let product = await tx.product.findUnique({
                where: { id: pid },
                include: { entrepot: true }
            });

            // Fallback matching
            if (!product || (product.entrepot?.centreId !== invoiceCentreId && invoiceCentreId)) {
                const targetCentreId = invoiceCentreId;
                if (targetCentreId) {
                    const localMatch = await this.productsService.findLocalCounterpart({
                        designation: (line.designation || line.description || '').trim(),
                        codeInterne: (line.codeInterne || line.reference || '').trim(),
                        codeBarres: (line.codeBarres || '').trim(),
                        centreId: targetCentreId
                    });
                    if (localMatch) product = localMatch as any;
                }
            }

            if (product) {
                await tx.product.update({
                    where: { id: product.id },
                    data: { quantiteActuelle: { increment: qte } }
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
                        dateMovement: new Date()
                    }
                });
                console.log(`   ✅[DEBUG] Restored ${qte} for ${product.designation}`);
            }
        }

        // Mark as stock restored
        await tx.facture.update({
            where: { id: invoice.id },
            data: {
                proprietes: {
                    ...(fullInvoice.proprietes as any || {}),
                    stockDecremented: false, // Reset flag
                    stockRestored: true,
                    restoredAt: new Date()
                }
            }
        });
    }

    async update(params: {
        where: Prisma.FactureWhereUniqueInput;
        data: UpdateFactureDto;
    }, userId?: string) {
        return this.prisma.$transaction(async (tx) => {
            const { where, data } = params;

            if (data.statut === 'VALIDE' || data.type === 'BON_COMM' || data.statut === 'VENTE_EN_INSTANCE' || data.statut === 'PAYEE' || data.statut === 'PARTIEL') {

                const currentFacture = await tx.facture.findUnique({
                    where,
                    include: { paiements: true, client: true }
                });




                // [FIX] Robust Devis Check: Match any document that IS a devis/draft
                // EXCLUDE: Established BCs and Factures to prevent redundant transition logic
                const num = (currentFacture?.numero || '').trim().toUpperCase();
                const isCurrentlyDevis = currentFacture &&
                    currentFacture.type !== 'BON_COMM' &&
                    currentFacture.type !== 'FACTURE' &&
                    (
                        currentFacture.type === 'DEVIS' ||
                        currentFacture.statut === 'BROUILLON' ||
                        num.startsWith('DEV') ||
                        num.startsWith('BRO') ||
                        num.includes('DEVIS')
                    );

                // [NEW] Transition DEVIS/BROUILLON -> Real Document (Number Regeneration)
                // This covers "Passer Commande" or "Valider la vente"
                if (isCurrentlyDevis && (data.type === 'BON_COMM' || data.type === 'FACTURE' || data.type === 'BL')) {
                    const stockCheck = await this.checkStockAvailability(currentFacture.id);
                    if (stockCheck.hasConflicts) {
                        console.error(`❌ [STOCK GUARD] Blocked transition for ${currentFacture.numero}: products missing.`, stockCheck.conflicts);
                        throw new ConflictException({
                            message: 'Impossible de transformer : certains produits sont en rupture de stock.',
                            conflicts: stockCheck.conflicts
                        });
                    }

                    console.log(`📌 [TRANSITION] Document ${currentFacture.numero} becoming ${data.type}. Regenerating number.`);

                    // Ensure the target type is set correctly (in case it wasn't explicitly provided but transition triggered)
                    const targetType = data.type;
                    data.numero = await this.generateNextNumber(targetType, tx);

                    // [FIX] If transitioning to BON_COMM, force the status to VENTE_EN_INSTANCE to prevent premature "VALIDE" (Facture) status
                    if (data.type === 'BON_COMM') {
                        data.statut = 'VENTE_EN_INSTANCE';
                    }
                }




                // [FIX] STRENGTHENED FISCAL TRIGGER
                // CRITICAL: Only trigger fiscal flow if this is the FIRST validation OR if amount changed
                // IMPORTANT: Allow BC→FACTURE transition by checking TARGET type, not current type
                const isBecomingValid = (data.statut === 'VALIDE');

                // Only block fiscal flow if the TARGET is BON_COMM (not if the current is BC)
                // This allows BC→FACTURE transitions to work properly
                const isTargetingBC = (data.type === 'BON_COMM' || (data.numero && data.numero.startsWith('BC')));

                // First validation = Any document (BROUILLON, DEVIS, VENTE_EN_INSTANCE) that validates without an official number
                const isFirstValidation = !currentFacture?.numero?.startsWith('FAC');

                // Amount changed = totalTTC differs by more than 0.1 MAD
                const amountChanged = data.totalTTC !== undefined && Math.abs((data.totalTTC || 0) - (currentFacture?.totalTTC || 0)) > 0.1;

                // Trigger fiscal flow if:
                // 1. Status is becoming VALIDE
                // 2. Target is NOT BON_COMM (allows BC→FACTURE)
                // 3. Either first validation OR amount changed OR forceFiscal flag
                const forceFiscal = (data.proprietes as any)?.forceFiscal === true;
                const shouldTriggerFiscalFlow = isBecomingValid && !isTargetingBC && (isFirstValidation || amountChanged || forceFiscal);

                console.log(`🧐 [FISCAL FLOW CHECK] BecomingValid=${isBecomingValid}, isTargetingBC=${isTargetingBC}, FirstValidation=${isFirstValidation}, AmountChanged=${amountChanged}, ForceFiscal=${forceFiscal}, CurrentType=${currentFacture?.type}, TargetType=${data.type}`);


                if (currentFacture && shouldTriggerFiscalFlow) {
                    await this.verifyProductsAreReceived(currentFacture.lignes as any[], 'FACTURE');
                    console.log(`🚀[FISCAL FLOW] STARTING conversion for ${currentFacture.numero}`);

                    const targetType = data.type || currentFacture.type;
                    const newNumero = await this.generateNextNumber(targetType, tx); // Generate new number early
                    const isOfficial = currentFacture.numero.trim().startsWith('FAC');

                    if (isOfficial) {
                        // 1a. OFFICIAL INVOICE -> Create AVOIR (Cancel via Credit Note)
                        console.log(`ℹ️ [FISCAL] Converting OFFICIAL invoice ${currentFacture.numero}. Generating AVOIR.`);

                        const avoirData: Prisma.FactureUncheckedCreateInput = {
                            type: 'AVOIR',
                            statut: 'VALIDE',
                            numero: await this.generateNextNumber('AVOIR', tx),
                            dateEmission: new Date(),
                            clientId: currentFacture.clientId,
                            centreId: currentFacture.centreId,
                            lignes: (currentFacture.lignes as any[]).map(ligne => ({
                                ...ligne,
                                prixUnitaireTTC: -ligne.prixUnitaireTTC,
                                totalTTC: -ligne.totalTTC
                            })),
                            totalHT: -currentFacture.totalHT,
                            totalTVA: -currentFacture.totalTVA,
                            totalTTC: -currentFacture.totalTTC,
                            resteAPayer: 0,
                            proprietes: {
                                ...(currentFacture.proprietes as any || {}),
                                stockDecremented: false, // Force Avoir to trigger stock increment (Restoration)
                                factureOriginale: currentFacture.numero,
                                ficheId: currentFacture.ficheId,
                                raison: 'Annulation automatique lors de la validation',
                                isAutoGenerated: true
                            }
                        };

                        const autoAvoir = await tx.facture.create({ data: avoirData as any });
                        console.log('✅ Auto-Avoir created:', autoAvoir.numero);

                        // Trigger Stock Restoration via Avoir Logic
                        const draftWasDecremented = (currentFacture.proprietes as any)?.stockDecremented === true || (currentFacture.proprietes as any)?.stockDecremented === 'true';
                        if (draftWasDecremented) {
                            console.log(`🔄[FISCAL] Original was decremented. Restoring via Avoir.`);
                            await this.decrementStockForInvoice(tx, autoAvoir, userId);
                        }
                    } else {
                        // 1b. DRAFT/DEVIS -> Silent Restoration (No Avoir needed)
                        console.log(`ℹ️ [FISCAL] Converting DRAFT ${currentFacture.numero}. Skipping AVOIR, restoring stock directly.`);

                        // Use helper to restore stock on the original document ID
                        await this.restoreStockForCancelledInvoice(tx, currentFacture);
                    }

                    // 2. Prepare Valid Invoice Data (Official Number)
                    // Note: generateNextNumber checks DB. In transaction, we might need to be careful.
                    // But assume low concurrency for now or that it sees committed stats? 
                    // Prisma transaction holds connection. generateNextNumber uses `this.prisma` (outside tx).
                    // Better: Get number BEFORE transaction to avoid locking/complexity, or use `tx` inside if refactored.
                    // For now, I'll allow `this.generateNextNumber` (non-tx) but it might miss the AVOIR increment if run strictly parallel?
                    // But here we generate FACTURE number. Avoir is AVOIR type. Distinct sequences. Safe.

                    const officialNumber = await this.generateNextNumber(targetType, tx); // Validating a DEVIS creates the target type
                    const { client, paiements, fiche, ...existingFlat } = currentFacture as any;
                    const { client: dClient, paiements: dPai, fiche: dFiche, ...incomingData } = data as any;

                    // Merge Existing with Incoming (Incoming takes precedence for lines, proprietes, totals)
                    // CRITICAL: Ensure we don't carry over "stock already decremented" from the draft
                    // because we want the official invoice to run its own check, 
                    // especially since we use forceStockDecrement: true upon validation.
                    const cleanProprietes = {
                        ...(existingFlat.proprietes || {}),
                        ...(incomingData.proprietes || {}),
                        stockDecremented: false, // Reset flag for new FAC- numbering
                        dateStockDecrement: null,
                        ancienneReference: currentFacture.numero,
                        source: 'Validation Directe',
                        forceStockDecrement: true // Ensure the new invoice triggers stock decrement
                    };

                    // [FIX] Explicitly map lines to ensure productId is carried over
                    // Spreading ensures we don't lose any existing JSON data
                    const originalLines = (currentFacture as any).lignes || [];
                    const newLinesInput = originalLines.map(line => ({
                        ...line,
                        // Override specific fields if needed
                    }));

                    const newInvoiceData: Prisma.FactureUncheckedCreateInput = {
                        ...existingFlat,
                        ...incomingData,
                        proprietes: cleanProprietes, // Includes forceStockDecrement: true
                        numero: officialNumber,
                        statut: 'VALIDE',
                        dateEmission: new Date(),
                        createdAt: new Date(),
                        updatedAt: new Date(),
                        type: data.type || 'FACTURE',
                        clientId: currentFacture.clientId,
                        centreId: currentFacture.centreId,
                        lignes: newLinesInput as any
                    };

                    // Remove fields that would cause conflicts or errors
                    delete (newInvoiceData as any).id;
                    delete (newInvoiceData as any).ficheId; // Re-linked after draft is freed
                    delete (newInvoiceData as any).client;
                    delete (newInvoiceData as any).paiements;
                    delete (newInvoiceData as any).fiche;
                    delete (newInvoiceData as any).parentFactureId;

                    const newInvoice = await tx.facture.create({
                        data: newInvoiceData as any
                    });
                    console.log('✅ New Valid Invoice created with merged lines:', newInvoice.numero);


                    // 4. Move Payments from Old -> New
                    // Fetch directly from DB inside transaction to ensure we get all payments
                    const paymentsToMove = await tx.paiement.findMany({
                        where: { factureId: currentFacture.id }
                    });

                    const totalPaid = paymentsToMove.reduce((acc, p) => acc + Number(p.montant), 0);
                    console.log(`💰 [FISCAL] Moving ${paymentsToMove.length} payments totaling ${totalPaid} DH from ${currentFacture.numero} to ${newInvoice.numero}`);

                    if (paymentsToMove.length > 0) {
                        await tx.paiement.updateMany({
                            where: { factureId: currentFacture.id },
                            data: { factureId: newInvoice.id }
                        });
                    }

                    // 5. Update Old Draft: Cancel + Clear Balance
                    await tx.facture.update({
                        where: { id: currentFacture.id },
                        data: {
                            statut: 'ANNULEE',
                            resteAPayer: 0,
                            ficheId: null, // Free up the Fiche linkage
                            proprietes: {
                                ...(currentFacture.proprietes as any || {}),
                                ficheId: currentFacture.ficheId // Preserve Fiche ID in proprietes
                            },
                            notes: `Remplacée par facture ${newInvoice.numero} `
                        }
                    });

                    // 6. Check Payment Status for New Invoice
                    let finalStatut = 'VALIDE';
                    // Use newInvoice.totalTTC - totalPaid to determine remaining
                    let reste = Math.max(0, Number(newInvoice.totalTTC) - totalPaid);

                    if (totalPaid >= Number(newInvoice.totalTTC) - 0.05) { // Tolerance for tiny FP diff
                        finalStatut = 'PAYEE';
                        reste = 0;

                        // Automatic Refund logic if OVERPAID (significant amount > 0.10)
                        if (totalPaid > Number(newInvoice.totalTTC) + 0.10) {
                            const diff = totalPaid - Number(newInvoice.totalTTC);
                            console.log(`🏦 [REFUND] Creating automatic refund payment: ${diff} DH`);
                            const refund = await tx.paiement.create({
                                data: {
                                    factureId: newInvoice.id,
                                    montant: -diff,
                                    mode: 'ESPECES',
                                    statut: 'DECAISSEMENT',
                                    date: new Date(),
                                    notes: 'Rendu monnaie / Trop-perçu après validation'
                                }
                            });
                            await this.paiementsService.handleCaisseIntegration(tx, refund, newInvoice);
                        }
                    } else if (totalPaid > 0) {
                        finalStatut = 'PARTIEL';
                    }

                    console.log(`📊 [FISCAL] New Invoice Status: ${finalStatut}, Paid: ${totalPaid}, Total: ${newInvoice.totalTTC}, Reste: ${reste}`);

                    // Link Fiche to New Invoice and update Status
                    const finalInvoice = await tx.facture.update({
                        where: { id: newInvoice.id },
                        data: {
                            ficheId: currentFacture.ficheId, // Re-link Fiche
                            statut: finalStatut,
                            resteAPayer: reste
                        }
                    });

                    // 7. STOCK DECREMENT LOGIC
                    await this.decrementStockForInvoice(tx, finalInvoice, userId);

                    // 7.5 COMMISSION CALCULATION
                    if ((finalInvoice as any).vendeurId) {
                        try {
                            await this.commissionService.calculateForInvoice(finalInvoice.id);
                        } catch (e) {
                            console.error('⚠️ [COMMISSION] Failed to calculate commissions:', e);
                        }
                    }

                    // 8. LOYALTY POINTS
                    await this.loyaltyService.awardPointsForPurchase(finalInvoice.id);

                    // 9. SPEND POINTS
                    const pointsUtilises = (finalInvoice.proprietes as any)?.pointsUtilises;
                    if (pointsUtilises > 0) {
                        await this.loyaltyService.spendPoints(
                            finalInvoice.clientId,
                            pointsUtilises,
                            `Utilisation de points sur facture ${finalInvoice.numero} `,
                            finalInvoice.id
                        );
                    }

                    return finalInvoice; // Return the NEW invoice so frontend redirects/updates
                }
            }

            // FIX: Sanitize input for update as well
            const { client, paiements, fiche, ...cleanData } = data as any;

            // [NEW] Balance Cleanup: If cancelling, force resteAPayer to 0
            if (cleanData.statut === 'ANNULEE') {
                cleanData.resteAPayer = 0;
            }

            // Guard: Verify products if status changes to VALIDE outside fiscal flow
            let currentRecord: any = null;
            if (cleanData.statut === 'VALIDE' || cleanData.proprietes) {
                currentRecord = await this.prisma.facture.findUnique({ where });

                // Merge properties if both exist
                if (currentRecord && cleanData.proprietes) {
                    const existingProps = currentRecord.proprietes as any || {};
                    const newProps = cleanData.proprietes as any || {};

                    cleanData.proprietes = {
                        ...existingProps,
                        ...newProps,
                        // [FIX] IDEMPOTENCY LATCH: 
                        // Verify we never lose the 'stockDecremented' flag if it was already true in DB.
                        // This prevents the frontend from accidentally resetting it via a partial update.
                        stockDecremented: existingProps.stockDecremented || newProps.stockDecremented
                    };
                }
            }

            if (cleanData.statut === 'VALIDE' && currentRecord) {
                await this.verifyProductsAreReceived(currentRecord.lignes as any[], cleanData.type || currentRecord.type);
            }

            // [DEBUG] Log data before update to diagnose P2002 error
            console.log('📝 [UPDATE DEBUG] Final Data passed to Prisma:', JSON.stringify(cleanData, null, 2));
            console.log('📝 [UPDATE DEBUG] Where clause:', JSON.stringify(where, null, 2));

            // [FIX] Check if facture exists before attempting update
            const existingFacture = await this.prisma.facture.findUnique({ where });
            if (!existingFacture) {
                throw new NotFoundException(`Facture with ID ${where.id} not found. It may have been deleted.`);
            }

            const updatedFacture = await this.prisma.facture.update({
                data: cleanData,
                where,
            });

            // [NEW] Logic: Stock Decrement on Validation, Instance, or Archive
            // Decrement if:
            // 1. Status is VALIDE (direct validation or validation after instance/transfer reception)
            // 2. Status is VENTE_EN_INSTANCE (allows negative stock for reserved transfers)
            // 3. Status is ARCHIVE/ANNULEE with forceStockDecrement flag
            if (updatedFacture.statut === 'VALIDE' ||
                updatedFacture.statut === 'VENTE_EN_INSTANCE' ||
                updatedFacture.statut === 'BON_DE_COMMANDE' ||
                (updatedFacture.proprietes as any)?.forceStockDecrement === true) {
                console.log('📦 Post-Update Stock Trigger (Validation, Instance, BC, or Archive)');
                await this.decrementStockForInvoice(this.prisma, updatedFacture, userId);

                // [NEW] Commission Trigger
                if ((updatedFacture as any).vendeurId) {
                    try {
                        await this.commissionService.calculateForInvoice(updatedFacture.id);
                    } catch (e) {
                        console.error('⚠️ [COMMISSION] Failed to calculate commissions:', e);
                    }
                }

                await this.loyaltyService.awardPointsForPurchase(updatedFacture.id);

                // Deduct points if used
                const pointsUtilises = (updatedFacture.proprietes as any)?.pointsUtilises;
                if (pointsUtilises > 0) {
                    await this.loyaltyService.spendPoints(
                        updatedFacture.clientId,
                        pointsUtilises,
                        `Utilisation de points sur facture ${updatedFacture.numero} `,
                        updatedFacture.id
                    );
                }
            }

            // [NEW] Logic: Stock Restoration for Cancelled Transfers
            // If sale is cancelled and restoreStock flag is set, increment stock to restore from -1 to 0
            if (updatedFacture.statut === 'ANNULEE' && (updatedFacture.proprietes as any)?.restoreStock === true) {
                console.log('🔄 Restoring stock for cancelled transfer sale');
                await this.restoreStockForCancelledInvoice(tx, updatedFacture);
            }

            return updatedFacture;
        });
    }

    async remove(where: Prisma.FactureWhereUniqueInput) {
        // 1. Get the invoice
        const facture = await this.prisma.facture.findUnique({
            where,
            include: { paiements: true }
        });

        if (!facture) {
            throw new NotFoundException('Facture non trouvée');
        }

        // Note: Cancelled invoices can be deleted, but this should be done with caution
        // as it removes audit trail. Consider using AVOIR instead for production.

        // 3. Logic: Last vs Middle
        // Check if it is the LAST official invoice of its type (and year)
        const isOfficial = !facture.numero.startsWith('BRO') && !facture.numero.startsWith('Devis');
        let isLast = false;

        if (isOfficial) {
            const year = new Date().getFullYear(); // Or year from invoice date? strict sequential usually means current year context.
            // Better: Check if any invoice exists with same type and a HIGHER number (alphanumerically or creation date)
            const nextInvoice = await this.prisma.facture.findFirst({
                where: {
                    type: facture.type,
                    numero: { gt: facture.numero, startsWith: this.getPrefix(facture.type) }
                }
            });
            isLast = !nextInvoice;
        } else {
            isLast = true; // Drafts are always "last" in sense of deletable safe
        }

        // 3. Execution
        if (isLast) {
            // Safe to delete physically
            // But check payments first?
            if (facture.paiements && facture.paiements.length > 0) {
                // Even if last, if payments exist, we probably shouldn't just vanish it without warning?
                // But user said "doit etre supprimer". If payments exist, usually we should delete payments too?
                // or Block?
                // "les facture valides doivent etre annuler par avoir... si cette facture a des facture generer apres, si nn on la supprime"
                // Implies: If last -> delete. (Implicitly delete payments? Or block if paid?)
                // Usually deleting an invoice DELETES its payments (Cascade in UI or DB?). Schema says Paiement->Facture onDelete: Cascade?
                // Let's check schema. Checked: `onDelete: Cascade`. So payments vanish.
                return this.prisma.facture.delete({ where });
            }
            return this.prisma.facture.delete({ where });
        } else {
            // Not Last -> Create AVOIR
            // Calculate negative amounts
            const lignesAvoir = (facture.lignes as any[]).map(l => ({
                ...l,
                prixUnitaireTTC: -Math.abs(l.prixUnitaireTTC),
                totalTTC: -Math.abs(l.totalTTC),
                description: `Avoir sur facture ${facture.numero}: ${l.description} `
            }));

            // Create Avoir
            const avoirNumero = await this.generateNextNumber('AVOIR');

            const avoir = await this.prisma.facture.create({
                data: {
                    numero: avoirNumero,
                    type: 'AVOIR',
                    clientId: facture.clientId,
                    statut: 'VALIDE', // Avoirs are usually effective immediately
                    dateEmission: new Date(),
                    totalHT: -Math.abs(facture.totalHT),
                    totalTVA: -Math.abs(facture.totalTVA),
                    totalTTC: -Math.abs(facture.totalTTC),
                    resteAPayer: 0, // Avoirs don't have "to pay" usually, or they offset balance.
                    lignes: lignesAvoir,
                    notes: `Annulation de la facture ${facture.numero} `,
                    proprietes: {
                        ...(facture.proprietes as any || {}),
                        ficheId: facture.ficheId // Store Fiche ID in proprietes
                    }
                }
            });

            // Mark original as ANNULEE
            await this.prisma.facture.update({
                where: { id: facture.id },
                data: {
                    statut: 'ANNULEE',
                    resteAPayer: 0
                }
            });

            return { action: 'AVOIR_CREATED', avoir };
        }
    }

    private getPrefix(type: string): string {
        switch (type) {
            case 'FACTURE': return 'FAC';
            case 'DEVIS': return 'DEV';
            case 'AVOIR': return 'AVR';
            case 'BL': return 'BL';
            case 'BON_COMM': return 'BC';
            default: return 'DOC';
        }
    }

    async createExchange(invoiceId: string, itemsToReturn: { lineIndex: number, quantiteRetour: number, reason: string, targetWarehouseId?: string }[], centreId: string) {
        if (!centreId) {
            throw new BadRequestException('ID du centre (Tenant) manquant pour cette opération');
        }
        console.log(`🔄[EXCHANGE] Starting Exchange for Facture ${invoiceId} in center ${centreId}`);

        const original = await this.prisma.facture.findUnique({
            where: { id: invoiceId },
            include: { paiements: true }
        });

        if (!original) throw new NotFoundException('Facture initiale non trouvée');

        // Parse lines
        const originalLines = (typeof original.lignes === 'string' ? JSON.parse(original.lignes) : original.lignes) as any[];

        return this.prisma.$transaction(async (tx) => {
            const newNumero = await this.generateNextNumber('FACTURE', tx);
            // A. Create Full Avoir
            const avoirNumero = await this.generateNextNumber('AVOIR', tx);
            const avoir = await tx.facture.create({
                data: {
                    numero: avoirNumero,
                    type: 'AVOIR',
                    statut: 'VALIDE',
                    clientId: original.clientId,
                    parentFactureId: original.id,
                    dateEmission: new Date(),
                    totalHT: -original.totalHT,
                    totalTVA: -original.totalTVA,
                    totalTTC: -original.totalTTC,
                    resteAPayer: 0,
                    lignes: originalLines.map(l => ({
                        ...l,
                        prixUnitaireTTC: -l.prixUnitaireTTC,
                        totalTTC: -l.totalTTC,
                        description: `Annulation: ${l.description || l.designation} `
                    })),
                    notes: `Avoir facture n° : ${original.numero} `,
                    proprietes: {
                        factureOriginale: original.numero,
                        raison: 'Echange / Modification',
                        ficheId: original.ficheId // Keep trace
                    },
                    centreId: original.centreId
                }
            });

            // B. Cancel Original & Detach Fiche
            await tx.facture.update({
                where: { id: original.id },
                data: {
                    statut: 'ANNULEE',
                    ficheId: null, // Critical: Release Fiche
                    resteAPayer: 0, // [NEW] Clear balance
                    notes: `Annulée et remplacée par ${newNumero}`
                }
            });

            // C. Handle Stock Return for Selected Items
            const defectiveWarehouse = await this.getOrCreateDefectiveWarehouse(tx, centreId);

            for (const item of itemsToReturn) {
                const line = originalLines[item.lineIndex];
                if (line) {
                    let productId = line.productId;

                    // Fallback: If productId is missing, try to find it by codeInterne extracted from description
                    if (!productId && line.description) {
                        const codeMatch = line.description.match(/MON\d+|LEN\d+|PRD\d+/i);
                        if (codeMatch) {
                            const code = codeMatch[0].toUpperCase();
                            const product = await tx.product.findFirst({
                                where: {
                                    codeInterne: code,
                                    entrepot: { centreId: original.centreId as string } // Search in the invoice's center
                                },
                                orderBy: { quantiteActuelle: 'desc' } // Prefer those with stock
                            });
                            if (product) productId = product.id;
                        }
                    }

                    if (productId) {
                        // Determine destination
                        let targetWarehouseId = item.targetWarehouseId || line.entrepotId;
                        if (item.reason === 'DEFECTUEUX') {
                            targetWarehouseId = defectiveWarehouse.id;
                        }

                        const productToUpdate = await tx.product.findUnique({ where: { id: productId } });

                        if (productToUpdate) {
                            // Find or Create Product in Target Warehouse
                            let targetProduct = productToUpdate;

                            if (targetWarehouseId && targetWarehouseId !== productToUpdate.entrepotId) {
                                const foundProduct = await tx.product.findFirst({
                                    where: { codeInterne: productToUpdate.codeInterne, entrepotId: targetWarehouseId }
                                });

                                if (foundProduct) {
                                    targetProduct = foundProduct;
                                } else {
                                    // Clone product to target warehouse
                                    const { id, entrepotId, createdAt, updatedAt, ...prodProps } = productToUpdate;
                                    targetProduct = await tx.product.create({
                                        data: {
                                            ...prodProps,
                                            entrepotId: targetWarehouseId,
                                            quantiteActuelle: 0,
                                            statut: 'DISPONIBLE'
                                        }
                                    } as any);
                                }
                            }

                            // Update Stock in Target Product
                            await tx.product.update({
                                where: { id: targetProduct.id },
                                data: {
                                    quantiteActuelle: { increment: item.quantiteRetour },
                                    statut: 'DISPONIBLE'
                                }
                            });

                            // Movement
                            await tx.mouvementStock.create({
                                data: {
                                    type: 'ENTREE_RETOUR_CLIENT',
                                    quantite: item.quantiteRetour,
                                    produitId: targetProduct.id,
                                    entrepotDestinationId: targetWarehouseId,
                                    entrepotSourceId: productToUpdate.entrepotId, // Track origin
                                    factureId: original.id,
                                    prixVenteUnitaire: line.prixUnitaireTTC || 0,
                                    motif: `Retour ${item.reason} ${original.numero}`,
                                    utilisateur: 'System'
                                }
                            });
                        }
                    }
                }
            }

            // D. Create New Invoice (Replacement)
            const newLines = originalLines.map((l, index) => {
                const returned = itemsToReturn.find(r => r.lineIndex === index);
                if (returned) {
                    // "le champs disigner pour la monture on le remplir par 'monture client' avec un prix 0 dh"
                    // Check if it's a frame or if it's explicitly the one to be replaced
                    const isMonture = l.designation?.toLowerCase().includes('monture') || l.description?.toLowerCase().includes('monture');

                    return {
                        ...l,
                        designation: isMonture ? 'Monture Client' : (l.designation || l.description),
                        description: isMonture ? 'Monture Client' : (l.description || l.designation),
                        prixUnitaireTTC: 0,
                        totalHT: 0,
                        totalTVA: 0,
                        totalTTC: 0,
                        remise: 0,
                        productId: null // Detach from stock
                    };
                }
                return l;
            });

            // Recalculate Totals
            const newTotalTTC = newLines.reduce((sum, l) => sum + l.totalTTC, 0);
            const newTotalHT = newLines.reduce((sum, l) => sum + (l.totalHT || 0), 0);
            const newTotalTVA = newLines.reduce((sum, l) => sum + (l.totalTVA || 0), 0);

            const newInvoice = await tx.facture.create({
                data: {
                    numero: newNumero,
                    type: 'FACTURE',
                    statut: 'VALIDE',
                    clientId: original.clientId,
                    centreId: original.centreId,
                    dateEmission: new Date(),
                    lignes: newLines,
                    totalHT: newTotalHT,
                    totalTVA: newTotalTVA,
                    totalTTC: newTotalTTC,
                    resteAPayer: newTotalTTC,
                    ficheId: original.ficheId, // Re-attach Fiche!
                    parentFactureId: original.id,
                    proprietes: {
                        ...(original.proprietes as any || {}),
                        factureOriginale: original.numero,
                        raison: 'Echange / Modification'
                    }
                }
            });

            // Transfer Payments
            const transferredPayments = await tx.paiement.findMany({
                where: { factureId: original.id }
            });
            const totalPaid = transferredPayments.reduce((sum, p) => sum + p.montant, 0);

            await tx.paiement.updateMany({
                where: { factureId: original.id },
                data: { factureId: newInvoice.id }
            });

            // [NEW] Automatic Refund logic for Exchange Flow
            if (totalPaid > newTotalTTC) {
                const diff = totalPaid - newTotalTTC;
                console.log(`🏦 [REFUND] Creating automatic refund during exchange: ${diff} DH`);
                const refund = await tx.paiement.create({
                    data: {
                        factureId: newInvoice.id,
                        montant: -diff,
                        mode: 'ESPECES',
                        statut: 'DECAISSEMENT',
                        date: new Date(),
                        notes: 'Rendu monnaie / Trop-perçu après échange'
                    }
                });
                await this.paiementsService.handleCaisseIntegration(tx, refund, newInvoice);
            }

            // Update resteAPayer on new invoice
            await tx.facture.update({
                where: { id: newInvoice.id },
                data: { resteAPayer: Math.max(0, newTotalTTC - totalPaid) }
            });

            return {
                avoir,
                newInvoice
            };
        });
    }



    async cleanupExpiredDrafts() {
        console.log('🧹 Cleaning up expired drafts...');
        const twoMonthsAgo = new Date();
        twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

        // Find unpaid drafts older than 2 months
        const expiredDrafts = await this.prisma.facture.findMany({
            where: {
                statut: 'BROUILLON',
                dateEmission: { lt: twoMonthsAgo },
                paiements: { none: {} } // No payments
            }
        });

        if (expiredDrafts.length > 0) {
            console.log(`🧹 Found ${expiredDrafts.length} expired drafts.Cancelling...`);

            // Bulk update (Prisma assumes same update for all)
            // or loop if we want to log each.
            await this.prisma.facture.updateMany({
                where: {
                    id: { in: expiredDrafts.map(d => d.id) }
                },
                data: {
                    statut: 'ANNULEE',
                    notes: 'Annulation automatique (Expiration > 2 mois sans paiement)'
                }
            });
            console.log('✅ Expired drafts cancelled.');
        } else {
            console.log('✨ No expired drafts found.');
        }
    }

    async migrateDraftsToDevis() {
        console.log('🔄 Migrating existing Drafts to Devis...');
        const result = await this.prisma.facture.updateMany({
            where: {
                statut: 'BROUILLON',
                type: 'FACTURE' // Change only those marked as FACTURE
            },
            data: {
                type: 'DEVIS'
            }
        });
        if (result.count > 0) {
            console.log(`✅ Migrated ${result.count} drafts to DEVIS.`);
        } else {
            console.log('✨ No drafts to migrate.');
        }
    }

    async migrateBroNumbersToDevis() {
        console.log('🔄 Migrating BRO- numbers to Devis-...');
        const drafts = await this.prisma.facture.findMany({
            where: {
                numero: { startsWith: 'BRO-' }
            }
        });

        let count = 0;
        for (const draft of drafts) {
            const newNumero = draft.numero.replace('BRO-', 'Devis-');
            await this.prisma.facture.update({
                where: { id: draft.id },
                data: { numero: newNumero }
            });
            count++;
        }

        if (count > 0) {
            console.log(`✅ Renamed ${count} drafts from BRO - to Devis -.`);
        } else {
            console.log('✨ No BRO- drafts to rename.');
        }
    }

    private async getOrCreateDefectiveWarehouse(tx: any, centreId: string) {
        let warehouse = await tx.entrepot.findFirst({
            where: {
                centreId,
                OR: [
                    { nom: { equals: 'Entrepot Défectueux', mode: 'insensitive' } },
                    { nom: { equals: 'DÉFECTUEUX', mode: 'insensitive' } },
                    { nom: { contains: 'défectueux', mode: 'insensitive' } }
                ]
            }
        });

        if (!warehouse) {
            warehouse = await tx.entrepot.create({
                data: {
                    nom: 'Entrepot Défectueux',
                    type: 'TRANSIT',
                    description: 'Entrepôt pour les retours défectueux et sorties de stock non consolidées',
                    centreId: centreId
                }
            });
        }
        return warehouse;
    }
}
