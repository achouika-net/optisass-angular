import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BulkAlimentationDto } from './dto/bulk-alimentation.dto';
import { ProductsService } from '../products/products.service';
import { Prisma } from '@prisma/client';
import { normalizeToUTCNoon } from '../../shared/utils/date-utils';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class StockMovementsService {
  constructor(
    private prisma: PrismaService,
    private productsService: ProductsService,
  ) {}

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
      return await this.prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
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

          let ficheClientId: string | null = null;
          let userDisplayName = 'System';
          const effectiveFicheId = dto.ficheId;

          if (dto.userId) {
            const user = await tx.user.findUnique({
              where: { id: dto.userId },
              select: { nom: true, prenom: true, email: true },
            });
            if (user) {
              const fullName = `${user.prenom || ''} ${user.nom || ''}`.trim();
              userDisplayName = fullName || user.email || `User ${dto.userId}`;
            }
          }

          if (effectiveFicheId) {
            const fiche = await tx.fiche.findUnique({
              where: { id: effectiveFicheId },
              include: { facture: true },
            });
            if (fiche) {
              ficheClientId = fiche.clientId;
            }
          }

          invoice = await tx.factureFournisseur.create({
            data: {
              numeroFacture: invoiceData.numeroFacture,
              dateEmission: normalizeToUTCNoon(
                invoiceData.dateEmission,
              ) as Date,
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
              ficheId: effectiveFicheId,
              clientId: ficheClientId,
              echeances:
                invoiceData.type !== 'BL'
                  ? {
                      create: [
                        {
                          type: 'CHEQUE',
                          dateEcheance: normalizeToUTCNoon(
                            invoiceData.dateEcheance ||
                              invoiceData.dateEmission,
                          ) as Date,
                          montant: totalTTC,
                          statut: 'EN_ATTENTE',
                        },
                      ],
                    }
                  : undefined,
            },
            include: { echeances: true },
          });

          const supplier = await tx.fournisseur.findUnique({
            where: { id: invoiceData.fournisseurId },
          });

          const convention = supplier?.convention as {
            echeancePaiement?: string[];
          } | null;
          const paymentConditions = (
            convention?.echeancePaiement?.[0] ||
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
                modePaiement: paymentConditions.includes('espece')
                  ? 'ESPECES'
                  : 'CHEQUE',
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

          const ficheCache = new Map<
            string,
            Prisma.FicheGetPayload<{ include: { facture: true; client: true } }>
          >();
          const getFicheData = async (fId: string) => {
            if (ficheCache.has(fId)) {
              const cached = ficheCache.get(fId);
              if (cached) return cached;
            }
            const f = await tx.fiche.findUnique({
              where: { id: fId },
              include: { facture: true, client: true },
            });
            if (f) ficheCache.set(fId, f);
            return f;
          };

          let defaultWarehouseId: string | undefined;
          if (effectiveCentreId) {
            const centerWarehouses = await tx.entrepot.findMany({
              where: { centreId: effectiveCentreId },
              orderBy: { createdAt: 'asc' },
            });
            if (centerWarehouses.length > 0) {
              defaultWarehouseId = centerWarehouses[0].id;
            } else {
              console.log(
                `🏗️ [RECOVERY] Center ${effectiveCentreId} has no warehouses. Creating default.`,
              );
              const newWh = await tx.entrepot.create({
                data: {
                  nom: 'Entrepôt Principal',
                  type: 'DEPOT',
                  centreId: effectiveCentreId,
                },
              });
              defaultWarehouseId = newWh.id;
            }
          }

          if (!defaultWarehouseId) {
            const globalWh = await tx.entrepot.findFirst({
              orderBy: { createdAt: 'asc' },
            });
            defaultWarehouseId = globalWh?.id;
          }

          for (const alloc of allocations) {
            const looksLikeId =
              alloc.warehouseId &&
              alloc.warehouseId.length > 20 &&
              alloc.warehouseId.includes('-');

            let activeWarehouseId = looksLikeId
              ? alloc.warehouseId
              : defaultWarehouseId;

            if (!activeWarehouseId) {
              activeWarehouseId = defaultWarehouseId;
            }

            if (
              (!activeWarehouseId || activeWarehouseId === effectiveCentreId) &&
              defaultWarehouseId &&
              defaultWarehouseId !== effectiveCentreId
            ) {
              activeWarehouseId = defaultWarehouseId;
            }

            if (!activeWarehouseId && effectiveCentreId) {
              const lastResort = await tx.entrepot.findFirst({
                where: { centreId: effectiveCentreId },
                orderBy: { type: 'asc' },
              });
              activeWarehouseId = lastResort?.id;
            }

            if (!activeWarehouseId) {
              const globalFallback = await tx.entrepot.findFirst({
                orderBy: { createdAt: 'asc' },
              });
              activeWarehouseId = globalFallback?.id;
            }

            if (!activeWarehouseId) {
              continue;
            }

            let targetProduct = await tx.product.findFirst({
              where: {
                OR: [
                  { codeInterne: alloc.reference.trim() },
                  ...(alloc.codeBarre
                    ? [{ codeBarres: alloc.codeBarre.trim() }]
                    : []),
                ],
                entrepotId: activeWarehouseId,
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
                  prixVenteTTC:
                    Number(alloc.prixVente) * (1 + Number(alloc.tva) / 100),
                  quantiteActuelle: 0,
                  seuilAlerte: 2,
                  statut: 'DISPONIBLE',
                  entrepotId: activeWarehouseId,
                  specificData: {
                    ...((alloc.specificData as Record<string, unknown>) || {}),
                    materiau: alloc.materiau,
                    forme: alloc.forme,
                    genre: alloc.genre,
                    calibre: alloc.calibre,
                    pont: alloc.pont,
                  },
                  utilisateurCreation: 'System',
                },
              });
            }

            const existingStock = Number(targetProduct.quantiteActuelle || 0);
            const existingPrice = Number(targetProduct.prixAchatHT || 0);
            const newQty = Number(alloc.quantite);
            const newPrice = Number(alloc.prixAchat);

            let finalPrixAchatHT = newPrice;
            if (existingStock > 0) {
              finalPrixAchatHT =
                (existingStock * existingPrice + newQty * newPrice) /
                (existingStock + newQty);
            }

            await tx.product.update({
              where: { id: targetProduct.id },
              data: {
                quantiteActuelle: { increment: newQty },
                prixAchatHT: finalPrixAchatHT,
                prixVenteHT: Number(alloc.prixVente),
                prixVenteTTC:
                  Number(alloc.prixVente) * (1 + Number(alloc.tva) / 100),
                specificData: {
                  ...((targetProduct.specificData as Record<string, unknown>) ||
                    {}),
                  ...((alloc.specificData as Record<string, unknown>) || {}),
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
                entrepotDestinationId: activeWarehouseId,
                factureFournisseurId: invoice.id,
                prixAchatUnitaire: newPrice,
                motif: `Alimentation via ${invoice.numeroFacture}`,
                dateMovement: new Date(),
                utilisateur: userDisplayName,
                userId: dto.userId || null,
              },
            });

            if (effectiveFicheId) {
              const fiche: Prisma.FicheGetPayload<{
                include: { facture: true; client: true };
              }> | null = await getFicheData(effectiveFicheId);
              if (fiche) {
                const currentFicheClientId = fiche.clientId;
                const currentClientFacture = fiche.facture;

                await tx.product.update({
                  where: { id: targetProduct.id },
                  data: {
                    quantiteActuelle: { decrement: newQty },
                  },
                });

                const existingExit = await tx.mouvementStock.findFirst({
                  where: {
                    produitId: targetProduct.id,
                    clientId: currentFicheClientId,
                    factureId: currentClientFacture?.id,
                    type: 'SORTIE_VENTE',
                  },
                });

                if (!existingExit) {
                  await tx.mouvementStock.create({
                    data: {
                      type: 'SORTIE_VENTE',
                      quantite: -newQty,
                      produitId: targetProduct.id,
                      entrepotSourceId: activeWarehouseId,
                      factureFournisseurId: invoice.id,
                      factureId: fiche.facture?.id,
                      clientId: currentFicheClientId,
                      prixVenteUnitaire: Number(alloc.prixVente),
                      prixAchatUnitaire: finalPrixAchatHT,
                      motif: currentClientFacture
                        ? `Facturation ${currentClientFacture.numero} (${currentClientFacture.statut})`
                        : `Sortie vente automatique - Fiche n° ${fiche.numero}`,
                      dateMovement: invoice.dateEmission,
                      utilisateur: userDisplayName,
                      userId: dto.userId || null,
                    },
                  });
                }
              }
            }
          }
          return invoice;
        },
      );
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      const message =
        error instanceof Error ? error.message : 'Une erreur est survenue';
      throw new BadRequestException(
        `Erreur lors de l'enregistrement : ${message}`,
      );
    }
  }

  async getHistory(filters: {
    centreId?: string;
    docType?: string;
    dateFrom?: string;
    dateTo?: string;
    supplierId?: string;
  }) {
    const andConditions: Prisma.FactureFournisseurWhereInput[] = [];
    if (filters.centreId) {
      andConditions.push({
        OR: [{ centreId: filters.centreId }, { centreId: null }],
      });
    }

    if (filters.docType === 'BL') {
      andConditions.push({ type: 'BL' });
    } else if (filters.docType === 'FACTURE') {
      andConditions.push({
        type: {
          in: [
            'ACHAT_STOCK',
            'FACTURE',
            'ACHAT_PRODUITS',
            'ACHAT VERRES OPTIQUES',
          ],
        },
      });
    }

    if (filters.dateFrom) {
      andConditions.push({ dateEmission: { gte: new Date(filters.dateFrom) } });
    }
    if (filters.dateTo) {
      andConditions.push({ dateEmission: { lte: new Date(filters.dateTo) } });
    }
    if (filters.supplierId) {
      andConditions.push({ fournisseurId: filters.supplierId });
    }

    return this.prisma.factureFournisseur.findMany({
      where: andConditions.length > 0 ? { AND: andConditions } : {},
      take: 100,
      orderBy: { dateEmission: 'desc' },
      select: {
        id: true,
        numeroFacture: true,
        dateEmission: true,
        montantHT: true,
        montantTTC: true,
        statut: true,
        type: true,
        fournisseur: {
          select: { id: true, nom: true },
        },
        mouvementsStock: {
          where: { quantite: { gt: 0 } },
          select: {
            id: true,
            quantite: true,
            prixAchatUnitaire: true,
            utilisateur: true,
            produit: {
              select: { id: true, designation: true, codeInterne: true },
            },
            entrepotDestination: {
              select: { id: true, nom: true },
            },
          },
        },
      },
    });
  }

  async getOutHistory(filters: {
    dateFrom?: string;
    dateTo?: string;
    search?: string;
    centreId?: string;
  }) {
    const movements = await this.prisma.mouvementStock.findMany({
      where: {
        AND: [
          filters.centreId
            ? {
                OR: [
                  { entrepotSource: { centreId: filters.centreId } },
                  { entrepotDestination: { centreId: filters.centreId } },
                ],
              }
            : {},
          {
            OR: [
              {
                type: {
                  in: [
                    'SORTIE',
                    'VENTE',
                    'SORTIE_VENTE',
                    'REGULARISATION_SORTIE',
                    'CASSE',
                    'PERTE',
                    'RETOUR_FOURNISSEUR',
                  ],
                },
              },
              { quantite: { lt: 0 } },
              { motif: { contains: 'Vente', mode: 'insensitive' } },
              { motif: { contains: 'Sortie', mode: 'insensitive' } },
            ],
          },
          filters.dateFrom
            ? { dateMovement: { gte: new Date(filters.dateFrom) } }
            : {},
          filters.dateTo
            ? { dateMovement: { lte: new Date(filters.dateTo) } }
            : {},
          filters.search
            ? {
                OR: [
                  { motif: { contains: filters.search, mode: 'insensitive' } },
                  {
                    produit: {
                      designation: {
                        contains: filters.search,
                        mode: 'insensitive',
                      },
                    },
                  },
                ],
              }
            : {},
        ],
      },
      take: 300,
      orderBy: { dateMovement: 'desc' },
      select: {
        id: true,
        type: true,
        quantite: true,
        dateMovement: true,
        motif: true,
        utilisateur: true,
        userId: true,
        produit: {
          select: {
            id: true,
            designation: true,
            marque: true,
            codeInterne: true,
          },
        },
        entrepotSource: {
          select: {
            id: true,
            nom: true,
            centre: { select: { id: true, nom: true } },
          },
        },
        entrepotDestination: {
          select: {
            id: true,
            nom: true,
            centre: { select: { id: true, nom: true } },
          },
        },
        facture: {
          select: {
            id: true,
            numero: true,
            client: {
              select: {
                id: true,
                nom: true,
                prenom: true,
                raisonSociale: true,
              },
            },
            fiche: { select: { id: true, numero: true, dateCreation: true } },
          },
        },
        bonLivraison: {
          select: {
            id: true,
            numeroBL: true,
            client: {
              select: {
                id: true,
                nom: true,
                prenom: true,
                raisonSociale: true,
              },
            },
            fiche: { select: { id: true, numero: true, dateCreation: true } },
          },
        },
        factureFournisseur: {
          select: {
            id: true,
            numeroFacture: true,
            client: {
              select: {
                id: true,
                nom: true,
                prenom: true,
                raisonSociale: true,
              },
            },
            fiche: { select: { id: true, numero: true, dateCreation: true } },
          },
        },
      },
    });

    const groupMap = new Map<
      string,
      {
        id: string;
        motif: string;
        dateMovement: Date;
        utilisateur: string;
        itemsCount: number;
        mouvementsStock: (typeof movements)[number][];
      }
    >();
    const groups: Array<{
      id: string;
      motif: string;
      dateMovement: Date;
      utilisateur: string;
      itemsCount: number;
      mouvementsStock: (typeof movements)[number][];
    }> = [];

    const userIdsToFetch = new Set<string>();
    movements.forEach((m) => {
      if (m.utilisateur?.startsWith('User ')) {
        userIdsToFetch.add(m.utilisateur.replace('User ', '').trim());
      } else if (m.userId) {
        userIdsToFetch.add(m.userId);
      }
    });

    if (userIdsToFetch.size > 0) {
      const users = await this.prisma.user.findMany({
        where: { id: { in: Array.from(userIdsToFetch) } },
        select: { id: true, nom: true, prenom: true },
      });
      const userMap = new Map(
        users.map((u) => [u.id, `${u.prenom} ${u.nom}`.trim()]),
      );

      movements.forEach((m) => {
        if (m.utilisateur?.startsWith('User ')) {
          const id = m.utilisateur.replace('User ', '').trim();
          if (userMap.has(id)) {
            m.utilisateur = userMap.get(id) || m.utilisateur;
          }
        } else if (m.userId && userMap.has(m.userId)) {
          m.utilisateur = userMap.get(m.userId) || m.utilisateur;
        }
      });
    }

    movements.forEach((m) => {
      let key = '';
      const ficheId =
        m.facture?.fiche?.id ||
        m.bonLivraison?.fiche?.id ||
        m.factureFournisseur?.fiche?.id;

      if (ficheId) {
        key = `FICHE_${ficheId}`;
      } else {
        const date = new Date(m.dateMovement);
        const timeKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()} ${date.getHours()}:${date.getMinutes()}`;
        key = `${m.motif}_${timeKey}`;
      }

      if (!groupMap.has(key)) {
        const group = {
          id: m.id,
          motif: ficheId
            ? `Sorties de la Fiche`
            : m.motif || 'Sortie sans motif',
          dateMovement: m.dateMovement,
          utilisateur: m.utilisateur || 'Système',
          itemsCount: 0,
          mouvementsStock: [] as (typeof movements)[number][],
        };
        groupMap.set(key, group);
        groups.push(group);
      }

      const currentGroup = groupMap.get(key);
      if (currentGroup) {
        currentGroup.mouvementsStock.push(m);
        currentGroup.itemsCount += 1;
      }
    });

    return groups;
  }

  async removeEntryHistory(id: string) {
    return await this.prisma.$transaction(async (tx) => {
      const invoice = await tx.factureFournisseur.findUnique({
        where: { id },
        include: { mouvementsStock: true },
      });
      if (!invoice) {
        throw new NotFoundException('Entrée historique introuvable');
      }
      const productIds = Array.from(
        new Set(invoice.mouvementsStock.map((m) => m.produitId as string)),
      );
      await tx.mouvementStock.deleteMany({
        where: { factureFournisseurId: id },
      });
      for (const productId of productIds) {
        await this.productsService.syncProductState(productId, tx);
      }
      await tx.depense.deleteMany({ where: { factureFournisseurId: id } });
      return await tx.factureFournisseur.delete({ where: { id } });
    });
  }

  async debugData(type?: string) {
    const count = await this.prisma.factureFournisseur.count();
    const movementCount = await this.prisma.mouvementStock.count();
    const typeCounts = await this.prisma.mouvementStock.groupBy({
      by: ['type'],
      _count: { _all: true },
    });
    const where: Prisma.MouvementStockWhereInput = {
      type: type ? type : undefined,
    };
    const recentMovements = await this.prisma.mouvementStock.findMany({
      where,
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: { produit: true },
    });
    return { count, movementCount, typeCounts, recentMovements };
  }
}
