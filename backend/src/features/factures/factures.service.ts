import { Injectable, BadRequestException, NotFoundException, InternalServerErrorException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class FacturesService implements OnModuleInit {
    constructor(private prisma: PrismaService) { }

    async onModuleInit() {
        await this.cleanupExpiredDrafts();
        await this.migrateDraftsToDevis();
        await this.migrateBroNumbersToDevis();
    }

    async create(data: Prisma.FactureUncheckedCreateInput) {
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
            numero = `Devis-${new Date().getTime()}`;
        } else {
            numero = await this.generateNextNumber(type);
        }

        console.log('💾 Creating facture with proprietes:', data.proprietes);

        // 4. Créer la facture
        // 4. Créer la facture - FIX: Sanitize input to remove nested relations
        const { client: ignoredClient, paiements, fiche, ...cleanData } = data as any;

        const facture = await this.prisma.facture.create({
            data: {
                ...cleanData,
                numero,
                statut: data.statut || 'BROUILLON',
                resteAPayer: data.totalTTC || 0
            }
        });

        console.log('✅ Facture created with proprietes:', facture.proprietes);

        // [NEW] Decrement stock for VALIDE, VENTE_EN_INSTANCE, or ARCHIVE/ANNULEE with flag
        // Note: For transfers, this will decrement from 0 to -1 (reserved but not yet received)
        // Upon validation after reception, stock will be: received (+1) then sold (-1) = 0
        const shouldDecrement = facture.statut === 'VALIDE' ||
            (facture.proprietes as any)?.forceStockDecrement === true;

        if (shouldDecrement) {
            await this.decrementStockForInvoice(this.prisma, facture);
        }

        return facture;
    }

    private async generateNextNumber(type: string, tx?: any): Promise<string> {
        const year = new Date().getFullYear();
        const prefix = this.getPrefix(type);
        const prisma = tx || this.prisma;

        // Find last document of this type for current year
        const lastDoc = await prisma.facture.findFirst({
            where: {
                type: type,
                numero: {
                    startsWith: `${prefix}-${year}`
                }
            },
            orderBy: {
                numero: 'desc'
            }
        });

        let sequence = 1;
        if (lastDoc) {
            const parts = lastDoc.numero.split('-');
            if (parts.length === 3) {
                sequence = parseInt(parts[2]) + 1;
            }
        }

        return `${prefix}-${year}-${sequence.toString().padStart(3, '0')}`;
    }

    // Helper: Decrement Stock for Valid Invoice (Principal Warehouses)
    private async decrementStockForInvoice(tx: any, invoice: any) {
        console.log(`🎬 [DEBUG] Starting Stock Decrement for ${invoice.numero} (${invoice.id})`);

        // Load full invoice with line items to ensure we have the latest JSON data
        const fullInvoice = await tx.facture.findUnique({
            where: { id: invoice.id }
        });

        if (!fullInvoice) {
            console.log(`❌ [DEBUG] Invoice not found in DB: ${invoice.id}`);
            return;
        }

        const props = fullInvoice.proprietes as any || {};
        console.log(`🔍 [DEBUG] Properties for ${fullInvoice.numero}: stockDecremented=${props.stockDecremented}, forceStockDecrement=${props.forceStockDecrement}`);

        if (props.stockDecremented === true || props.stockDecremented === 'true') {
            console.log(`⏩ [DEBUG] SKIP: Stock already marked as decremented for ${fullInvoice.numero}`);
            return;
        }

        // Parse lines safely
        let linesToProcess: any[] = [];
        try {
            linesToProcess = typeof fullInvoice.lignes === 'string' ? JSON.parse(fullInvoice.lignes) : (fullInvoice.lignes as any[]);
        } catch (e) {
            console.error(`❌ [DEBUG] Failed to parse lines for ${fullInvoice.numero}:`, e);
        }

        if (!Array.isArray(linesToProcess) || linesToProcess.length === 0) {
            console.log(`⏩ [DEBUG] SKIP: No lines to process in invoice ${fullInvoice.numero}`);
            return;
        }

        console.log(`📋 [DEBUG] Found ${linesToProcess.length} lines. Processing...`);

        for (const line of linesToProcess) {
            const pid = line.productId;
            const qte = Number(line.qte);

            if (!pid || isNaN(qte) || qte <= 0) {
                console.log(`   🚫 [DEBUG] Skipping line: "${line.description}" (Invalid ProductID or Qty: ${qte})`);
                continue;
            }

            console.log(`   🔎 [DEBUG] Eval: "${line.description}" | PID: ${pid} | Qty: ${qte}`);

            const product = await tx.product.findUnique({
                where: { id: pid },
                include: { entrepot: true }
            });

            if (!product) {
                console.log(`   ❌ [DEBUG] Product NOT FOUND in database: ${pid}`);
                continue;
            }

            const entrepotType = product.entrepot?.type;
            const forceDecrement = props.forceStockDecrement === true;

            // Relax eligibility: PRINCIPAL, SECONDAIRE or any warehouse if forced (e.g. for Rabat instance sales)
            const isEligible = entrepotType === 'PRINCIPAL' || entrepotType === 'SECONDAIRE' || forceDecrement;

            console.log(`   📊 [DEBUG] Product: ${product.designation} | Warehouse: ${entrepotType || 'None'} | Force: ${forceDecrement} | Eligible: ${isEligible} | Type: ${fullInvoice.type}`);

            if (isEligible) {
                const actionDesc = fullInvoice.type === 'AVOIR' ? 'Incrementing' : 'Decrementing';
                console.log(`   📉 [DEBUG] ACTION: ${actionDesc} ${product.designation} by ${qte} (Current: ${product.quantiteActuelle})`);

                const stockChange = fullInvoice.type === 'AVOIR' ? { increment: qte } : { decrement: qte };
                const moveType = fullInvoice.type === 'AVOIR' ? 'ENTREE_RETOUR' : 'SORTIE_VENTE';
                const moveQty = fullInvoice.type === 'AVOIR' ? qte : -qte;

                await tx.product.update({
                    where: { id: product.id },
                    data: { quantiteActuelle: stockChange }
                });

                await tx.mouvementStock.create({
                    data: {
                        type: moveType,
                        quantite: moveQty,
                        produitId: product.id,
                        entrepotSourceId: product.entrepotId,
                        factureId: fullInvoice.id,
                        prixVenteUnitaire: fullInvoice.type === 'AVOIR' ? undefined : line.prixUnitaireTTC,
                        motif: `${fullInvoice.type} ${fullInvoice.numero} (${fullInvoice.statut})`,
                        utilisateur: 'System'
                    }
                });
                console.log(`   ✅ [DEBUG] Success: ${actionDesc} complete.`);
            } else {
                console.log(`   ⏩ [DEBUG] Ignoring: Wrong warehouse and no force flag.`);
            }
        }

        // Flag as processed
        await tx.facture.update({
            where: { id: fullInvoice.id },
            data: {
                proprietes: {
                    ...props,
                    stockDecremented: true,
                    dateStockDecrement: new Date()
                }
            }
        });
        console.log(`✅ [DEBUG] Stock process COMPLETED for ${fullInvoice.numero}`);
    }

    async findAll(params: {
        skip?: number;
        take?: number;
        cursor?: Prisma.FactureWhereUniqueInput;
        where?: Prisma.FactureWhereInput;
        orderBy?: Prisma.FactureOrderByWithRelationInput;
    }) {
        const { skip, take, cursor, where, orderBy } = params;
        return this.prisma.facture.findMany({
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

    // Helper: Restore Stock for Cancelled Invoice (Increment from -1 to 0)
    private async restoreStockForCancelledInvoice(tx: any, invoice: any) {
        console.log(`🔄 [DEBUG] Starting Stock Restoration for ${invoice.numero} (${invoice.id})`);

        const fullInvoice = await tx.facture.findUnique({
            where: { id: invoice.id }
        });

        if (!fullInvoice) {
            console.log(`❌ [DEBUG] Invoice not found: ${invoice.id}`);
            return;
        }

        const props = (fullInvoice.proprietes as any) || {};
        if (!props.stockDecremented) {
            console.log(`⏩ [DEBUG] Stock was never decremented for ${fullInvoice.numero}. Skipping restoration.`);
            return;
        }

        const lines = (fullInvoice.lignes as any[]) || [];
        console.log(`📋 [DEBUG] Found ${lines.length} lines to restore stock for`);

        for (const line of lines) {
            if (!line.productId || !line.entrepotId) {
                console.log(`⏩ [DEBUG] Skipping line without product/warehouse: ${line.designation}`);
                continue;
            }

            try {
                // Increment stock by 1 to restore from -1 to 0
                const updated = await tx.product.update({
                    where: { id: line.productId },
                    data: { quantiteActuelle: { increment: 1 } }
                });

                console.log(`✅ [DEBUG] Restored stock for ${line.designation}: ${updated.quantiteActuelle - 1} → ${updated.quantiteActuelle}`);

                // Create stock movement record - FIX FIELD NAMES
                await tx.mouvementStock.create({
                    data: {
                        produitId: line.productId,
                        entrepotSourceId: line.entrepotId, // Correct field name
                        factureId: invoice.id,
                        type: 'AJUSTEMENT',
                        quantite: 1,
                        motif: `Annulation vente ${invoice.numero} - Transfert annulé`,
                        utilisateur: 'System', // Required field
                        dateMovement: new Date() // Correct field name
                    }
                });
            } catch (err) {
                console.error(`❌ [DEBUG] Error restoring stock for product ${line.productId}:`, err);
            }
        }

        // Mark as stock restored
        await tx.facture.update({
            where: { id: invoice.id },
            data: {
                proprietes: {
                    ...(fullInvoice.proprietes as any || {}),
                    stockRestored: true,
                    restoredAt: new Date()
                }
            }
        });

        console.log(`✅ [DEBUG] Stock restoration complete for ${invoice.numero}`);
    }

    async update(params: {
        where: Prisma.FactureWhereUniqueInput;
        data: Prisma.FactureUpdateInput;
    }) {
        const { where, data } = params;
        console.log('🔄 FacturesService.update called with:', {
            id: where.id,
            statut: data.statut,
            proprietes: data.proprietes,
            forceStockDecrement: (data.proprietes as any)?.forceStockDecrement
        });

        // Check if we are validating a BROUILLON (BROUILLON → VALIDE)
        if (data.statut === 'VALIDE') {
            const currentFacture = await this.prisma.facture.findUnique({
                where,
                include: { paiements: true, client: true }
            });

            const isDraftNumber = currentFacture?.numero?.startsWith('BRO') ||
                currentFacture?.numero?.startsWith('Devis') ||
                currentFacture?.numero?.startsWith('DEV') ||
                currentFacture?.numero?.startsWith('BL');
            const isTargetStatus = ['BROUILLON', 'VENTE_EN_INSTANCE', 'PARTIEL', 'PAYEE', 'VALIDE'].includes(currentFacture?.statut || '');

            // Trigger fiscal traceability flow if:
            // The document has a draft number (BRO-xxx or Devis-xxx) and we are validating it.
            // This ensures any "Draft" state document gets an official FAC- number.
            console.log(`📋 [FISCAL FLOW CHECK] Invoice ${currentFacture?.numero}: id=${currentFacture?.id}, status=${currentFacture?.statut}, isDraftNumber=${isDraftNumber}, isTargetStatus=${isTargetStatus}`);
            if (currentFacture && isDraftNumber && isTargetStatus) {
                console.log(`🚀 [FISCAL FLOW] STARTING conversion for ${currentFacture.numero}`);

                return this.prisma.$transaction(async (tx) => {
                    // 1. Create AVOIR (Cancel Draft)
                    const avoirData: Prisma.FactureUncheckedCreateInput = {
                        type: 'AVOIR',
                        statut: 'VALIDE',
                        numero: await this.generateNextNumber('AVOIR', tx), // Improved: Use transaction client
                        dateEmission: new Date(),
                        clientId: currentFacture.clientId,
                        // No FicheID on Avoir
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
                            factureOriginale: currentFacture.numero,
                            ficheId: currentFacture.ficheId, // Store Fiche ID in proprietes due to unique constraint
                            raison: 'Annulation automatique du brouillon lors de la validation'
                        }
                    };
                    const avoir = await tx.facture.create({ data: avoirData });
                    console.log('✅ AVOIR created:', avoir.numero);

                    // 2. Prepare Valid Invoice Data (Official Number)
                    // Note: generateNextNumber checks DB. In transaction, we might need to be careful.
                    // But assume low concurrency for now or that it sees committed stats? 
                    // Prisma transaction holds connection. generateNextNumber uses `this.prisma` (outside tx).
                    // Logic fix: pass `tx` to generateNextNumber? Or just run it. 
                    // `generateNextNumber` is private. Let's call it before transaction or assume it's fine.
                    // Better: Get number BEFORE transaction to avoid locking/complexity, or use `tx` inside if refactored.
                    // For now, I'll allow `this.generateNextNumber` (non-tx) but it might miss the AVOIR increment if run strictly parallel?
                    // But here we generate FACTURE number. Avoir is AVOIR type. Distinct sequences. Safe.

                    const officialNumber = await this.generateNextNumber('FACTURE', tx); // Validating a DEVIS creates a FACTURE
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

                    const newInvoiceData: Prisma.FactureUncheckedCreateInput = {
                        ...existingFlat,
                        ...incomingData,
                        proprietes: cleanProprietes,
                        id: undefined, // New ID
                        numero: officialNumber,
                        statut: 'VALIDE', // New starts as Valid
                        dateEmission: new Date(),
                        createdAt: new Date(),
                        updatedAt: new Date(),
                        ficheId: undefined, // Will link after unlinking old
                        clientId: currentFacture.clientId,
                        type: 'FACTURE'
                    };

                    const newInvoice = await tx.facture.create({ data: newInvoiceData });
                    console.log('✅ New Valid Invoice created with merged lines:', newInvoice.numero);

                    // 4. Move Payments from Old -> New
                    await tx.paiement.updateMany({
                        where: { factureId: currentFacture.id },
                        data: { factureId: newInvoice.id }
                    });

                    // 5. Update Old Draft: Cancel + Unlink Fiche + Unlink Client? No client ok.
                    await tx.facture.update({
                        where: { id: currentFacture.id },
                        data: {
                            statut: 'ANNULEE',
                            ficheId: null, // Free up the Fiche linkage
                            proprietes: {
                                ...(currentFacture.proprietes as any || {}),
                                ficheId: currentFacture.ficheId // Preserve Fiche ID in proprietes
                            },
                            notes: `Remplacée par facture ${newInvoice.numero}`
                        }
                    });

                    // 6. Check Payment Status for New Invoice
                    // Recalculate based on moved payments
                    const movedPayments = await tx.paiement.findMany({ where: { factureId: newInvoice.id } });
                    const totalPaye = movedPayments.reduce((acc, p) => acc + p.montant, 0);
                    let finalStatut = 'VALIDE';
                    let reste = newInvoice.totalTTC - totalPaye;
                    if (totalPaye >= newInvoice.totalTTC) {
                        finalStatut = 'PAYEE';
                        reste = 0;
                    } else if (totalPaye > 0) {
                        finalStatut = 'PARTIEL';
                    }

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
                    await this.decrementStockForInvoice(tx, finalInvoice);

                    return finalInvoice; // Return the NEW invoice so frontend redirects/updates
                });
            }
        }

        // FIX: Sanitize input for update as well
        const { client, paiements, fiche, ...cleanData } = data as any;

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
            (updatedFacture.proprietes as any)?.forceStockDecrement === true) {
            console.log('📦 Post-Update Stock Trigger (Validation, Instance, or Archive)');
            await this.decrementStockForInvoice(this.prisma, updatedFacture);
        }

        // [NEW] Logic: Stock Restoration for Cancelled Transfers
        // If sale is cancelled and restoreStock flag is set, increment stock to restore from -1 to 0
        if (updatedFacture.statut === 'ANNULEE' && (updatedFacture.proprietes as any)?.restoreStock === true) {
            console.log('🔄 Restoring stock for cancelled transfer sale');
            await this.restoreStockForCancelledInvoice(this.prisma, updatedFacture);
        }

        return updatedFacture;
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
                description: `Avoir sur facture ${facture.numero}: ${l.description}`
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
                    notes: `Annulation de la facture ${facture.numero}`,
                    proprietes: {
                        ...(facture.proprietes as any || {}),
                        ficheId: facture.ficheId // Store Fiche ID in proprietes
                    }
                }
            });

            // Mark original as ANNULEE
            await this.prisma.facture.update({
                where: { id: facture.id },
                data: { statut: 'ANNULEE' }
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
            default: return 'DOC';
        }
    }

    async createExchange(invoiceId: string, itemsToReturn: { lineIndex: number, quantiteRetour: number, reason: string }[], centreId: string) {
        console.log(`🔄 [EXCHANGE] Starting Exchange for Facture ${invoiceId}`);

        const original = await this.prisma.facture.findUnique({
            where: { id: invoiceId },
            include: { paiements: true }
        });

        if (!original) throw new NotFoundException('Facture initiale non trouvée');

        // Parse lines
        const originalLines = (typeof original.lignes === 'string' ? JSON.parse(original.lignes) : original.lignes) as any[];

        return this.prisma.$transaction(async (tx) => {
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
                        description: `Annulation: ${l.description || l.designation}`
                    })),
                    notes: `Avoir facture n° : ${original.numero}`,
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
                    notes: `Annuler par avoir n° : ${avoir.numero}`
                }
            });

            // C. Handle Stock Return for Selected Items
            const defectiveWarehouse = await this.getOrCreateDefectiveWarehouse(tx, centreId);

            for (const item of itemsToReturn) {
                const line = originalLines[item.lineIndex];
                if (line && line.productId) {
                    // Determine destination
                    let targetWarehouseId = line.entrepotId; // Default: Origin

                    if (item.reason === 'DEFECTUEUX') {
                        targetWarehouseId = defectiveWarehouse.id;
                    }

                    const productToUpdate = await tx.product.findUnique({ where: { id: line.productId } });

                    if (productToUpdate) {
                        if (item.reason === 'DEFECTUEUX') {
                            // Logic to find corresponding product in Defective Warehouse
                            let defProduct = await tx.product.findFirst({
                                where: { codeInterne: productToUpdate.codeInterne, entrepotId: defectiveWarehouse.id }
                            });

                            if (!defProduct) {
                                // Clone to Defective
                                const { id, entrepotId, createdAt, updatedAt, specificData, ...prodProps } = productToUpdate;
                                defProduct = await tx.product.create({
                                    data: {
                                        ...prodProps,
                                        specificData: specificData as any,
                                        entrepot: { connect: { id: defectiveWarehouse.id } },
                                        quantiteActuelle: 0,
                                        statut: 'DISPONIBLE',
                                        designation: `${productToUpdate.designation} (Défectueux)`
                                    }
                                });
                            }

                            await tx.product.update({
                                where: { id: defProduct.id },
                                data: { quantiteActuelle: { increment: item.quantiteRetour } }
                            });

                            // Movement
                            await tx.mouvementStock.create({
                                data: {
                                    type: 'ENTREE_RETOUR_CLIENT',
                                    quantite: item.quantiteRetour,
                                    produitId: defProduct.id,
                                    entrepotDestinationId: defectiveWarehouse.id,
                                    factureId: original.id,
                                    motif: `Retour Défectueux ${original.numero}`,
                                    utilisateur: 'System'
                                }
                            });
                        } else {
                            // Standard Return to Origin
                            await tx.product.update({
                                where: { id: line.productId },
                                data: { quantiteActuelle: { increment: item.quantiteRetour } }
                            });

                            await tx.mouvementStock.create({
                                data: {
                                    type: 'ENTREE_RETOUR_CLIENT',
                                    quantite: item.quantiteRetour,
                                    produitId: line.productId,
                                    entrepotDestinationId: line.entrepotId,
                                    factureId: original.id,
                                    motif: `Retour Standard ${original.numero}`,
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

            const newNumero = await this.generateNextNumber('FACTURE', tx);
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
            console.log(`🧹 Found ${expiredDrafts.length} expired drafts. Cancelling...`);

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
            console.log(`✅ Renamed ${count} drafts from BRO- to Devis-.`);
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
