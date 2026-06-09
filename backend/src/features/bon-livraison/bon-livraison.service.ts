import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateBonLivraisonDto } from './dto/create-bon-livraison.dto';
import { ProductsService } from '../products/products.service';
import { normalizeToUTCNoon } from '../../shared/utils/date-utils';
import { ExpensesService } from '../expenses/expenses.service';
import * as path from 'path';
import { StorageService } from '../../common/storage/storage.service';

@Injectable()
export class BonLivraisonService {
  constructor(
    private prisma: PrismaService,
    private productsService: ProductsService,
    private storage: StorageService,
    private expensesService: ExpensesService,
  ) {}

  async create(createDto: CreateBonLivraisonDto) {
    const { echeances, base64File, fileName, ...inputData } = createDto;

    const blData: any = {
      numeroBL: inputData.numeroBL,
      dateEmission: normalizeToUTCNoon(inputData.dateEmission) as Date,
      dateEcheance: normalizeToUTCNoon(inputData.dateEcheance),
      montantHT: Number(inputData.montantHT),
      montantTVA: Number(inputData.montantTVA),
      montantTTC: Number(inputData.montantTTC),
      statut: inputData.statut || 'VALIDEE',
      type: inputData.type || 'ACHAT_STOCK',
      fournisseurId: inputData.fournisseurId,
      centreId: inputData.centreId,
      clientId: inputData.clientId,
      ficheId: inputData.ficheId,
      categorieBL: inputData.categorieBL,
      factureFournisseurId: inputData.factureFournisseurId,
      pieceJointeUrl: inputData.pieceJointeUrl || '',
    };

    const existingBL = await this.prisma.bonLivraison.findFirst({
      where: {
        fournisseurId: blData.fournisseurId,
        numeroBL: blData.numeroBL,
      },
    });

    if (existingBL) {
      return this.update(existingBL.id, createDto);
    }

    let pieceJointeUrl = blData.pieceJointeUrl;
    if (base64File && fileName) {
      const fileExt = path.extname(fileName) || '.jpg';
      const safeName = `bl_${Date.now()}${fileExt}`;
      pieceJointeUrl = await this.storage.uploadBase64(
        base64File,
        'bl',
        safeName,
      );
    }

    const finalEcheances = echeances || [];

    const bl = await this.prisma.bonLivraison.create({
      data: {
        ...blData,
        pieceJointeUrl,
        echeances: {
          create: finalEcheances.map((e) => ({
            type: e.type,
            dateEcheance: normalizeToUTCNoon(e.dateEcheance) as Date,
            montant: e.montant,
            statut: e.statut,
            reference: e.reference || null,
            banque: e.banque || null,
          })),
        },
      },
      include: {
        echeances: true,
        fournisseur: true,
      },
    });

    // Handle Stock Movements (Entry from Fiche)
    if (bl.ficheId) {
      await this.handleGlassStockEntry(bl);
    }

    return bl;
  }

