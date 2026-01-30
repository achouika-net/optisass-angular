import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BulkAlimentationDto } from './dto/bulk-alimentation.dto';
import { ProductsService } from '../products/products.service';
import { normalizeToUTCNoon } from '../../shared/utils/date-utils';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class StockMovementsService {
    constructor(
        private prisma: PrismaService,
        private productsService: ProductsService
    ) { }

    async findAllByProduct(productId: string) {
        return this.prisma.mouvementStock.findMany({
            where: { produitId: productId },
            orderBy: { dateMovement: 'desc' },
            include: {
                entrepotSource: true,
                entrepotDestination: true,
                facture: {
                    include: {
                        fiche: true,
                        client: true
                    }
                }
            }
        });
    }

    async processBulkAlimentation(dto: BulkAlimentationDto) {
        const { allocations, base64File, fileName, ...invoiceData } = dto;

        try {
            return await this.prisma.$transaction(async (tx) => {
                // ... file handling ...
                let pieceJointeUrl = '';
                if (base64File && fileName) {
                    const uploadDir = path.join(process.cwd(), 'uploads', 'invoices');
                    if (!fs.existsSync(uploadDir)) {
                        fs.mkdirSync(uploadDir, { recursive: true });
                    }
                    const fileExt = path.extname(fileName) || '.jpg';
                    const safeName = `inv_${Date.now()}${fileExt}`;
                    const filePath = path.join(uploadDir, safeName);
                    const buffer = Buffer.from(base64File.replace(/^data:.*?;base64,/, ''), 'base64');
                    fs.writeFileSync(filePath, buffer);
                    pieceJointeUrl = `/uploads/invoices/${safeName}`;
                }

                const totalHT = allocations.reduce((sum, a) => sum + (Number(a.prixAchat) * Number(a.quantite)), 0);
                const totalTTC = allocations.reduce((sum, a) => {
                    const tvaAmount = Number(a.prixAchat) * (Number(a.tva) / 100);
                    return sum + ((Number(a.prixAchat) + tvaAmount) * Number(a.quantite));
                }, 0);

                // Try to infer centreId from allocations if missing
                let effectiveCentreId = invoiceData.centreId;
                if (!effectiveCentreId && allocations.length > 0) {
                    const firstWarehouseId = allocations[0].warehouseId;
                    const warehouse = await tx.entrepot.findUnique({
                        where: { id: firstWarehouseId }
                    });
                    if (warehouse?.centreId) {
                        effectiveCentreId = warehouse.centreId;
                        console.log(`💡 [STOCK] Inferred Centre ID from warehouse: ${effectiveCentreId}`);
                    }
                }

                // Check if invoice already exists for this supplier (Case-insensitive & Trimmed)
                const trimmedNumero = invoiceData.numeroFacture.trim();
                let invoice = await tx.factureFournisseur.findFirst({
                    where: {
                        fournisseurId: invoiceData.fournisseurId,
                        numeroFacture: {
                            equals: trimmedNumero,
                            mode: 'insensitive'
                        }
                    },
                    include: { echeances: true }
                });

                if (invoice) {
                    console.warn(`[STOCK] Duplicate alimentation attempt for invoice ${invoice.numeroFacture}`);
                    throw new BadRequestException(`La facture ${invoice.numeroFacture} existe déjà. Vous ne pouvez pas alimenter le stock deux fois sur la même facture/BL pour éviter les doublons.`);
                }

                // If no invoice exists, we continue with creation
                invoice = await tx.factureFournisseur.create({
                    data: {
                        numeroFacture: invoiceData.numeroFacture,
                        dateEmission: normalizeToUTCNoon(invoiceData.dateEmission) as Date,
                        dateEcheance: normalizeToUTCNoon(invoiceData.dateEcheance || invoiceData.dateEmission) as Date,
                        type: invoiceData.type,
                        statut: 'A_PAYER',
                        montantHT: totalHT,
                        montantTVA: totalTTC - totalHT,
                        montantTTC: totalTTC,
                        fournisseurId: invoiceData.fournisseurId,
                        centreId: effectiveCentreId,
                        pieceJointeUrl: pieceJointeUrl,
                        echeances: {
                            create: [
                                {
                                    type: 'CHEQUE',
                                    dateEcheance: normalizeToUTCNoon(invoiceData.dateEcheance || invoiceData.dateEmission) as Date,
                                    montant: totalTTC,
                                    statut: 'EN_ATTENTE'
                                }
                            ]
                        }
                    },
                    include: { echeances: true }
                });

                // ═══════════════════════════════════════════════════════════════
                // AUTOMATIC PAYMENT CREATION FOR CASH SUPPLIERS
                // ═══════════════════════════════════════════════════════════════

                // Fetch supplier payment conditions
                const supplier = await tx.fournisseur.findUnique({
                    where: { id: invoiceData.fournisseurId }
                });

                console.log(`🔍 [STOCK] Supplier: ${supplier?.nom}, ID: ${supplier?.id}`);

                const paymentConditions = (
                    (supplier?.convention as any)?.echeancePaiement?.[0]
                    || supplier?.conditionsPaiement
                    || ''
                ).toLowerCase();

                console.log(`💳 [STOCK] Payment conditions: "${paymentConditions}"`);

                const isCashPayment = paymentConditions.includes('comptant')
                    || paymentConditions.includes('espèces')
                    || paymentConditions.includes('espece')
                    || paymentConditions.includes('immédiat')
                    || paymentConditions.includes('immediat')
                    || paymentConditions === '';

                console.log(`💰 [STOCK] Is cash payment: ${isCashPayment}`);

                console.log(`💰 [STOCK] Is cash payment: ${isCashPayment}`);

                if (isCashPayment) {
                    if (!effectiveCentreId) {
                        console.warn(`⚠️ [STOCK] Skipping automatic payment: Missing Centre ID for invoice ${invoiceData.numeroFacture} (and unable to infer from warehouse)`);
                    } else {
                        console.log(`🚀 [STOCK] Automatic payment creation for cash supplier: ${supplier?.nom} (Centre: ${effectiveCentreId})`);

                        // Create automatic expense
                        try {
                            const createdPayment = await tx.depense.create({
                                data: {
                                    reference: `PAY-${invoiceData.numeroFacture}`,
                                    montant: totalTTC,
                                    date: normalizeToUTCNoon(invoiceData.dateEmission) as Date,
                                    categorie: 'ACHAT_STOCK',
                                    modePaiement: paymentConditions.includes('espèces') || paymentConditions.includes('espece') ? 'ESPECES' : 'CHEQUE',
                                    fournisseurId: invoiceData.fournisseurId,
                                    factureFournisseurId: invoice.id,
                                    centreId: effectiveCentreId as string,
                                    statut: 'VALIDEE',
                                    description: `Paiement automatique - ${invoiceData.numeroFacture}`
                                }
                            });
                            console.log(`✅ [STOCK] Payment created: ${createdPayment.id}, Amount: ${createdPayment.montant} DH`);

                            // Update invoice status ONLY if payment succeeded
                            await tx.factureFournisseur.update({
                                where: { id: invoice.id },
                                data: { statut: 'PAYEE' }
                            });

                            // Update installment status ONLY if payment succeeded
                            if (invoice.echeances && invoice.echeances.length > 0) {
                                await tx.echeancePaiement.update({
                                    where: { id: invoice.echeances[0].id },
                                    data: { statut: 'PAYEE' }
                                });
                            }

                        } catch (paymentError) {
                            console.error(`❌ [STOCK] ERROR creating payment:`, paymentError);
                            // We do NOT re-throw here to prevent rolling back the stock movement
                            // The user will just have to add payment manually
                        }
                    }
                } else {
                    console.log(`⏳ [STOCK] Deferred payment for ${supplier?.nom} - Conditions: ${paymentConditions}`);
                }

                for (const alloc of allocations) {
                    let targetProduct: any = await this.productsService.findLocalCounterpart({
                        designation: alloc.nom,
                        codeInterne: alloc.reference,
                        centreId: effectiveCentreId || '',
                        entrepotId: alloc.warehouseId,
                        couleur: alloc.couleur
                    }, tx);

                    // NOUVEAU: Si pas trouvé par findLocalCounterpart, chercher par code/référence seul
                    // Cela permet de détecter les produits existants même avec caractéristiques différentes
                    if (!targetProduct) {
                        targetProduct = await tx.product.findFirst({
                            where: {
                                OR: [
                                    { codeInterne: alloc.reference.trim() },
                                    ...(alloc.codeBarre ? [{ codeBarres: alloc.codeBarre.trim() }] : [])
                                ],
                                entrepotId: alloc.warehouseId,
                                // IMPORTANT: Differentiate by color if provided
                                ...(alloc.couleur ? { couleur: alloc.couleur } : {})
                            }
                        });

                        if (targetProduct) {
                            console.log(`[STOCK] Produit existant trouvé par code/référence: ${targetProduct.designation}. Mise à jour automatique.`);
                        }
                    }

                    if (!targetProduct) {
                        const template = await tx.product.findFirst({
                            where: { designation: alloc.nom, codeInterne: alloc.reference }
                        });

                        console.log('[STOCK-DEBUG] Creating new product with alloc data:', {
                            ref: alloc.reference,
                            couleur: alloc.couleur,
                            materiau: alloc.materiau,
                            calibre: alloc.calibre
                        });

                        targetProduct = await tx.product.create({
                            data: {
                                designation: alloc.nom,
                                marque: alloc.marque,
                                codeInterne: alloc.reference.trim(),
                                codeBarres: (alloc.codeBarre?.trim()) || alloc.reference.trim(),
                                typeArticle: template?.typeArticle || alloc.categorie || 'AUTRE',
                                couleur: alloc.couleur,
                                prixAchatHT: Number(alloc.prixAchat),
                                prixVenteHT: Number(alloc.prixVente),
                                prixVenteTTC: Number(alloc.prixVente) * (1 + Number(alloc.tva) / 100),
                                quantiteActuelle: 0,
                                seuilAlerte: template?.seuilAlerte || 2,
                                statut: 'DISPONIBLE',
                                entrepotId: alloc.warehouseId,
                                specificData: {
                                    ...(template?.specificData as any || {}),
                                    materiau: alloc.materiau,
                                    forme: alloc.forme,
                                    genre: alloc.genre,
                                    calibre: alloc.calibre,
                                    pont: alloc.pont
                                },
                                utilisateurCreation: 'system'
                            },
                            include: { entrepot: true }
                        });
                    }

                    if (targetProduct) {
                        const existingStock = Number(targetProduct.quantiteActuelle || 0);
                        const existingPrice = Number(targetProduct.prixAchatHT || 0);
                        const newQty = Number(alloc.quantite);
                        const newPrice = Number(alloc.prixAchat);

                        let finalPrixAchatHT = newPrice;
                        if (existingStock > 0) {
                            // CUMP = (OldValue + NewValue) / TotalQty
                            const totalValue = (existingStock * existingPrice) + (newQty * newPrice);
                            const totalQty = existingStock + newQty;
                            finalPrixAchatHT = totalValue / totalQty;
                        }

                        await tx.product.update({
                            where: { id: targetProduct.id },
                            data: {
                                quantiteActuelle: { increment: newQty },
                                prixAchatHT: finalPrixAchatHT,
                                prixVenteHT: Number(alloc.prixVente),
                                prixVenteTTC: Number(alloc.prixVente) * (1 + Number(alloc.tva) / 100),
                                marque: targetProduct.marque || alloc.marque,
                                typeArticle: targetProduct.typeArticle || alloc.categorie,
                                couleur: targetProduct.couleur || alloc.couleur,
                                specificData: {
                                    ...(targetProduct.specificData as any || {}),
                                    materiau: (targetProduct.specificData as any)?.materiau || alloc.materiau,
                                    forme: (targetProduct.specificData as any)?.forme || alloc.forme,
                                    genre: (targetProduct.specificData as any)?.genre || alloc.genre,
                                    calibre: (targetProduct.specificData as any)?.calibre || alloc.calibre,
                                    pont: (targetProduct.specificData as any)?.pont || alloc.pont
                                }
                            }
                        });

                        await tx.mouvementStock.create({
                            data: {
                                type: 'ENTREE_ACHAT',
                                quantite: Number(alloc.quantite),
                                produitId: targetProduct.id,
                                entrepotDestinationId: alloc.warehouseId,
                                factureFournisseurId: invoice.id,
                                prixAchatUnitaire: Number(alloc.prixAchat),
                                motif: `Alimentation via ${invoice.numeroFacture}`,
                                dateMovement: new Date(),
                                utilisateur: 'system'
                            }
                        });
                    }
                }
                return invoice;
            });
        } catch (error) {
            console.error('[processBulkAlimentation ERROR]', error);

            // EMERGENCY LOGGING
            try {
                const logPath = path.join(process.cwd(), 'last_error.log');
                const logMessage = `[${new Date().toISOString()}] ERROR: ${error.message}\nSTACK: ${error.stack}\nCODE: ${error.code}\nMETA: ${JSON.stringify(error.meta)}\n`;
                fs.appendFileSync(logPath, logMessage);
            } catch (e) { }

            if (error instanceof BadRequestException || error instanceof NotFoundException) {
                throw error;
            }

            if (error.code === 'P2002') {
                const target = error.meta?.target || [];
                if (target.includes('numeroFacture')) {
                    throw new BadRequestException('Ce numéro de facture existe déjà pour ce fournisseur.');
                }
                if (target.includes('codeInterne') || target.includes('codeBarres')) {
                    throw new BadRequestException(`Un produit avec cette référence ou ce code-barres existe déjà dans cet entrepôt. Détails: ${JSON.stringify(target)}`);
                }
                throw new BadRequestException(`Erreur de contrainte unique (doublon) : ${target.join(', ')}`);
            }

            throw new BadRequestException(`Erreur lors de l'enregistrement : ${error.message}`);
        }
    }

    async getHistory(filters: any) {
        console.log('[STOCK-HISTORY] Filters received:', filters);
        const andConditions: any[] = [];

        // Center Filter
        if (filters.centreId && filters.centreId !== 'null' && filters.centreId !== 'undefined') {
            andConditions.push({
                OR: [
                    { centreId: filters.centreId },
                    { centreId: null }
                ]
            });
        }

        // Handle Document Type Filter
        if (filters.docType === 'BL') {
            andConditions.push({ type: 'BL' });
        } else if (filters.docType === 'FACTURE') {
            andConditions.push({ type: { in: ['ACHAT_STOCK', 'FACTURE'] } });
        } else {
            // Default: Show all
            andConditions.push({ type: { in: ['ACHAT_STOCK', 'FACTURE', 'BL', 'ENTREE_STOCK'] } });
        }

        if (filters.dateFrom || filters.dateTo) {
            const dateClause: any = {};
            if (filters.dateFrom && !isNaN(Date.parse(filters.dateFrom))) {
                dateClause.gte = new Date(filters.dateFrom);
            }
            if (filters.dateTo && !isNaN(Date.parse(filters.dateTo))) {
                dateClause.lte = new Date(filters.dateTo);
            }
            if (Object.keys(dateClause).length > 0) {
                andConditions.push({ dateEmission: dateClause });
            }
        }

        if (filters.supplierId && filters.supplierId !== 'null' && filters.supplierId !== 'undefined') {
            andConditions.push({ fournisseurId: filters.supplierId });
        }

        const whereClause = andConditions.length > 0 ? { AND: andConditions } : {};

        console.log('[STOCK-HISTORY] Query WhereClause:', JSON.stringify(whereClause, null, 2));

        return this.prisma.factureFournisseur.findMany({
            where: whereClause,
            take: 50,
            orderBy: { dateEmission: 'desc' },
            include: {
                fournisseur: true,
                mouvementsStock: {
                    include: {
                        produit: true,
                        entrepotDestination: true
                    }
                }
            }
        });
    }

    async getOutHistory(filters: { dateFrom?: string; dateTo?: string; search?: string; centreId?: string }) {
        const whereClause: any = {
            type: {
                in: [
                    'SORTIE', 'CASSE', 'AJUSTEMENT', 'RETOUR_FOURNISSEUR',
                    'TRANSFERT_SORTIE', 'TRANSFERT_ENTREE', 'RECEPTION',
                    'TRANSFERT_INIT', 'EXPEDITION', 'TRANSFERT_ANNULE'
                ]
            }
        };

        if (filters.centreId) {
            whereClause.OR = [
                { entrepotSource: { centreId: filters.centreId } },
                { entrepotDestination: { centreId: filters.centreId } },
                { entrepotSource: null, entrepotDestination: null } // Initial entries or legacy
            ];
        }

        if (filters.dateFrom || filters.dateTo) {
            whereClause.dateMovement = {};
            if (filters.dateFrom) whereClause.dateMovement.gte = new Date(filters.dateFrom);
            if (filters.dateTo) whereClause.dateMovement.lte = new Date(filters.dateTo);
        }


        if (filters.search) {
            const searchOR = [
                { motif: { contains: filters.search, mode: 'insensitive' } },
                { produit: { designation: { contains: filters.search, mode: 'insensitive' } } },
                { produit: { codeInterne: { contains: filters.search, mode: 'insensitive' } } }
            ];
            if (whereClause.OR) {
                // Combine with center filter
                whereClause.AND = [
                    { OR: whereClause.OR },
                    { OR: searchOR }
                ];
                delete whereClause.OR;
            } else {
                whereClause.OR = searchOR;
            }
        }

        const movements = await this.prisma.mouvementStock.findMany({
            where: whereClause,
            take: 200,
            orderBy: { dateMovement: 'desc' },
            include: {
                produit: true,
                entrepotSource: {
                    include: { centre: true }
                },
                entrepotDestination: {
                    include: { centre: true }
                },
                facture: {
                    include: { client: true }
                }
            }
        });

        // Grouping movements by motif and approximate time (same minute)
        const groups: any[] = [];
        const groupMap = new Map<string, any>();

        movements.forEach(m => {
            const date = new Date(m.dateMovement);
            // Group by motif + YYYY-MM-DD HH:mm
            const timeKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()} ${date.getHours()}:${date.getMinutes()}`;
            const key = `${m.motif}_${timeKey}`;

            if (!groupMap.has(key)) {
                const group = {
                    id: m.id, // Using first movement ID as group ID for simpler UI handling
                    motif: m.motif,
                    dateMovement: m.dateMovement,
                    utilisateur: m.utilisateur,
                    itemsCount: 0,
                    mouvementsStock: []
                };
                groupMap.set(key, group);
                groups.push(group);
            }

            const currentGroup = groupMap.get(key);
            currentGroup.mouvementsStock.push(m);
            currentGroup.itemsCount += 1;
        });

        return groups;
    }

    async removeEntryHistory(id: string) {
        return await this.prisma.$transaction(async (tx) => {
            const invoice = await tx.factureFournisseur.findUnique({
                where: { id },
                include: { mouvementsStock: true }
            });

            if (!invoice) throw new NotFoundException('Entrée historique introuvable');

            // 0. Get affected product IDs before deletion
            const productIds = Array.from(new Set(invoice.mouvementsStock.map(m => m.produitId)));

            // 1. Clear Movements (This triggers the sync later)
            await tx.mouvementStock.deleteMany({
                where: { factureFournisseurId: id }
            });

            // 2. Sync each affected product
            for (const productId of productIds) {
                await this.productsService.syncProductState(productId, tx);
            }

            // 3. Delete linked Expense if exists
            await tx.depense.deleteMany({
                where: { factureFournisseurId: id }
            });

            // 4. Delete the Invoice itself
            return await tx.factureFournisseur.delete({
                where: { id }
            });
        });
    }

    async getDebugData() {
        const count = await this.prisma.factureFournisseur.count();
        const recent = await this.prisma.factureFournisseur.findMany({
            take: 5,
            orderBy: { createdAt: 'desc' },
            select: { id: true, numeroFacture: true, centreId: true, type: true }
        });
        const centers = await this.prisma.centre.findMany({ select: { id: true, nom: true } });
        return { count, recent, availableCenters: centers };
    }
}
