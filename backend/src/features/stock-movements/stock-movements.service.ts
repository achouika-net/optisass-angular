import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BulkAlimentationDto } from './dto/bulk-alimentation.dto';
import { ProductsService } from '../products/products.service';
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

                const invoice = await tx.factureFournisseur.create({
                    data: {
                        numeroFacture: invoiceData.numeroFacture,
                        dateEmission: new Date(invoiceData.dateEmission),
                        type: invoiceData.type,
                        statut: 'A_PAYER',
                        montantHT: totalHT,
                        montantTVA: totalTTC - totalHT,
                        montantTTC: totalTTC,
                        fournisseurId: invoiceData.fournisseurId,
                        centreId: invoiceData.centreId,
                        pieceJointeUrl: pieceJointeUrl,
                        echeances: {
                            create: [
                                {
                                    type: 'ESPECES',
                                    dateEcheance: new Date(invoiceData.dateEmission),
                                    montant: totalTTC,
                                    statut: 'EN_ATTENTE'
                                }
                            ]
                        }
                    }
                });

                for (const alloc of allocations) {
                    let targetProduct = await this.productsService.findLocalCounterpart({
                        designation: alloc.nom,
                        codeInterne: alloc.reference,
                        centreId: invoiceData.centreId || '',
                        entrepotId: alloc.warehouseId
                    });

                    if (!targetProduct) {
                        const template = await tx.product.findFirst({
                            where: { designation: alloc.nom, codeInterne: alloc.reference }
                        });

                        targetProduct = await tx.product.create({
                            data: {
                                designation: alloc.nom,
                                marque: alloc.marque,
                                codeInterne: alloc.reference,
                                codeBarres: alloc.reference,
                                typeArticle: template?.typeArticle || alloc.categorie || 'AUTRE',
                                prixAchatHT: Number(alloc.prixAchat),
                                prixVenteHT: Number(alloc.prixVente),
                                prixVenteTTC: Number(alloc.prixVente) * (1 + Number(alloc.tva) / 100),
                                quantiteActuelle: 0,
                                seuilAlerte: template?.seuilAlerte || 2,
                                statut: 'DISPONIBLE',
                                entrepotId: alloc.warehouseId,
                                specificData: (template?.specificData as any) || {},
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
                                typeArticle: targetProduct.typeArticle || alloc.categorie
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
            if (error.code === 'P2002') {
                throw new BadRequestException('Ce numéro de facture existe déjà pour ce fournisseur.');
            }
            throw new BadRequestException(`Erreur lors de l'enregistrement : ${error.message}`);
        }
    }

    async getHistory(filters: { dateFrom?: string; dateTo?: string; supplierId?: string; docType?: string }) {
        const whereClause: any = {};

        // Handle Document Type Filter
        if (filters.docType === 'BL') {
            whereClause.type = 'BL';
        } else if (filters.docType === 'FACTURE') {
            whereClause.type = { in: ['ACHAT_STOCK', 'FACTURE'] };
        } else {
            // Default: Show all relevant types
            whereClause.type = { in: ['ACHAT_STOCK', 'FACTURE', 'BL'] };
        }

        if (filters.dateFrom || filters.dateTo) {
            whereClause.dateEmission = {};
            if (filters.dateFrom) whereClause.dateEmission.gte = new Date(filters.dateFrom);
            if (filters.dateTo) whereClause.dateEmission.lte = new Date(filters.dateTo);
        }

        if (filters.supplierId) {
            whereClause.fournisseurId = filters.supplierId;
        }

        const results = await this.prisma.factureFournisseur.findMany({
            where: whereClause,
            take: 50,
            orderBy: { createdAt: 'desc' },
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
        return results;
    }
}