  private async handleGlassStockEntry(bl: any) {
    if (!bl.ficheId) return;

    const fiche = await this.prisma.fiche.findUnique({
      where: { id: bl.ficheId },
    });
    if (!fiche) return;

    const content = (fiche.content as any) || {};
    const verres = content.verres || {};
    if (!verres) return;

    // Check if movement already exists to avoid double-counting
    const existing = await this.prisma.mouvementStock.findFirst({
      where: {
        bonLivraisonId: bl.id,
        type: 'ENTREE',
        glassIndexId: { not: null },
      },
    });
    if (existing) return;

    const itemsToProcess: Array<{
      type: 'index' | 'treatment';
      id: string;
      label: string;
    }> = [];

    // Find Indices and Treatments by label
    const findIndex = async (val?: string, mat?: string) => {
      if (!val) return null;
      return this.prisma.glassIndex.findFirst({
        where: {
          OR: [{ value: val }, { label: val }],
          material: mat ? { name: mat } : undefined,
        },
      });
    };

    const findTreatment = async (name?: string) => {
      if (!name) return null;
      return this.prisma.glassTreatment.findUnique({ where: { name } });
    };

    // Helper to process a pair of glasses or single side
    const processGlass = async (
      indice?: string,
      matiere?: string,
      treatment?: any,
    ) => {
      const idx = await findIndex(indice, matiere);
      if (idx)
        itemsToProcess.push({
          type: 'index',
          id: idx.id,
          label: idx.label || idx.value,
        });

      const treats = Array.isArray(treatment) ? treatment : [treatment];
      for (const tName of treats) {
        if (typeof tName !== 'string') continue;
        const treat = await findTreatment(tName);
        if (treat)
          itemsToProcess.push({
            type: 'treatment',
            id: treat.id,
            label: treat.name,
          });
      }
    };

    if (verres.differentODOG) {
      await processGlass(
        verres.indiceOD,
        verres.matiereOD,
        verres.traitementOD,
      );
      await processGlass(
        verres.indiceOG,
        verres.matiereOG,
        verres.traitementOG,
      );
    } else {
      // 2 glasses
      await processGlass(verres.indice, verres.matiere, verres.traitement);
      const count = itemsToProcess.length;
      for (let i = 0; i < count; i++) {
        itemsToProcess.push({ ...itemsToProcess[i] });
      }
    }

    // Apply movements
    for (const item of itemsToProcess) {
      if (item.type === 'index') {
        await this.prisma.glassIndex.update({
          where: { id: item.id },
          data: { quantite: { increment: 1 } },
        });
      } else {
        await this.prisma.glassTreatment.update({
          where: { id: item.id },
          data: { quantite: { increment: 1 } },
        });
      }

      await this.prisma.mouvementStock.create({
        data: {
          type: 'ENTREE',
          quantite: 1,
          bonLivraisonId: bl.id,
          glassIndexId: item.type === 'index' ? item.id : null,
          glassTreatmentId: item.type === 'treatment' ? item.id : null,
          motif: `Réception Verres - BL ${bl.numeroBL} (Fiche ${fiche.numero})`,
        },
      });
    }
  }

