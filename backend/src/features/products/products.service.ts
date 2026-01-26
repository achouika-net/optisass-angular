import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
    constructor(private prisma: PrismaService) { }

    private async generateNextTransferNumber(tx?: any): Promise<string> {
        const year = new Date().getFullYear();
        const prisma = tx || this.prisma;

        // Find all products that have a pendingIncoming or been part of a transfer
        // This is a bit tricky since we store it in JSON.
        // We might need a more robust way, but for now let's use a specialized movement type search
        const lastMovement = await prisma.mouvementStock.findFirst({
            where: {
                motif: { contains: `TRS-${year}-` }
            },
            orderBy: { createdAt: 'desc' }
        });

        let sequence = 1;
        if (lastMovement && lastMovement.motif) {
            const match = lastMovement.motif.match(/TRS-\d+-(\d+)/);
            if (match) {
                sequence = parseInt(match[1]) + 1;
            }
        }

        return `TRS-${year}-${sequence.toString().padStart(4, '0')}`;
    }

    async create(createProductDto: CreateProductDto) {
        try {
            const {
                // Extract specific fields to store in JSON
                categorie, genre, forme, matiere, couleurMonture, couleurBranches, calibre, pont, branche, typeCharniere, typeMonture, photoFace, photoProfil,
                typeVerre, materiau, indiceRefraction, teinte, filtres, traitements, puissanceSph, puissanceCyl, axe, addition, diametre, base, courbure, fabricant, familleOptique,
                typeLentille, usage, modeleCommercial, laboratoire, rayonCourbure, nombreParBoite, prixParBoite, prixParUnite, numeroLot, datePeremption, quantiteBoites, quantiteUnites,
                categorieAccessoire, sousCategorie,
                specificData, // Access explicitly passed specificData if any
                ...mainAndRelationalFields
            } = createProductDto;

            // Construct specificData object from flat fields
            const newSpecificData = {
                ...specificData,
                // Monture
                ...(categorie && { categorie }),
                ...(genre && { genre }),
                ...(forme && { forme }),
                ...(matiere && { matiere }),
                ...(couleurMonture && { couleurMonture }),
                ...(couleurBranches && { couleurBranches }),
                ...(calibre && { calibre }),
                ...(pont && { pont }),
                ...(branche && { branche }),
                ...(typeCharniere && { typeCharniere }),
                ...(typeMonture && { typeMonture }),
                ...(photoFace && { photoFace }),
                ...(photoProfil && { photoProfil }),

                // Verre
                ...(typeVerre && { typeVerre }),
                ...(materiau && { materiau }),
                ...(indiceRefraction && { indiceRefraction }),
                ...(teinte && { teinte }),
                ...(filtres && { filtres }),
                ...(traitements && { traitements }),
                ...(puissanceSph && { puissanceSph }),
                ...(puissanceCyl && { puissanceCyl }),
                ...(axe && { axe }),
                ...(addition && { addition }),
                ...(diametre && { diametre }),
                ...(base && { base }),
                ...(courbure && { courbure }),
                ...(fabricant && { fabricant }),
                ...(familleOptique && { familleOptique }),

                // Lentille
                ...(typeLentille && { typeLentille }),
                ...(usage && { usage }),
                ...(modeleCommercial && { modeleCommercial }),
                ...(laboratoire && { laboratoire }),
                ...(rayonCourbure && { rayonCourbure }),
                ...(nombreParBoite && { nombreParBoite }),
                ...(prixParBoite && { prixParBoite }),
                ...(prixParUnite && { prixParUnite }),
                ...(numeroLot && { numeroLot }),
                ...(datePeremption && { datePeremption }),
                ...(quantiteBoites && { quantiteBoites }),
                ...(quantiteUnites && { quantiteUnites }),

                // Accessoire
                ...(categorieAccessoire && { categorieAccessoire }),
                ...(sousCategorie && { sousCategorie }),
            };

            // Robust codeBarres handling: Treat empty string as missing
            const rawCodeBarres = mainAndRelationalFields.codeBarres;
            const codeBarres = (rawCodeBarres && rawCodeBarres.trim().length > 0)
                ? rawCodeBarres
                : mainAndRelationalFields.codeInterne;

            // Ensure codeBarres is present (fallback to codeInterne if missing to avoid Prisma error)
            const resolvedCodeBarres = codeBarres || (mainAndRelationalFields.codeInterne ? mainAndRelationalFields.codeInterne : null);

            return await this.prisma.$transaction(async (tx) => {
                const product = await tx.product.create({
                    data: {
                        ...mainAndRelationalFields,
                        codeBarres: resolvedCodeBarres!, // Assert non-null as fallback logic handles it or schema allows
                        statut: mainAndRelationalFields.statut ?? 'DISPONIBLE',
                        specificData: newSpecificData,
                        utilisateurCreation: mainAndRelationalFields.utilisateurCreation || 'system'
                    },
                });

                if (product.quantiteActuelle > 0) {
                    await tx.mouvementStock.create({
                        data: {
                            type: 'INVENTAIRE',
                            quantite: product.quantiteActuelle,
                            produitId: product.id,
                            entrepotDestinationId: product.entrepotId,
                            motif: 'Stock Initial (Création Fiche)',
                            utilisateur: product.utilisateurCreation || 'System'
                        }
                    });
                }

                return product;
            });

        } catch (error) {
            console.error('Error creating product:', error);
            // Log deep details if available
            if (error instanceof Error) {
                console.error(error.stack);
            }
            throw error; // Let NestJS handle the response, but now we have logs
        }
    }

    async findAll(
        entrepotId?: string,
        centreId?: string,
        globalSearch: boolean = false,
        filters?: { marque?: string; typeArticle?: string; reference?: string; codeBarres?: string }
    ) {
        const where: any = {};

        if (!centreId && !entrepotId && !globalSearch) return []; // Isolation
        if (entrepotId) {
            where.entrepotId = entrepotId;
        } else if (!globalSearch && centreId) {
            where.entrepot = { centreId };
        }

        // Advanced Filters
        if (filters) {
            if (filters.marque) {
                where.marque = { contains: filters.marque, mode: 'insensitive' };
            }
            if (filters.typeArticle) {
                where.typeArticle = filters.typeArticle;
            }
            if (filters.reference) {
                where.codeInterne = { contains: filters.reference, mode: 'insensitive' };
            }
            if (filters.codeBarres) {
                where.codeBarres = { contains: filters.codeBarres, mode: 'insensitive' };
            }
        }

        const products = await this.prisma.product.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            include: {
                entrepot: {
                    include: {
                        centre: true
                    }
                }
            }
        });

        return products.map(p => {
            // Data Correction: In a quantity-based model, if units are available, 
            // the main status should be DISPONIBLE, not RESERVE/EN_TRANSIT.
            if (p.quantiteActuelle > 0 && (p.statut === 'RESERVE' || p.statut === 'EN_TRANSIT')) {
                p.statut = 'DISPONIBLE';
            }
            return p;
        });
    }
    async findOne(id: string) {
        const product = await this.prisma.product.findUnique({
            where: { id },
            include: {
                entrepot: {
                    include: { centre: true }
                }
            }
        });

        if (!product) {
            throw new NotFoundException(`Product with ID ${id} not found`);
        }

        return product;
    }

    async update(id: string, updateProductDto: UpdateProductDto) {
        // Logic to merge specificData if updated
        // For simplicity, we might need to fetch existing specificData first if partial update hits specific fields
        // But PartialType makes everything optional.

        const {
            // Monture
            categorie, genre, forme, matiere, couleurMonture, couleurBranches, calibre, pont, branche, typeCharniere, typeMonture, photoFace, photoProfil,
            // Verre
            typeVerre, materiau, indiceRefraction, teinte, filtres, traitements, puissanceSph, puissanceCyl, axe, addition, diametre, base, courbure, fabricant, familleOptique,
            // Lentille
            typeLentille, usage, modeleCommercial, laboratoire, rayonCourbure, nombreParBoite, prixParBoite, prixParUnite, numeroLot, datePeremption, quantiteBoites, quantiteUnites,
            // Accessoire
            categorieAccessoire, sousCategorie,
            specificData,
            ...mainFields
        } = updateProductDto;

        const specificFieldsUpdate = {
            // Monture
            ...(categorie && { categorie }),
            ...(genre && { genre }),
            ...(forme && { forme }),
            ...(matiere && { matiere }),
            ...(couleurMonture && { couleurMonture }),
            ...(couleurBranches && { couleurBranches }),
            ...(calibre && { calibre }),
            ...(pont && { pont }),
            ...(branche && { branche }),
            ...(typeCharniere && { typeCharniere }),
            ...(typeMonture && { typeMonture }),
            ...(photoFace && { photoFace }),
            ...(photoProfil && { photoProfil }),

            // Verre
            ...(typeVerre && { typeVerre }),
            ...(materiau && { materiau }),
            ...(indiceRefraction && { indiceRefraction }),
            ...(teinte && { teinte }),
            ...(filtres && { filtres }),
            ...(traitements && { traitements }),
            ...(puissanceSph && { puissanceSph }),
            ...(puissanceCyl && { puissanceCyl }),
            ...(axe && { axe }),
            ...(addition && { addition }),
            ...(diametre && { diametre }),
            ...(base && { base }),
            ...(courbure && { courbure }),
            ...(fabricant && { fabricant }),
            ...(familleOptique && { familleOptique }),

            // Lentille
            ...(typeLentille && { typeLentille }),
            ...(usage && { usage }),
            ...(modeleCommercial && { modeleCommercial }),
            ...(laboratoire && { laboratoire }),
            ...(rayonCourbure && { rayonCourbure }),
            ...(nombreParBoite && { nombreParBoite }),
            ...(prixParBoite && { prixParBoite }),
            ...(prixParUnite && { prixParUnite }),
            ...(numeroLot && { numeroLot }),
            ...(datePeremption && { datePeremption }),
            ...(quantiteBoites && { quantiteBoites }),
            ...(quantiteUnites && { quantiteUnites }),

            // Accessoire
            ...(categorieAccessoire && { categorieAccessoire }),
            ...(sousCategorie && { sousCategorie }),
            ...specificData
        };

        // If we have specific fields to update, we need to merge them with existing JSON
        // or verify if Prisma's update handles merging Json (it usually replaces).
        // Safer to fetch first if we want true deep merge, but for now we might just update main fields
        // unless specific fields are provided.

        // Strategy: If specific fields are present, we update the whole specificData object.
        // Ideally we should merge.

        let dataToUpdate: any = { ...mainFields };

        if (Object.keys(specificFieldsUpdate).length > 0) {
            // Fetch current to merge
            const current = await this.prisma.product.findUnique({ where: { id } });
            if (current) {
                const currentSpecific = current.specificData as object || {};
                dataToUpdate.specificData = { ...currentSpecific, ...specificFieldsUpdate };
            }
        }

        return this.prisma.product.update({
            where: { id },
            data: dataToUpdate,
        });
    }

    async remove(id: string) {
        const product = await this.prisma.product.findUnique({
            where: { id },
            include: {
                mouvements: { take: 1 },
                _count: {
                    select: { mouvements: true }
                }
            }
        });

        if (!product) {
            throw new NotFoundException(`Produit non trouvé`);
        }

        // 1. Check for Stock
        if (product.quantiteActuelle > 0) {
            throw new Error(`Suppression impossible : ce produit possède encore du stock (${product.quantiteActuelle}). Veuillez d'abord sortir le stock manuellement.`);
        }

        // 2. Check for Mouvements (History)
        if (product._count.mouvements > 0) {
            throw new Error(`Suppression impossible : ce produit possède un historique de mouvements de stock (${product._count.mouvements}). Pour la traçabilité, vous ne pouvez pas le supprimer.`);
        }

        // 3. Check for Invoices (JSON probe)
        // Since Prisma doesn't support easy JsonPath filtering across all dialects in a simple way,
        // we can use a more generic check or findMany but that's expensive.
        // However, given the requirement, we MUST ensure it's not used.
        const allInvoices = await this.prisma.facture.findMany({
            select: { id: true, numero: true, lignes: true }
        });

        const linkedInvoice = allInvoices.find(inv => {
            const lines = (typeof inv.lignes === 'string' ? JSON.parse(inv.lignes) : inv.lignes) as any[];
            return lines.some(line => line.productId === id);
        });

        if (linkedInvoice) {
            throw new Error(`Suppression impossible : ce produit est référencé dans la facture ${linkedInvoice.numero}.`);
        }

        return this.prisma.product.delete({
            where: { id },
        });
    }

    /**
     * Finds a local counterpart for a product based on model attributes (designation, reference)
     * useful when productId differs across centers.
     */
    async findLocalCounterpart(params: {
        designation: string;
        codeInterne?: string;
        codeBarres?: string;
        centreId: string;
        entrepotId?: string;
    }, tx?: any) {
        const { designation, codeInterne, codeBarres, centreId, entrepotId } = params;
        const client = tx || this.prisma;

        // Try direct reference match first (most reliable)
        if (codeInterne || codeBarres) {
            const byRef = await client.product.findFirst({
                where: {
                    entrepot: { centreId },
                    entrepotId: entrepotId || undefined,
                    OR: [
                        codeInterne ? { codeInterne } : {},
                        codeBarres ? { codeBarres } : {}
                    ].filter((q: any) => Object.keys(q).length > 0)
                },
                orderBy: [
                    { quantiteActuelle: 'desc' }, // Prefer those with stock
                    { createdAt: 'asc' } // Then prefer the "original" ones
                ],
                include: { entrepot: true }
            });
            if (byRef) return byRef;
        }

        // Fallback to designation (less reliable but better than nothing)
        return client.product.findFirst({
            where: {
                entrepot: { centreId },
                entrepotId: entrepotId || undefined,
                designation: { equals: designation, mode: 'insensitive' }
            },
            orderBy: [
                { quantiteActuelle: 'desc' },
                { createdAt: 'asc' }
            ],
            include: { entrepot: true }
        });
    }

    async initiateTransfer(sourceProductId: string, targetProductId: string, quantite: number = 1) {
        const sourceProduct = await this.prisma.product.findUnique({
            where: { id: sourceProductId },
            include: { entrepot: { include: { centre: true } } }
        });
        const targetProduct = await this.prisma.product.findUnique({
            where: { id: targetProductId },
            include: { entrepot: { include: { centre: true } } }
        });

        if (!sourceProduct || !targetProduct) throw new NotFoundException('Source or Target product not found');
        if (sourceProductId === targetProductId) throw new Error('Impossible de transférer un produit vers lui-même (Source = Destination).');
        if (sourceProduct.quantiteActuelle < quantite) throw new Error('Stock insuffisant à la source');

        console.log(`[TRANSFER] Init from ${sourceProduct.entrepot?.centre?.nom} (${sourceProductId}) to ${targetProduct.entrepot?.centre?.nom} (${targetProductId}) Qty: ${quantite}`);

        return this.prisma.$transaction(async (tx) => {
            const transferNumber = await this.generateNextTransferNumber(tx);

            const targetSpecificData = (targetProduct.specificData as any) || {};
            const updatedTargetData = {
                ...targetSpecificData,
                pendingIncoming: {
                    numeroTransfert: transferNumber,
                    sourceProductId: sourceProduct.id,
                    sourceCentreId: sourceProduct.entrepot?.centreId,
                    sourceCentreName: sourceProduct.entrepot?.centre?.nom,
                    status: 'RESERVED',
                    quantite: quantite,
                    date: new Date().toISOString()
                }
            };

            const sourceSpecificData = (sourceProduct.specificData as any) || {};
            const updatedSourceData = {
                ...sourceSpecificData,
                pendingOutgoing: [
                    ...(sourceSpecificData.pendingOutgoing || []),
                    {
                        numeroTransfert: transferNumber,
                        targetProductId: targetProduct.id,
                        status: 'RESERVED',
                        quantite: quantite,
                        date: new Date().toISOString()
                    }
                ]
            };

            // Decrement source
            await tx.product.update({
                where: { id: sourceProductId },
                data: {
                    quantiteActuelle: { decrement: quantite },
                    specificData: updatedSourceData
                }
            });

            // Tag target
            await tx.product.update({
                where: { id: targetProductId },
                data: {
                    statut: 'RESERVE',
                    specificData: updatedTargetData
                }
            });

            return tx.mouvementStock.create({
                data: {
                    type: 'TRANSFERT_INIT',
                    quantite: -quantite,
                    produitId: sourceProductId,
                    entrepotSourceId: sourceProduct.entrepotId,
                    entrepotDestinationId: targetProduct.entrepotId,
                    motif: `${transferNumber} - Réservation pour ${targetProduct.entrepot?.centre?.nom}`,
                    utilisateur: 'System'
                }
            });
        });
    }

    async shipTransfer(targetProductId: string) {
        const targetProduct = await this.prisma.product.findUnique({ where: { id: targetProductId } });
        if (!targetProduct) throw new NotFoundException('Target product not found');

        const tsd = (targetProduct.specificData as any) || {};
        if (!tsd.pendingIncoming) throw new Error('Aucun transfert entrant trouvé');

        tsd.pendingIncoming.status = 'SHIPPED';
        const sourceProductId = tsd.pendingIncoming.sourceProductId;

        return this.prisma.$transaction(async (tx) => {
            // Update target
            await tx.product.update({
                where: { id: targetProductId },
                data: {
                    statut: 'EN_TRANSIT', // Update top-level status
                    specificData: tsd
                }
            });

            // Update source
            if (sourceProductId) {
                const sourceProduct = await tx.product.findUnique({ where: { id: sourceProductId } });
                if (sourceProduct) {
                    const ssd = (sourceProduct.specificData as any) || {};
                    if (ssd.pendingOutgoing) {
                        const outgoing = ssd.pendingOutgoing.find((t: any) => t.targetProductId === targetProductId);
                        if (outgoing) outgoing.status = 'SHIPPED';
                        await tx.product.update({
                            where: { id: sourceProductId },
                            data: { specificData: ssd }
                        });
                    }
                }
            }
            return { success: true };
        });
    }

    async bulkShip(targetProductIds: string[]) {
        console.log('[BULK-SHIP] Received request with IDs:', targetProductIds);

        if (!targetProductIds || targetProductIds.length === 0) {
            throw new BadRequestException('Aucun produit sélectionné pour l\'expédition');
        }

        const results: string[] = [];
        const errors: Array<{ id: string; error: string }> = [];

        // Execute sequentially to avoid deadlocks or transaction issues, 
        // essentially just iterating logic. A global transaction might be too heavy if list is large.
        // But for consistency, we treat them individually.
        for (const id of targetProductIds) {
            try {
                console.log(`[BULK-SHIP] Processing ID: ${id}`);
                await this.shipTransfer(id);
                results.push(id);
                console.log(`[BULK-SHIP] ✅ Success for ID: ${id}`);
            } catch (error: any) {
                console.error(`[BULK-SHIP] ❌ Error shipping ${id}:`, error.message);
                errors.push({ id, error: error.message });
            }
        }

        console.log(`[BULK-SHIP] Complete. Success: ${results.length}, Failures: ${errors.length}`);

        return {
            successCount: results.length,
            failureCount: errors.length,
            errors
        };
    }

    async bulkReceive(targetProductIds: string[]) {
        console.log('[BULK-RECEIVE] Received request with IDs:', targetProductIds);

        if (!targetProductIds || targetProductIds.length === 0) {
            throw new BadRequestException('Aucun produit sélectionné pour la réception');
        }

        const results: string[] = [];
        const errors: Array<{ id: string; error: string }> = [];

        for (const id of targetProductIds) {
            try {
                console.log(`[BULK-RECEIVE] Processing ID: ${id}`);
                await this.completeTransfer(id);
                results.push(id);
                console.log(`[BULK-RECEIVE] ✅ Success for ID: ${id}`);
            } catch (error: any) {
                console.error(`[BULK-RECEIVE] ❌ Error receiving ${id}:`, error.message);
                errors.push({ id, error: error.message });
            }
        }

        console.log(`[BULK-RECEIVE] Complete. Success: ${results.length}, Failures: ${errors.length}`);

        return {
            successCount: results.length,
            failureCount: errors.length,
            errors
        };
    }

    async cancelTransfer(targetProductId: string) {
        const targetProduct = await this.prisma.product.findUnique({ where: { id: targetProductId } });
        if (!targetProduct) throw new NotFoundException('Product not found');

        const targetSd = (targetProduct.specificData as any) || {};
        const sourceProductId = targetSd.pendingIncoming?.sourceProductId;

        if (!sourceProductId) throw new Error('Informations de source manquantes');

        const quantiteARendre = targetSd.pendingIncoming?.quantite || 1;
        const { pendingIncoming: _, ...cleanedTargetSd } = targetSd;

        return this.prisma.$transaction(async (tx) => {
            // Return N units to source
            await tx.product.update({
                where: { id: sourceProductId },
                data: {
                    quantiteActuelle: { increment: quantiteARendre },
                    statut: 'DISPONIBLE' // Assuming stock becomes > 0, or at least not reserved. Ideally check.
                }
            });

            // Clean source metadata
            const sourceProduct = await tx.product.findUnique({ where: { id: sourceProductId } });
            if (sourceProduct) {
                const sourceSd = (sourceProduct.specificData as any) || {};
                if (sourceSd.pendingOutgoing) {
                    sourceSd.pendingOutgoing = sourceSd.pendingOutgoing.filter((t: any) => t.targetProductId !== targetProductId);
                    await tx.product.update({
                        where: { id: sourceProductId },
                        data: { specificData: sourceSd }
                    });
                }
            }

            // Clear target metadata and reset status
            // We need to check current stock to decide status?
            // Since we are un-reserving, and assuming we didn't add stock yet (since it wasn't received).
            // If stock is 0, it should be RUPTURE. If stock > 0, DISPONIBLE.
            // But we can't easily check stock inside update without fetch.
            // So let's fetch first? Or blindly set based on fetching targetProduct before.

            const newStatus = targetProduct.quantiteActuelle > 0 ? 'DISPONIBLE' : 'RUPTURE';

            return tx.product.update({
                where: { id: targetProductId },
                data: {
                    specificData: cleanedTargetSd,
                    statut: newStatus
                }
            });
        });
    }

    async completeTransfer(targetProductId: string) {
        const targetProduct = await this.prisma.product.findUnique({
            where: { id: targetProductId },
            include: { entrepot: true }
        });
        if (!targetProduct) throw new NotFoundException('Product not found');

        const sd = (targetProduct.specificData as any) || {};
        if (!sd.pendingIncoming) throw new Error('Aucun transfert entrant trouvé');
        if (sd.pendingIncoming.status !== 'SHIPPED') {
            throw new Error('Le transfert doit être expédié par la source avant d\'être reçu.');
        }

        const sourceProductId = sd.pendingIncoming.sourceProductId;
        const quantiteRecue = sd.pendingIncoming.quantite || 1;

        // Don't just delete pendingIncoming, transform it into a history record
        const { pendingIncoming, ...restSd } = sd;
        const lastTransferReception = {
            date: new Date().toISOString(),
            sourceCentreId: pendingIncoming.sourceCentreId,
            sourceCentreName: pendingIncoming.sourceCentreName,
            numeroTransfert: pendingIncoming.numeroTransfert,
            sourceProductId: pendingIncoming.sourceProductId
        };
        const updatedSd = { ...restSd, lastTransferReception };

        return this.prisma.$transaction(async (tx) => {
            // Increment local stock
            await tx.product.update({
                where: { id: targetProductId },
                data: {
                    quantiteActuelle: { increment: quantiteRecue },
                    statut: 'DISPONIBLE', // Reset to available upon reception
                    specificData: updatedSd
                }
            });

            // Clean source metadata (remove from pendingOutgoing)
            if (sourceProductId) {
                const sourceProduct = await tx.product.findUnique({ where: { id: sourceProductId } });
                if (sourceProduct) {
                    const sourceSd = (sourceProduct.specificData as any) || {};
                    if (sourceSd.pendingOutgoing) {
                        sourceSd.pendingOutgoing = sourceSd.pendingOutgoing.filter((t: any) => t.targetProductId !== targetProductId);
                        await tx.product.update({
                            where: { id: sourceProductId },
                            data: { specificData: sourceSd }
                        });
                    }
                }
            }

            // Create movement record for local reception
            return tx.mouvementStock.create({
                data: {
                    type: 'RECEPTION',
                    quantite: quantiteRecue,
                    produitId: targetProductId,
                    entrepotDestinationId: targetProduct.entrepotId,
                    prixAchatUnitaire: targetProduct.prixAchatHT,
                    prixVenteUnitaire: targetProduct.prixVenteTTC,
                    motif: `${sd.pendingIncoming.numeroTransfert || 'TRS-NEW'} - Réception`,
                    utilisateur: 'System'
                }
            });
        });
    }

    async getStockStats(centreId?: string) {
        if (!centreId) {
            return {
                totalProduits: 0,
                valeurStockTotal: 0,
                caNonConsolide: 0,
                produitsStockBas: 0,
                produitsRupture: 0,
                produitsReserves: 0,
                produitsEnTransit: 0
            };
        }

        const allProducts = await this.prisma.product.findMany({
            where: { entrepot: { centreId } },
            include: { entrepot: true }
        });

        const stats = {
            totalProduits: 0,
            valeurStockTotal: 0,
            caNonConsolide: 0,
            produitsStockBas: 0,
            produitsRupture: 0,
            produitsReserves: 0,
            produitsEnTransit: 0,
            byType: {
                montures: 0,
                verres: 0,
                lentilles: 0,
                accessoires: 0
            }
        };

        allProducts.forEach(p => {
            const isDefective = p.entrepot?.nom?.toLowerCase().includes('défectueux') ||
                p.entrepot?.nom?.toLowerCase().includes('defectueux') ||
                p.entrepot?.nom?.toUpperCase() === 'DÉFECTUEUX';

            if (isDefective) {
                stats.caNonConsolide += (p.quantiteActuelle * (p.prixAchatHT || 0));
            } else {
                // Main stats only for salable stock
                stats.totalProduits += p.quantiteActuelle;
                stats.valeurStockTotal += (p.quantiteActuelle * (p.prixAchatHT || 0));

                if (p.quantiteActuelle > 0 && p.quantiteActuelle <= p.seuilAlerte) {
                    stats.produitsStockBas++;
                }

                if (p.quantiteActuelle <= 0) {
                    stats.produitsRupture++;
                }

                const sd = (p.specificData as any) || {};
                if (sd.pendingIncoming?.status === 'RESERVED') {
                    stats.produitsReserves++;
                }
                if (sd.pendingIncoming?.status === 'SHIPPED') {
                    stats.produitsEnTransit++;
                }

                // byType breakdown
                const type = p.typeArticle;
                if (type === 'MONTURE_OPTIQUE' || type === 'MONTURE_SOLAIRE' || type === 'monture') {
                    stats.byType.montures += p.quantiteActuelle;
                } else if (type === 'VERRE' || type === 'verre') {
                    stats.byType.verres += p.quantiteActuelle;
                } else if (type === 'LENTILLE' || type === 'lentille') {
                    stats.byType.lentilles += p.quantiteActuelle;
                } else if (type === 'ACCESSOIRE' || type === 'accessoire') {
                    stats.byType.accessoires += p.quantiteActuelle;
                }
            }
        });

        return stats;
    }

    async restock(id: string, quantite: number, motif: string, utilisateur: string = 'System', prixAchatHT?: number, remiseFournisseur?: number) {
        try {
            const product = await this.prisma.product.findUnique({ where: { id } });
            if (!product) throw new NotFoundException('Produit non trouvé');

            // Sanitize numeric inputs (ensure they are valid numbers)
            const cleanQuantite = isNaN(Number(quantite)) ? 0 : Number(quantite);
            const cleanNewPrice = prixAchatHT !== undefined && !isNaN(Number(prixAchatHT)) ? Number(prixAchatHT) : undefined;
            const cleanRemise = remiseFournisseur !== undefined && !isNaN(Number(remiseFournisseur)) ? Number(remiseFournisseur) : 0;

            if (cleanQuantite <= 0) throw new BadRequestException('La quantité doit être supérieure à 0');
            if (!product.entrepotId) throw new BadRequestException('Le produit n\'est rattaché à aucun entrepôt');

            // Apply discount to the new price if provided
            const finalNewPriceHT = cleanNewPrice !== undefined ? cleanNewPrice * (1 - cleanRemise / 100) : undefined;

            return await this.prisma.$transaction(async (tx) => {
                // Calculate new Weighted Average Price (PMP)
                let updatedPrixAchatHT = product.prixAchatHT;
                if (finalNewPriceHT !== undefined) {
                    const currentStock = product.quantiteActuelle > 0 ? product.quantiteActuelle : 0;
                    const currentValue = currentStock * product.prixAchatHT;
                    const newValue = cleanQuantite * finalNewPriceHT;
                    updatedPrixAchatHT = (currentValue + newValue) / (currentStock + cleanQuantite);

                    // Round to 2 decimal places
                    updatedPrixAchatHT = Math.round(updatedPrixAchatHT * 100) / 100;
                }

                await tx.product.update({
                    where: { id },
                    data: {
                        quantiteActuelle: { increment: cleanQuantite },
                        prixAchatHT: updatedPrixAchatHT
                    }
                });

                return tx.mouvementStock.create({
                    data: {
                        type: 'ENTREE_ACHAT',
                        quantite: cleanQuantite,
                        produitId: id,
                        entrepotDestinationId: product.entrepotId,
                        motif: motif || 'Réapprovisionnement manuel',
                        utilisateur: utilisateur || 'System',
                        prixAchatUnitaire: finalNewPriceHT !== undefined ? finalNewPriceHT : product.prixAchatHT
                    }
                });
            });
        } catch (error) {
            console.error(`[RESTOCK-ERROR] Failed for product ${id}:`, error);
            if (error instanceof NotFoundException || error instanceof BadRequestException) throw error;
            throw new BadRequestException(error.message || 'Une erreur est survenue lors de la mise à jour du stock');
        }
    }

    async destock(id: string, quantite: number, motif: string, destinationEntrepotId?: string, utilisateur: string = 'System') {
        try {
            const product = await this.prisma.product.findUnique({
                where: { id },
                include: { entrepot: { include: { centre: true } } }
            });

            if (!product) throw new NotFoundException('Produit non trouvé');

            // Sanitize numeric inputs
            const cleanQuantite = isNaN(Number(quantite)) ? 0 : Number(quantite);
            if (cleanQuantite <= 0) throw new Error('La quantité doit être supérieure à 0');

            if (product.quantiteActuelle < cleanQuantite) {
                throw new Error(`Quantité insuffisante en stock (Actuel: ${product.quantiteActuelle})`);
            }

            return await this.prisma.$transaction(async (tx) => {
                let effectiveMotif = motif || 'Sortie manuelle';
                // 1. Determine if we should route to defective warehouse automatically
                const isDefective = motif?.toLowerCase().includes('casse') || motif?.toLowerCase().includes('défectueux');
                let effectiveDestinationId = destinationEntrepotId;

                if (isDefective && !effectiveDestinationId) {
                    // Standardized lookup for defective warehouse
                    let defectiveWarehouse = await tx.entrepot.findFirst({
                        where: {
                            centreId: product.entrepot.centreId,
                            OR: [
                                { nom: { equals: 'Entrepot Défectueux', mode: 'insensitive' } },
                                { nom: { equals: 'DÉFECTUEUX', mode: 'insensitive' } },
                                { nom: { contains: 'défectueux', mode: 'insensitive' } }
                            ]
                        }
                    });

                    if (!defectiveWarehouse) {
                        defectiveWarehouse = await tx.entrepot.create({
                            data: {
                                nom: 'Entrepot Défectueux',
                                type: 'TRANSIT',
                                description: 'Entrepôt pour les retours défectueux et sorties de stock non consolidées',
                                centreId: product.entrepot.centreId
                            }
                        });
                    }
                    effectiveDestinationId = defectiveWarehouse.id;
                }

                // 2. Update source product
                const updatedProduct = await tx.product.update({
                    where: { id },
                    data: {
                        quantiteActuelle: { decrement: cleanQuantite },
                        statut: product.quantiteActuelle - cleanQuantite <= 0 ? 'RUPTURE' : product.statut
                    }
                });

                // 3. Determine movement type
                let movementType = 'SORTIE_MANUELLE';
                if (effectiveDestinationId) {
                    movementType = 'TRANSFERT_SORTIE';
                }

                // 4. Create movement record for source
                const currentMotif = motif || 'Sortie manuelle';
                await tx.mouvementStock.create({
                    data: {
                        type: movementType,
                        quantite: -cleanQuantite, // Negative for sortie
                        produitId: id,
                        entrepotSourceId: product.entrepotId,
                        entrepotDestinationId: effectiveDestinationId || null,
                        motif: currentMotif,
                        utilisateur: utilisateur || 'System',
                        prixAchatUnitaire: product.prixAchatHT,
                        prixVenteUnitaire: product.prixVenteTTC
                    }
                });

                // 5. If destination provided (or automated), handle the entry there
                let targetProduct: any = null;
                let savedProduct: any = null;

                if (effectiveDestinationId) {
                    const destinationWh = await tx.entrepot.findUnique({ where: { id: effectiveDestinationId } });
                    const isCrossCenter = destinationWh && destinationWh.centreId !== product.entrepot.centreId;

                    console.log(`🚚 [DESTOCK-DEBUG] Transfer requested. Dest: ${effectiveDestinationId} (${destinationWh?.nom})`);
                    console.log(`   📍 Source Center: ${product.entrepot.centreId} | Dest Center: ${destinationWh?.centreId}`);
                    console.log(`   🌍 Is Cross-Center? ${isCrossCenter}`);

                    // Find or create product in target warehouse (Robust matching)
                    targetProduct = await tx.product.findFirst({
                        where: {
                            entrepotId: effectiveDestinationId,
                            OR: [
                                product.codeInterne ? { codeInterne: product.codeInterne } : {},
                                product.codeBarres ? { codeBarres: product.codeBarres } : {},
                                { designation: { equals: product.designation, mode: 'insensitive' as any } }
                            ].filter(q => Object.keys(q).length > 0)
                        } as any
                    });

                    if (!targetProduct) {
                        console.log(`   ⭐️ Creating new product in target warehouse...`);
                        // Clone product to target - Exclude all relations and system fields
                        const { id: _, entrepotId: __, entrepot: ___, mouvements: ____, createdAt: _____, updatedAt: ______, ...prodData } = product as any;
                        targetProduct = await tx.product.create({
                            data: {
                                ...prodData,
                                entrepotId: effectiveDestinationId,
                                quantiteActuelle: 0,
                                statut: 'DISPONIBLE'
                            }
                        });
                    }

                    if (isCrossCenter) {
                        // FORMAL TRANSFER: Mark as RESERVED to require manual validation at source
                        const numeroTransfert = await this.generateNextTransferNumber(tx);
                        console.log(`   📝 Generating Transfer #${numeroTransfert}`);

                        const tsd = (targetProduct.specificData as any) || {};
                        const updatedTsd = {
                            ...tsd,
                            pendingIncoming: {
                                numeroTransfert, // Standard field for both tabs
                                sourceProductId: product.id,
                                sourceWarehouseId: product.entrepotId,
                                sourceCentreId: product.entrepot.centreId,
                                sourceCentreName: product.entrepot.centre?.nom,
                                status: 'RESERVED',
                                quantite: cleanQuantite,
                                date: new Date().toISOString()
                            }
                        };

                        const ssd = (updatedProduct.specificData as any) || {};
                        const existingOutgoing = Array.isArray(ssd.pendingOutgoing) ? ssd.pendingOutgoing : [];
                        const updatedSsd = {
                            ...ssd,
                            pendingOutgoing: [
                                ...existingOutgoing,
                                {
                                    targetProductId: targetProduct.id,
                                    status: 'RESERVED',
                                    quantite: cleanQuantite,
                                    date: new Date().toISOString(),
                                    numeroTransfert
                                }
                            ]
                        };

                        console.log(`   💾 Updating Source Product ${updatedProduct.id} with pendingOutgoing`, updatedSsd.pendingOutgoing);

                        targetProduct = await tx.product.update({
                            where: { id: targetProduct.id },
                            data: {
                                statut: 'RESERVE',
                                specificData: updatedTsd
                            }
                        });

                        console.log(`   🎯 [DESTOCK-DEBUG] Target Product AFTER update:`, {
                            id: targetProduct.id,
                            entrepotId: targetProduct.entrepotId,
                            specificDataType: typeof targetProduct.specificData,
                            hasPendingIncoming: !!(targetProduct.specificData as any)?.pendingIncoming,
                            pendingIncomingStatus: (targetProduct.specificData as any)?.pendingIncoming?.status
                        });

                        savedProduct = await tx.product.update({
                            where: { id: updatedProduct.id },
                            data: { specificData: updatedSsd }
                        });
                        console.log(`   ✅ [DESTOCK-VERIFY] Saved Source Product ${savedProduct.id}. pendingOutgoing length: ${(savedProduct.specificData as any)?.pendingOutgoing?.length}`);

                        // Update movement record motif with TRS number for history
                        const trsMotif = `${numeroTransfert} - Transfert AUTO`;

                        // Update the sortie movement we just created to include the TRS number
                        // (Alternative: wait and create both movements at once, but this is cleaner)
                        await tx.mouvementStock.updateMany({
                            where: {
                                produitId: id,
                                type: 'TRANSFERT_SORTIE',
                                motif: currentMotif,
                                createdAt: { gte: new Date(Date.now() - 5000) } // Safety: only our recent one
                            },
                            data: { motif: `${numeroTransfert} - ${currentMotif}` }
                        });

                        effectiveMotif = trsMotif;
                    } else {
                        // INSTANT TRANSFER (Same center or manual defective routing)
                        targetProduct = await tx.product.update({
                            where: { id: targetProduct.id },
                            data: { quantiteActuelle: { increment: cleanQuantite } }
                        });
                    }

                    // Create movement record for destination
                    await tx.mouvementStock.create({
                        data: {
                            type: 'TRANSFERT_ENTREE',
                            quantite: cleanQuantite,
                            produitId: targetProduct.id,
                            entrepotSourceId: product.entrepotId,
                            entrepotDestinationId: effectiveDestinationId,
                            motif: effectiveMotif,
                            utilisateur: utilisateur,
                            prixAchatUnitaire: product.prixAchatHT,
                            prixVenteUnitaire: product.prixVenteTTC
                        }
                    });
                }

                console.log(`   🔍 [DESTOCK-FINAL] Returning:`, {
                    sourceId: (savedProduct || updatedProduct).id,
                    targetId: targetProduct?.id,
                    targetHasSpecificData: !!targetProduct?.specificData,
                    targetPendingIncoming: (targetProduct?.specificData as any)?.pendingIncoming
                });

                return { source: savedProduct || updatedProduct, target: targetProduct };
            });
        } catch (error) {
            console.error(`[DESTOCK-ERROR] Failed for product ${id}:`, error);
            if (error instanceof NotFoundException || error instanceof BadRequestException) throw error;
            throw new BadRequestException(error.message || 'Une erreur est survenue lors de la sortie de stock');
        }
    }

    async getTransferHistory(params: {
        startDate?: string;
        endDate?: string;
        centreId?: string;
        productId?: string;
        type?: string;
    }) {
        const { startDate, endDate, centreId, productId, type } = params;

        const where: Prisma.MouvementStockWhereInput = {
            type: type ? (type as any) : {
                in: ['TRANSFERT_INIT', 'TRANSFERT_SORTIE', 'TRANSFERT_ENTREE', 'RECEPTION', 'TRANSFERT_ANNULE', 'EXPEDITION']
            }
        };

        if (startDate || endDate) {
            where.dateMovement = {};
            if (startDate) where.dateMovement.gte = new Date(startDate);
            if (endDate) where.dateMovement.lte = new Date(endDate);
        }

        if (productId) {
            where.produitId = productId;
        }

        if (centreId) {
            where.OR = [
                { produit: { entrepot: { centreId } } },
                { entrepotSource: { centreId } },
                { entrepotDestination: { centreId } }
            ];
        }

        return this.prisma.mouvementStock.findMany({
            where,
            include: {
                produit: {
                    include: {
                        entrepot: {
                            include: { centre: true }
                        }
                    }
                },
                entrepotSource: { include: { centre: true } },
                entrepotDestination: { include: { centre: true } }
            },
            orderBy: { dateMovement: 'desc' }
        });
    }

    async syncProductState(productId: string, tx?: any) {
        const prisma = tx || this.prisma;

        const product = await prisma.product.findUnique({
            where: { id: productId },
            include: {
                mouvements: {
                    orderBy: { dateMovement: 'asc' }
                }
            }
        });

        if (!product) return;

        // 1. If NO movements left AND created by system, delete product
        if (product.mouvements.length === 0) {
            if (product.utilisateurCreation === 'system' || product.utilisateurCreation === 'System') {
                return await prisma.product.delete({ where: { id: productId } });
            }
            // If manual product but no movements, just reset to 0
            return await prisma.product.update({
                where: { id: productId },
                data: { quantiteActuelle: 0, prixAchatHT: product.prixAchatHT || 0 }
            });
        }

        // 2. Recalculate Quantite Actuelle
        const newQty = product.mouvements.reduce((sum, mov) => sum + mov.quantite, 0);

        // 3. Recalculate Weighted Average Price (PMP)
        // Formula: New PMP = (Current Value + New Entry Value) / (Current Qty + New Qty)
        let calculatedPMP = 0;
        let currentQtyForPMP = 0;

        for (const mov of product.mouvements) {
            if (mov.quantite > 0) {
                // Entry (Purchase, Reception, Inventaire)
                const entryQty = mov.quantite;
                const entryPrice = mov.prixAchatUnitaire || 0;

                if (currentQtyForPMP <= 0) {
                    calculatedPMP = entryPrice;
                } else {
                    const currentValue = currentQtyForPMP * calculatedPMP;
                    const entryValue = entryQty * entryPrice;
                    calculatedPMP = (currentValue + entryValue) / (currentQtyForPMP + entryQty);
                }
                currentQtyForPMP += entryQty;
            } else if (mov.quantite < 0) {
                // Exit (Sale, Transfer, Sortie)
                // PMP doesn't change on exit, only quantity does
                currentQtyForPMP += mov.quantite;
                if (currentQtyForPMP < 0) currentQtyForPMP = 0;
            }
        }

        // 4. Update Product
        return await prisma.product.update({
            where: { id: productId },
            data: {
                quantiteActuelle: newQty,
                prixAchatHT: Math.round(calculatedPMP * 100) / 100,
                statut: newQty > 0 ? 'DISPONIBLE' : 'RUPTURE'
            }
        });
    }

    async cleanupOutOfStock(centreId: string) {
        // Find all products in rupture for this center
        const productsInRupture = await this.prisma.product.findMany({
            where: {
                quantiteActuelle: { lte: 0 },
                entrepot: { centreId },
                statut: { not: 'OBSOLETE' }
            }
        });

        let deletedCount = 0;
        let archivedCount = 0;

        for (const product of productsInRupture) {
            // Always try to delete first, but catch any constraint errors
            try {
                await this.prisma.product.delete({
                    where: { id: product.id }
                });
                deletedCount++;
            } catch (e) {
                // Any error (foreign key, etc.) means we should archive instead
                try {
                    await this.prisma.product.update({
                        where: { id: product.id },
                        data: { statut: 'OBSOLETE' as any }
                    });
                    archivedCount++;
                } catch (archiveError) {
                    console.error(`Failed to archive product ${product.id}:`, archiveError);
                }
            }
        }

        return { deletedCount, archivedCount };
    }
}
