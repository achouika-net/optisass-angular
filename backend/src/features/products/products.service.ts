import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
    constructor(private prisma: PrismaService) { }

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

            return await this.prisma.product.create({
                data: {
                    ...mainAndRelationalFields,
                    // Ensure codeBarres is present (fallback to codeInterne if missing to avoid Prisma error)
                    codeBarres: codeBarres,
                    statut: mainAndRelationalFields.statut ?? 'DISPONIBLE',
                    specificData: newSpecificData,
                    utilisateurCreation: mainAndRelationalFields.utilisateurCreation || 'system'
                },
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

    async findAll(entrepotId?: string, centreId?: string, globalSearch: boolean = false) {
        const where: any = {};

        if (!centreId && !entrepotId && !globalSearch) return []; // Isolation
        if (entrepotId) where.entrepotId = entrepotId;

        // Only apply centre scope if NOT a global search
        // For performance, we still want to limit but we must include items targeting this centre
        // Since Prisma OR with JSON path is tricky, we fetch items from current centre OR all reserved/in-transit
        // and filter in memory.
        const products = await this.prisma.product.findMany({
            where: globalSearch ? {} : {
                entrepot: { centreId }
            },
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
        // Check if exists
        await this.findOne(id);
        return this.prisma.product.delete({
            where: { id },
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
        if (sourceProduct.quantiteActuelle < quantite) throw new Error('Stock insuffisant à la source');

        const targetSpecificData = (targetProduct.specificData as any) || {};
        const updatedTargetData = {
            ...targetSpecificData,
            pendingIncoming: {
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
                { targetProductId: targetProduct.id, status: 'RESERVED', quantite: quantite, date: new Date().toISOString() }
            ]
        };

        return this.prisma.$transaction([
            // Decrement source
            this.prisma.product.update({
                where: { id: sourceProductId },
                data: {
                    quantiteActuelle: { decrement: quantite },
                    specificData: updatedSourceData
                }
            }),
            // Tag target
            this.prisma.product.update({
                where: { id: targetProductId },
                data: {
                    statut: 'RESERVE', // Explicitly mark as reserved during initiation
                    specificData: updatedTargetData
                }
            }),
            this.prisma.mouvementStock.create({
                data: {
                    type: 'TRANSFERT_INIT',
                    quantite: -quantite,
                    produitId: sourceProductId,
                    entrepotSourceId: sourceProduct.entrepotId,
                    entrepotDestinationId: targetProduct.entrepotId,
                    motif: `Réservation pour ${targetProduct.entrepot?.centre?.nom}`,
                    utilisateur: 'System'
                }
            })
        ]);
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

    async cancelTransfer(targetProductId: string) {
        const targetProduct = await this.prisma.product.findUnique({ where: { id: targetProductId } });
        if (!targetProduct) throw new NotFoundException('Product not found');

        const targetSd = (targetProduct.specificData as any) || {};
        const sourceProductId = targetSd.pendingIncoming?.sourceProductId;

        if (!sourceProductId) throw new Error('Informations de source manquantes');

        const { pendingIncoming: _, ...cleanedTargetSd } = targetSd;

        return this.prisma.$transaction(async (tx) => {
            // Return 1 unit to source
            await tx.product.update({
                where: { id: sourceProductId },
                data: { quantiteActuelle: { increment: 1 } }
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

            // Clear target metadata
            return tx.product.update({
                where: { id: targetProductId },
                data: { specificData: cleanedTargetSd }
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
        const { pendingIncoming: _, ...cleanedSd } = sd;

        return this.prisma.$transaction(async (tx) => {
            // Increment local stock
            await tx.product.update({
                where: { id: targetProductId },
                data: {
                    quantiteActuelle: { increment: quantiteRecue },
                    statut: 'DISPONIBLE', // Reset to available upon reception
                    specificData: cleanedSd
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

            return tx.mouvementStock.create({
                data: {
                    type: 'RECEPTION',
                    quantite: quantiteRecue,
                    produitId: targetProductId,
                    entrepotDestinationId: targetProduct.entrepotId,
                    motif: 'Confirmation réception transfert',
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
            totalProduits: allProducts.reduce((acc, p) => acc + p.quantiteActuelle, 0),
            valeurStockTotal: allProducts.reduce((acc, p) => acc + (p.quantiteActuelle * (p.prixAchatHT || 0)), 0),
            caNonConsolide: allProducts.reduce((acc, p) => {
                const isDefective = p.entrepot?.nom?.toLowerCase().includes('défectueux') ||
                    p.entrepot?.nom?.toLowerCase().includes('defectueux') ||
                    p.entrepot?.nom?.toUpperCase() === 'DÉFECTUEUX';

                if (isDefective) {
                    return acc + (p.quantiteActuelle * (p.prixVenteTTC || 0));
                }
                return acc;
            }, 0),
            produitsStockBas: allProducts.filter(p => p.quantiteActuelle > 0 && p.quantiteActuelle <= p.seuilAlerte).length,
            produitsRupture: allProducts.filter(p => p.quantiteActuelle <= 0).length,
            produitsReserves: allProducts.filter(p => (p.specificData as any)?.pendingIncoming?.status === 'RESERVED').length,
            produitsEnTransit: allProducts.filter(p => (p.specificData as any)?.pendingIncoming?.status === 'SHIPPED').length
        };

        return stats;
    }

    async restock(id: string, quantite: number, motif: string, utilisateur: string = 'System', prixAchatHT?: number, remiseFournisseur?: number) {
        // ... (existing implementation)
    }

    async destock(id: string, quantite: number, motif: string, destinationEntrepotId?: string, utilisateur: string = 'System') {
        const product = await this.prisma.product.findUnique({
            where: { id },
            include: { entrepot: { include: { centre: true } } }
        });

        if (!product) throw new NotFoundException('Produit non trouvé');
        if (product.quantiteActuelle < quantite) {
            throw new Error(`Quantité insuffisante en stock (Actuel: ${product.quantiteActuelle})`);
        }

        return this.prisma.$transaction(async (tx) => {
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
                    quantiteActuelle: { decrement: quantite },
                    statut: product.quantiteActuelle - quantite <= 0 ? 'RUPTURE' : product.statut
                }
            });

            // 3. Determine movement type
            let movementType = 'SORTIE_MANUELLE';
            if (effectiveDestinationId) {
                movementType = 'TRANSFERT_SORTIE';
            }

            // 4. Create movement record for source
            await tx.mouvementStock.create({
                data: {
                    type: movementType,
                    quantite: -quantite, // Negative for sortie
                    produitId: id,
                    entrepotSourceId: product.entrepotId,
                    entrepotDestinationId: effectiveDestinationId || null,
                    motif: motif || 'Sortie manuelle',
                    utilisateur: utilisateur,
                    prixAchatUnitaire: product.prixAchatHT,
                    prixVenteUnitaire: product.prixVenteTTC
                }
            });

            // 5. If destination provided (or automated), handle the entry there
            let targetProduct: any = null;
            if (effectiveDestinationId) {
                const destinationWh = await tx.entrepot.findUnique({ where: { id: effectiveDestinationId } });
                const isCrossCenter = destinationWh && destinationWh.centreId !== product.entrepot.centreId;

                // Find or create product in target warehouse
                targetProduct = await tx.product.findFirst({
                    where: { codeInterne: product.codeInterne, entrepotId: effectiveDestinationId }
                });

                if (!targetProduct) {
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
                    // FORMAL TRANSFER: Mark as Shipped (Arrival) to require reception
                    const tsd = (targetProduct.specificData as any) || {};
                    const updatedTsd = {
                        ...tsd,
                        pendingIncoming: {
                            sourceProductId: product.id,
                            sourceWarehouseId: product.entrepotId,
                            sourceCentreId: product.entrepot.centreId,
                            sourceCentreName: product.entrepot.centre?.nom,
                            status: 'SHIPPED',
                            quantite: quantite,
                            date: new Date().toISOString()
                        }
                    };

                    const ssd = (updatedProduct.specificData as any) || {};
                    const updatedSsd = {
                        ...ssd,
                        pendingOutgoing: [
                            ...(ssd.pendingOutgoing || []),
                            { targetProductId: targetProduct.id, status: 'SHIPPED', quantite: quantite, date: new Date().toISOString() }
                        ]
                    };

                    await tx.product.update({
                        where: { id: targetProduct.id },
                        data: {
                            statut: 'EN_TRANSIT',
                            specificData: updatedTsd
                        }
                    });

                    await tx.product.update({
                        where: { id: updatedProduct.id },
                        data: { specificData: updatedSsd }
                    });

                } else {
                    // INSTANT TRANSFER (Same center or manual defective routing)
                    await tx.product.update({
                        where: { id: targetProduct.id },
                        data: { quantiteActuelle: { increment: quantite } }
                    });
                }

                // Create movement record for destination
                await tx.mouvementStock.create({
                    data: {
                        type: 'TRANSFERT_ENTREE',
                        quantite: quantite,
                        produitId: targetProduct.id,
                        entrepotSourceId: product.entrepotId,
                        entrepotDestinationId: effectiveDestinationId,
                        motif: `Transfert depuis ${product.entrepot.nom}: ${motif}`,
                        utilisateur: utilisateur,
                        prixAchatUnitaire: product.prixAchatHT,
                        prixVenteUnitaire: product.prixVenteTTC
                    }
                });
            }

            return { source: updatedProduct, target: targetProduct };
        });
    }
}