  async findAll(filters: {
    fournisseurId?: string;
    statut?: string;
    clientId?: string;
    centreId?: string;
    ficheId?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
    categorieBL?: string;
    facturation?: string;
    factureFournisseurId?: string;
    numeroBL?: string;
  }) {
    const {
      fournisseurId,
      statut,
      clientId,
      centreId,
      ficheId,
      startDate,
      endDate,
      page,
      limit,
      categorieBL,
      facturation,
      factureFournisseurId,
      numeroBL,
    } = filters;
    const whereClause: any = {};

    if (fournisseurId) whereClause.fournisseurId = fournisseurId;
    if (numeroBL) whereClause.numeroBL = numeroBL;
    if (statut) whereClause.statut = statut;
    if (statut) whereClause.statut = statut;
    if (clientId) whereClause.clientId = clientId;
    if (centreId) whereClause.centreId = centreId;

    // Handle facturation status filter
    if (facturation === 'FACTURE') {
      whereClause.factureFournisseurId = { not: null };
    } else if (facturation === 'EN_ATTENTE') {
      whereClause.factureFournisseurId = null;
    } else if (factureFournisseurId) {
      whereClause.factureFournisseurId = factureFournisseurId;
    }

    if (ficheId) whereClause.ficheId = ficheId;
    if (categorieBL) whereClause.categorieBL = categorieBL;

    if (startDate || endDate) {
      whereClause.dateEmission = {};
      if (startDate) whereClause.dateEmission.gte = new Date(startDate);
      if (endDate) whereClause.dateEmission.lte = new Date(endDate);
    }

    const skip = page && limit ? (Number(page) - 1) * Number(limit) : undefined;
    const take = limit ? Number(limit) : 10;

    const [data, total] = await Promise.all([
      this.prisma.bonLivraison.findMany({
        where: whereClause,
        select: {
          id: true,
          numeroBL: true,
          dateEmission: true,
          dateEcheance: true,
          montantHT: true,
          montantTVA: true,
          montantTTC: true,
          statut: true,
          type: true,
          fournisseurId: true,
          fournisseur: { select: { id: true, nom: true } },
          echeances: {
            select: {
              id: true,
              montant: true,
              statut: true,
              type: true,
              dateEcheance: true,
            },
          },
          depense: {
            select: { id: true, montant: true, statut: true, date: true },
          },
          clientId: true,
          ficheId: true,
          categorieBL: true,
          centreId: true,
          client: {
            select: {
              id: true,
              nom: true,
              prenom: true,
              numeroPieceIdentite: true,
            },
          },
          fiche: { select: { id: true, numero: true, type: true } },
          factureFournisseur: {
            select: { id: true, numeroFacture: true, statut: true },
          },
        },
        orderBy: { dateEmission: 'desc' },
        skip,
        take,
      }),
      this.prisma.bonLivraison.count({ where: whereClause }),
    ]);

    // Optimization: Handle status repair and auto-linking only for the returned page
    // and avoid nested awaited queries in the loop if possible.
    const enrichedData = await Promise.all(
      data.map(async (bl: any) => {
        const result = { ...bl };

        // SELF-REPAIR: Ensure status matches actual payments
        const activeEcheances = (result.echeances || []).filter(
          (e: any) => e.statut !== 'ANNULE',
        );
        const totalPaidEcheances = activeEcheances
          .filter((e: any) => e.statut === 'ENCAISSE')
          .reduce((sum: number, e: any) => sum + e.montant, 0);

        const directPaid =
          result.depense &&
          (result.depense.statut === 'VALIDE' ||
            result.depense.statut === 'VALIDEE')
            ? result.depense.montant
            : 0;
        const totalPaidRaw = totalPaidEcheances + directPaid;

        const roundedTotalPaid = Math.round(totalPaidRaw * 100) / 100;
        const roundedTotalTTC = Math.round(result.montantTTC * 100) / 100;

        let expectedStatus = 'EN_ATTENTE';
        if (roundedTotalPaid >= roundedTotalTTC && roundedTotalTTC > 0) {
          expectedStatus = 'PAYEE';
        } else if (roundedTotalPaid > 0) {
          expectedStatus = 'PARTIELLE';
        } else {
          const hasCommitted = activeEcheances.some(
            (e: any) =>
              (e.type === 'CHEQUE' ||
                e.type === 'LCN' ||
                e.type === 'VIREMENT') &&
              e.statut !== 'ANNULE',
          );
          expectedStatus = hasCommitted ? 'PARTIELLE' : 'EN_ATTENTE';
        }

        if (result.statut !== expectedStatus) {
          await this.prisma.bonLivraison.update({
            where: { id: result.id },
            data: { statut: expectedStatus as any },
          });
          result.statut = expectedStatus;
        }

        return result;
      }),
    );

    // Calculate global stats for ALL filtered items (not just the current page)
    const allItemsForStats = await this.prisma.bonLivraison.findMany({
      where: whereClause,
      select: {
        montantTTC: true,
        montantHT: true,
        depense: { select: { montant: true, statut: true } },
        echeances: {
          where: { statut: 'ENCAISSE' },
          select: { montant: true },
        },
      },
    });

    const globalStats = allItemsForStats.reduce(
      (acc, bl) => {
        acc.totalTTC += bl.montantTTC || 0;
        acc.totalHT += bl.montantHT || 0;
        const paidEcheances = bl.echeances.reduce(
          (sum, e) => sum + e.montant,
          0,
        );
        const directPaid =
          bl.depense &&
          (bl.depense.statut === 'VALIDE' || bl.depense.statut === 'VALIDEE')
            ? bl.depense.montant
            : 0;

        // Avoid double counting: Use the maximum of direct payment or scheduled payments,
        // capped at montantTTC to prevent data inconsistencies from showing negative reliquat.
        const totalPaidForBL = Math.min(
          bl.montantTTC,
          Math.max(directPaid, paidEcheances),
        );

        acc.totalPaid += totalPaidForBL;
        return acc;
      },
      { totalTTC: 0, totalHT: 0, totalPaid: 0 },
    );

    return {
      data: enrichedData,
      total,
      stats: {
        totalTTC: Math.round(globalStats.totalTTC * 100) / 100,
        totalHT: Math.round(globalStats.totalHT * 100) / 100,
        totalPaid: Math.round(globalStats.totalPaid * 100) / 100,
        totalRemaining:
          Math.round((globalStats.totalTTC - globalStats.totalPaid) * 100) /
          100,
      },
    };
  }

