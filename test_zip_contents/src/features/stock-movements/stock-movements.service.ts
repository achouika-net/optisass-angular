import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
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
    private productsService: ProductsService,
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
            client: true,
          },
        },
        bonLivraison: {
          include: {
            fiche: true,
            client: true,
          },
        },
      },
    });
  }

  async processBulkAlimentation(dto: BulkAlimentationDto) {
    const { allocations, base64File, fileName, ...invoiceData } = dto;

    try {
      return await this.prisma.$transaction(async (tx) => {
        let pieceJointeUrl = '';
        if (base64File && fileName) {
          const uploadDir = path.join(process.cwd(), 'uploads', 'invoices');
          if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
          }
          const fileExt = path.extname(fileName) || '.jpg';
          const safeName = `inv_${Date.now()}${fileExt}`;
          const filePath = path.join(uploadDir, safeName);
          const buffer = Buffer.from(
            base64File.replace(/^data:.*?;base64,/, ''),
            'base64',
          );
          fs.writeFileSync(filePath, buffer);
          pieceJointeUrl = `/uploads/invoices/${safeName}`;
        }

        const totalHT = allocations.reduce(
          (sum, a) => sum + Number(a.prixAchat) * Number(a.quantite),
          0,
        );
        const totalTTC = allocations.reduce((sum, a) => {
          const tvaAmount = Number(a.prixAchat) * (Number(a.tva) / 100);
          return sum + (Number(a.prixAchat) + tvaAmount) * Number(a.quantite);
        }, 0);

        let effectiveCentreId = invoiceData.centreId;
        if (!effectiveCentreId && allocations.length > 0) {
          const firstWarehouseId = allocations[0].warehouseId;
          const warehouse = await tx.entrepot.findUnique({
            where: { id: firstWarehouseId },
          });
          if (warehouse?.centreId) {
            effectiveCentreId = warehouse.centreId;
          }
        }

        const trimmedNumero = invoiceData.numeroFacture.trim();
        let invoice = await tx.factureFournisseur.findFirst({
          where: {
            fournisseurId: invoiceData.fournisseurId,
            numeroFacture: {
              equals: trimmedNumero,
              mode: 'insensitive',
            },
          },
          include: { echeances: true },
        });

        if (invoice) {
          throw new BadRequestException(
            `La facture ${invoice.numeroFacture} existe déjà.`,
          );
        }

        invoice = await tx.factureFournisseur.create({
          data: {
            numeroFacture: invoiceData.numeroFacture,
            dateEmission: normalizeToUTCNoon(invoiceData.dateEmission) as Date,
            dateEcheance: normalizeToUTCNoon(
              invoiceData.dateEcheance || invoiceData.dateEmission,
            ) as Date,
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
                  dateEcheance: normalizeToUTCNoon(
                    invoiceData.dateEcheance || invoiceData.dateEmission,
                  ) as Date,
                  montant: totalTTC,
                  statut: 'EN_ATTENTE',
                },
              ],
            },
          },
          include: { echeances: true },
        });

        // Supplier check for automatic payment
        const supplier = await tx.fournisseur.findUnique({
          where: { id: invoiceData.fournisseurId },
        });

        const paymentConditions = (
          (supplier?.convention as any)?.echeancePaiement?.[0] ||
          supplier?.conditionsPaiement ||
          ''
        ).toLowerCase();

        const isCashPayment =
          paymentConditions.includes('comptant') ||
          paymentConditions.includes('espèces') ||
          paymentConditions.includes('espece') ||
          paymentConditions.includes('immédiat') ||
          paymentConditions === '';

        if (isCashPayment && invoiceData.type !== 'BL' && effectiveCentreId) {
          await tx.depense.create({
            data: {
              reference: `PAY-${invoiceData.numeroFacture}`,
              montant: totalTTC,
              date: normalizeToUTCNoon(invoiceData.dateEmission) as Date,
              categorie: 'ACHAT_STOCK',
              modePaiement: paymentConditions.includes('espece') ? 'ESPECES' : 'CHEQUE',
              fournisseurId: invoiceData.fournisseurId,
              factureFournisseurId: invoice.id,
              centreId: effectiveCentreId,
              statut: 'VALIDEE',
              description: `Paiement automatique - ${invoiceData.numeroFacture}`,
            },
          });
          await tx.factureFournisseur.update({
            where: { id: invoice.id },
            data: { statut: 'PAYEE' },
          });
        }

        for (const alloc of allocations) {
          let targetProduct = await tx.product.findFirst({
            where: {
              OR: [
                { codeInterne: alloc.reference.trim() },
                ...(alloc.codeBarre ? [{ codeBarres: alloc.codeBarre.trim() }] : []),
              ],
              entrepotId: alloc.warehouseId,
              ...(alloc.couleur ? { couleur: alloc.couleur } : {}),
            },
          });

          if (!targetProduct) {
            targetProduct = await tx.product.create({
              data: {
                designation: alloc.nom,
                marque: alloc.marque,
                codeInterne: alloc.reference.trim(),
                codeBarres: alloc.codeBarre?.trim() || alloc.reference.trim(),
                typeArticle: alloc.categorie || 'AUTRE',
                couleur: alloc.couleur,
                prixAchatHT: Number(alloc.prixAchat),
                prixVenteHT: Number(alloc.prixVente),
                prixVenteTTC: Number(alloc.prixVente) * (1 + Number(alloc.tva) / 100),
                quantiteActuelle: 0,
                seuilAlerte: 2,
                statut: 'DISPONIBLE',
                entrepotId: alloc.warehouseId,
                specificData: {
                  materiau: alloc.materiau,
                  forme: alloc.forme,
                  genre: alloc.genre,
                  calibre: alloc.calibre,
                  pont: alloc.pont,
                },
                utilisateurCreation: 'system',
              },
            });
          }

          const existingStock = Number(targetProduct.quantiteActuelle || 0);
          const existingPrice = Number(targetProduct.prixAchatHT || 0);
          const newQty = Number(alloc.quantite);
          const newPrice = Number(alloc.prixAchat);

          let finalPrixAchatHT = newPrice;
          if (existingStock > 0) {
            finalPrixAchatHT = (existingStock * existingPrice + newQty * newPrice) / (existingStock + newQty);
          }

          await tx.product.update({
            where: { id: targetProduct.id },
            data: {
              quantiteActuelle: { increment: newQty },
              prixAchatHT: finalPrixAchatHT,
              prixVenteHT: Number(alloc.prixVente),
              prixVenteTTC: Number(alloc.prixVente) * (1 + Number(alloc.tva) / 100),
              specificData: {
                ...(targetProduct.specificData as any || {}),
                materiau: alloc.materiau,
                forme: alloc.forme,
                genre: alloc.genre,
                calibre: alloc.calibre,
                pont: alloc.pont,
              },
            },
          });

          await tx.mouvementStock.create({
            data: {
              type: 'ENTREE_ACHAT',
              quantite: newQty,
              produitId: targetProduct.id,
              entrepotDestinationId: alloc.warehouseId,
              factureFournisseurId: invoice.id,
              prixAchatUnitaire: newPrice,
              motif: `Alimentation via ${invoice.numeroFacture}`,
              dateMovement: new Date(),
              utilisateur: 'system',
            },
          });
        }
        return invoice;
      });
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) throw error;
      throw new BadRequestException(`Erreur lors de l'enregistrement : ${error.message}`);
    }
  }

  async getHistory(filters: any) {
    const andConditions: any[] = [];
    if (filters.centreId) andConditions.push({ OR: [{ centreId: filters.centreId }, { centreId: null }] });
    
    // Broad document types for history
    if (filters.docType === 'BL') {
      andConditions.push({ type: 'BL' });
    } else if (filters.docType === 'FACTURE') {
      andConditions.push({ type: { in: ['ACHAT_STOCK', 'FACTURE', 'ACHAT_PRODUITS', 'ACHAT VERRES OPTIQUES'] } });
    }

    if (filters.dateFrom) andConditions.push({ dateEmission: { gte: new Date(filters.dateFrom) } });
    if (filters.dateTo) andConditions.push({ dateEmission: { lte: new Date(filters.dateTo) } });
    if (filters.supplierId) andConditions.push({ fournisseurId: filters.supplierId });

    return this.prisma.factureFournisseur.findMany({
      where: andConditions.length > 0 ? { AND: andConditions } : {},
      take: 100,
      orderBy: { dateEmission: 'desc' },
      include: {
        fournisseur: true,
        mouvementsStock: { include: { produit: true, entrepotDestination: true } },
      },
    });
  }

  async getOutHistory(filters: { dateFrom?: string; dateTo?: string; search?: string; centreId?: string }) {
    const movements = await this.prisma.mouvementStock.findMany({
      where: {
        AND: [
          filters.centreId ? {
            OR: [
              { entrepotSource: { centreId: filters.centreId } },
              { entrepotDestination: { centreId: filters.centreId } }
            ]
          } : {},
          {
            OR: [
              { type: { in: ['SORTIE', 'VENTE', 'REGULARISATION_SORTIE', 'CASSE', 'PERTE', 'RETOUR_FOURNISSEUR'] } },
              { quantite: { lt: 0 } },
              { motif: { contains: 'Vente', mode: 'insensitive' } },
              { motif: { contains: 'Sortie', mode: 'insensitive' } },
            ]
          },
          filters.dateFrom ? { dateMovement: { gte: new Date(filters.dateFrom) } } : {},
          filters.dateTo ? { dateMovement: { lte: new Date(filters.dateTo) } } : {},
          filters.search ? {
            OR: [
              { motif: { contains: filters.search, mode: 'insensitive' } },
              { produit: { designation: { contains: filters.search, mode: 'insensitive' } } },
            ],
          } : {},
        ],
      },
      take: 200,
      orderBy: { dateMovement: 'desc' },
      include: {
        produit: true,
        entrepotSource: { include: { centre: true } },
        entrepotDestination: { include: { centre: true } },
        facture: { include: { client: true, fiche: true } },
        bonLivraison: { include: { client: true, fiche: true } },
      },
    });

    const groups: any[] = [];
    const groupMap = new Map<string, any>();

    movements.forEach((m) => {
      const date = new Date(m.dateMovement);
      const timeKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()} ${date.getHours()}:${date.getMinutes()}`;
      const key = `${m.motif}_${timeKey}`;

      if (!groupMap.has(key)) {
        const group = {
          id: m.id,
          motif: m.motif,
          dateMovement: m.dateMovement,
          utilisateur: m.utilisateur,
          itemsCount: 0,
          mouvementsStock: [],
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
        include: { mouvementsStock: true },
      });
      if (!invoice) throw new NotFoundException('Entrée historique introuvable');
      const productIds = Array.from(new Set(invoice.mouvementsStock.map((m) => m.produitId)));
      await tx.mouvementStock.deleteMany({ where: { factureFournisseurId: id } });
      for (const productId of productIds) {
        await this.productsService.syncProductState(productId, tx);
      }
      await tx.depense.deleteMany({ where: { factureFournisseurId: id } });
      return await tx.factureFournisseur.delete({ where: { id } });
    });
  }

  async debugData() {
    const count = await this.prisma.factureFournisseur.count();
    const movementCount = await this.prisma.mouvementStock.count();
    const typeCounts = await this.prisma.mouvementStock.groupBy({
      by: ['type'],
      _count: { _all: true }
    });
    const recentMovements = await this.prisma.mouvementStock.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: { produit: true }
    });
    return { count, movementCount, typeCounts, recentMovements };
  }
}
