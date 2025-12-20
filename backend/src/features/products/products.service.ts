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

    async findAll(entrepotId?: string, centreId?: string) {
        const where: any = {};

        if (!centreId && !entrepotId) return []; // Isolation
        if (entrepotId) where.entrepotId = entrepotId;
        if (centreId) {
            where.entrepot = { centreId };
        }

        return this.prisma.product.findMany({
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
    }

    async findOne(id: string) {
        const product = await this.prisma.product.findUnique({
            where: { id },
            include: {
                entrepot: true
            }
        });

        if (!product) {
            throw new NotFoundException(`Product with ID ${id} not found`);
        }

        // Flatten specificData for easier consumption by frontend if needed, 
        // or frontend handles it. 
        // Prisma returns specificData as Json object.
        // We can spread it into the result if the frontend expects a flat object.
        const { specificData, ...rest } = product;
        const flatProduct = {
            ...rest,
            ...(specificData as object || {})
        };

        return flatProduct;
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

    async initiateTransfer(productId: string, targetWarehouseId: string) {
        const product = await this.prisma.product.findUnique({ where: { id: productId } });
        if (!product) throw new NotFoundException('Product not found');

        const currentSpecificData = product.specificData as any || {};
        const newSpecificData = {
            ...currentSpecificData,
            pendingTransfer: {
                targetWarehouseId,
                date: new Date().toISOString()
            }
        };

        return this.prisma.$transaction([
            this.prisma.product.update({
                where: { id: productId },
                data: {
                    statut: 'RESERVE',
                    specificData: newSpecificData
                }
            }),
            this.prisma.mouvementStock.create({
                data: {
                    type: 'TRANSFERT_INIT',
                    quantite: product.quantiteActuelle, // Information only, usually 0 change in stock count total, but logs quantity moving
                    produitId: productId,
                    entrepotSourceId: product.entrepotId,
                    entrepotDestinationId: targetWarehouseId,
                    motif: 'Initiation transfert (Réservation)',
                    utilisateur: 'Demo User' // TODO: Get actua user
                }
            })
        ]);
    }

    async completeTransfer(productId: string) {
        const product = await this.prisma.product.findUnique({ where: { id: productId } });
        if (!product) throw new NotFoundException('Product not found');

        const specificData = product.specificData as any || {};
        const pendingTransfer = specificData.pendingTransfer;

        if (!pendingTransfer || !pendingTransfer.targetWarehouseId) {
            throw new Error('Aucun transfert en attente pour ce produit');
        }

        const targetWarehouseId = pendingTransfer.targetWarehouseId;
        const sourceWarehouseId = product.entrepotId;

        // Remove pendingTransfer (clean way)
        const { pendingTransfer: _, ...cleanedSpecificData } = specificData;

        return this.prisma.$transaction([
            this.prisma.product.update({
                where: { id: productId },
                data: {
                    statut: 'DISPONIBLE',
                    entrepotId: targetWarehouseId,
                    specificData: cleanedSpecificData
                }
            }),
            this.prisma.mouvementStock.create({
                data: {
                    type: 'TRANSFERT_FINAL',
                    quantite: product.quantiteActuelle,
                    produitId: productId,
                    entrepotSourceId: sourceWarehouseId,
                    entrepotDestinationId: targetWarehouseId,
                    motif: 'Validation réception transfert',
                    utilisateur: 'Demo User'
                }
            })
        ]);
    }

    async getStockStats(centreId?: string) {
        if (!centreId) {
            return {
                totalProduits: 0,
                valeurStockTotal: 0,
                produitsStockBas: 0,
                produitsRupture: 0,
                byType: {
                    montures: 0,
                    verres: 0,
                    lentilles: 0,
                    accessoires: 0
                }
            };
        }

        const products = await this.prisma.product.findMany({
            where: {
                entrepot: { centreId }
            },
            include: {
                entrepot: true
            }
        });

        const stats = {
            totalProduits: products.length,
            valeurStockTotal: products.reduce((acc, p) => acc + (p.quantiteActuelle * (p.prixAchatHT || 0)), 0),
            produitsStockBas: products.filter(p => p.quantiteActuelle > 0 && p.quantiteActuelle <= p.seuilAlerte).length,
            produitsRupture: products.filter(p => p.quantiteActuelle <= 0).length,
            byType: {
                montures: products.filter(p => p.typeArticle === 'MONTURE').length,
                verres: products.filter(p => p.typeArticle === 'VERRE').length,
                lentilles: products.filter(p => p.typeArticle === 'LENTILLE').length,
                accessoires: products.filter(p => p.typeArticle === 'ACCESSOIRE').length
            }
        };

        return stats;
    }
}