  async findOne(id: string) {
    const bl = await this.prisma.bonLivraison.findUnique({
      where: { id },
      include: {
        fournisseur: true,
        echeances: true,
        depense: true,
        client: true,
        fiche: true,
        factureFournisseur: true,
      },
    });
    if (!bl) throw new NotFoundException(`BL with ID ${id} not found`);
    return bl;
  }

  async update(id: string, updateDto: Partial<CreateBonLivraisonDto>) {
    const { echeances, base64File, fileName, ...inputData } = updateDto;

    // Handle File Attachment Update
    let pieceJointeUrl = inputData.pieceJointeUrl;
    if (base64File && fileName) {
      const fileExt = path.extname(fileName) || '.jpg';
      const safeName = `bl_update_${Date.now()}${fileExt}`;
      pieceJointeUrl = await this.storage.uploadBase64(
        base64File,
        'bl',
        safeName,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      if (echeances) {
        // Pour simplifier, on supprime les anciennes échéances et on recrée
        await tx.echeancePaiement.deleteMany({
          where: { bonLivraisonId: id },
        });
      }

      return tx.bonLivraison.update({
        where: { id },
        data: {
          numeroBL: inputData.numeroBL,
          dateEmission: inputData.dateEmission
            ? (normalizeToUTCNoon(inputData.dateEmission) as Date)
            : undefined,
          dateEcheance: inputData.dateEcheance
            ? (normalizeToUTCNoon(inputData.dateEcheance) as Date)
            : undefined,
          montantHT:
            inputData.montantHT !== undefined
              ? Number(inputData.montantHT)
              : undefined,
          montantTVA:
            inputData.montantTVA !== undefined
              ? Number(inputData.montantTVA)
              : undefined,
          montantTTC:
            inputData.montantTTC !== undefined
              ? Number(inputData.montantTTC)
              : undefined,
          statut: inputData.statut,
          type: inputData.type,
          fournisseurId: inputData.fournisseurId,
          centreId: inputData.centreId,
          clientId: inputData.clientId,
          ficheId: inputData.ficheId,
          categorieBL: inputData.categorieBL,
          factureFournisseurId: inputData.factureFournisseurId,
          pieceJointeUrl,
          echeances: echeances
            ? {
                create: echeances.map((e) => ({
                  type: e.type,
                  dateEcheance: normalizeToUTCNoon(e.dateEcheance) as Date,
                  montant: e.montant,
                  statut: e.statut,
                  reference: e.reference || null,
                  banque: e.banque || null,
                })),
              }
            : undefined,
        },
        include: {
          echeances: true,
          fournisseur: true,
        },
      });
    });
  }

  async remove(id: string) {
    return this.prisma.$transaction(async (tx) => {
      const bl = await tx.bonLivraison.findUnique({
        where: { id },
        include: {
          depense: true,
          mouvementsStock: true,
        },
      });

      if (!bl) return null;

      // 1. Cleanup Treasury if an expense exists
      if (bl.depense) {
        await this.expensesService.cleanupTreasuryImpact(bl.depense.id, tx);
      }

      // 2. Sync Stock (Revert movements)
      const productIds = Array.from(
        new Set(bl.mouvementsStock.map((m) => m.produitId)),
      );
      await tx.mouvementStock.deleteMany({
        where: { bonLivraisonId: id },
      });

      await Promise.all(
        productIds
          .filter((pid): pid is string => pid !== null)
          .map((pid) => this.productsService.syncProductState(pid, tx)),
      );

      // 3. Delete linked echeances
      await tx.echeancePaiement.deleteMany({
        where: { bonLivraisonId: id },
      });

      // 4. Delete the BL itself
      return tx.bonLivraison.delete({ where: { id } });
    });
  }
}
