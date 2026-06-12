import {
  Injectable,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSupplierInvoiceDto } from './dto/create-supplier-invoice.dto';
import { ProductsService } from '../products/products.service';
import { ExpensesService } from '../expenses/expenses.service';
import { normalizeToUTCNoon } from '../../shared/utils/date-utils';
import * as path from 'path';
import { StorageService } from '../../common/storage/storage.service';

interface EcheanceInput {
  type: string;
  dateEcheance: Date | string;
  dateEncaissement?: Date | string | null;
  montant: number;
  statut: string;
  reference?: string | null;
  banque?: string | null;
  remarque?: string | null;
  id?: string;
}

interface InvoiceInput {
  numeroFacture: string;
  dateEmission: Date | string;
  dateEcheance?: Date | string;
  montantHT: number;
  montantTVA: number;
  montantTTC: number;
  statut: string;
  type: string;
  fournisseurId: string;
  centreId?: string;
  clientId?: string;
  ficheId?: string;
  pieceJointeUrl?: string | null;
  echeances?: EcheanceInput[];
  newAttachments?: { base64: string; name: string }[];
  existingAttachments?: string[];
  base64File?: string;
  fileName?: string;
}

@Injectable()
export class SupplierInvoicesService {
  constructor(
    private prisma: PrismaService,
    private productsService: ProductsService,
    private expensesService: ExpensesService,
    private storage: StorageService,
  ) {}

  async create(createDto: CreateSupplierInvoiceDto) {
    const { echeances, base64File, fileName, ...inputData } = createDto;

    // Clean inputData: Prisma will crash if we pass unknown fields (like directPayment or newAttachments from frontend)
    const invoiceData: Partial<Prisma.FactureFournisseurCreateInput> = {
      numeroFacture: inputData.numeroFacture,
      dateEmission: normalizeToUTCNoon(inputData.dateEmission) as Date,
      dateEcheance: normalizeToUTCNoon(inputData.dateEcheance),
      montantHT: Number(inputData.montantHT),
      montantTVA: Number(inputData.montantTVA),
      montantTTC: Number(inputData.montantTTC),
      statut: inputData.statut,
      type: inputData.type,
      fournisseur: { connect: { id: inputData.fournisseurId } },
      centre: inputData.centreId
        ? { connect: { id: inputData.centreId } }
        : undefined,
      client: inputData.clientId
        ? { connect: { id: inputData.clientId } }
        : undefined,
      fiche: inputData.ficheId
        ? { connect: { id: inputData.ficheId } }
        : undefined,
      pieceJointeUrl: inputData.pieceJointeUrl || '',
    };

    // Robust duplicate check
    const existingInvoice = await this.checkExistence(
      inputData.fournisseurId,
      inputData.numeroFacture,
    );

    if (existingInvoice) {
      console.log(
        `[INVOICE] Update existing invoice ${existingInvoice.numeroFacture} for supplier ${inputData.fournisseurId}`,
      );
      return this.update(existingInvoice.id, createDto);
    }

    // Handle File Attachment
    let pieceJointeUrl = invoiceData.pieceJointeUrl;
    if (base64File && fileName) {
      const fileExt = path.extname(fileName) || '.jpg';
      const safeName = `inv_${Date.now()}${fileExt}`;
      pieceJointeUrl = await this.storage.uploadBase64(
        base64File,
        'invoices',
        safeName,
      );
    }

    const status = this.calculateInvoiceStatus(
      Number(inputData.montantTTC),
      echeances || [],
    );

    // Si aucune échéance n'est fournie (ex: BL simple), on en crée une par défaut pour le total
    // SAUF si c'est un BL (les BL ne doivent pas avoir d'échéances programmées automatiquement)
    const finalEcheances =
      echeances && echeances.length > 0
        ? echeances
        : inputData.type === 'BL'
          ? []
          : [
              {
                type: 'ESPECES',
                dateEcheance: normalizeToUTCNoon(
                  inputData.dateEcheance || new Date(),
                ) as Date,
                montant: Number(inputData.montantTTC),
                statut: 'EN_ATTENTE',
              },
            ];

    try {
      return await this.prisma.factureFournisseur.create({
        data: {
          ...(invoiceData as Prisma.FactureFournisseurCreateInput),
          pieceJointeUrl,
          statut: status,
          echeances: {
            create: finalEcheances.map((e: EcheanceInput) => ({
              type: e.type,
              dateEcheance: normalizeToUTCNoon(e.dateEcheance) || new Date(),
              montant: Number(e.montant || 0),
              statut: e.statut,
              reference: e.reference || null,
              banque: e.banque || null,
              remarque: e.remarque || null,
            })),
          },
        },
        include: {
          echeances: true,
          fournisseur: true,
        },
      });
    } catch (error) {
      console.error('[INVOICE] CREATE ERROR:', error);
      throw error;
    }
  }

  async findAll(filters: {
    fournisseurId?: string;
    statut?: string;
    clientId?: string;
    centreId?: string;
    startDate?: string;
    endDate?: string;
    ficheId?: string;
    numeroFacture?: string;
    modePaiement?: string;
    page?: number;
    limit?: number;
  }) {
    const {
      fournisseurId,
      statut,
      clientId,
      centreId,
      startDate,
      endDate,
      ficheId,
      numeroFacture,
      modePaiement,
      page,
      limit,
    } = filters;
    const whereClause: Prisma.FactureFournisseurWhereInput = {};

    if (fournisseurId) whereClause.fournisseurId = fournisseurId;
    if (statut) {
      if (statut === 'EN_ATTENTE') {
        whereClause.statut = { in: ['EN_ATTENTE', 'A_PAYER'] };
      } else {
        whereClause.statut = statut;
      }
    }
    if (clientId) whereClause.clientId = clientId;
    if (centreId) whereClause.centreId = centreId;
    if (ficheId) whereClause.ficheId = ficheId;
    if (numeroFacture) {
      whereClause.numeroFacture = { contains: numeroFacture, mode: 'insensitive' };
    }
    if (modePaiement) {
      whereClause.echeances = {
        some: {
          type: modePaiement
        }
      };
    }

    if (startDate || endDate) {
      whereClause.dateEmission = {};
      if (startDate) whereClause.dateEmission.gte = new Date(startDate);
      if (endDate) whereClause.dateEmission.lte = new Date(endDate);
    }

    const skip = page && limit ? (Number(page) - 1) * Number(limit) : undefined;
    const take = limit ? Number(limit) : 10;

    const [data, total, allItemsForStats] = await Promise.all([
      this.prisma.factureFournisseur.findMany({
        where: whereClause,
        include: {
          fournisseur: { select: { id: true, nom: true } },
          echeances: true,
          childBLs: { select: { id: true } },
          client: { select: { id: true, nom: true, prenom: true } },
          fiche: { select: { id: true, numero: true, type: true } },
        },
        orderBy: { dateEmission: 'desc' },
        skip,
        take,
      }),
      this.prisma.factureFournisseur.count({ where: whereClause }),
      this.prisma.factureFournisseur.findMany({
        where: whereClause,
        select: {
          montantTTC: true,
          montantHT: true,
          echeances: {
            where: { statut: { in: ['ENCAISSE', 'PAYEE'] } },
            select: { montant: true },
          },
        },
      }),
    ]);

    const globalStats = allItemsForStats.reduce(
      (acc, inv) => {
        acc.totalTTC += inv.montantTTC || 0;
        acc.totalHT += inv.montantHT || 0;
        const paidEcheances = inv.echeances.reduce(
          (sum, e) => sum + e.montant,
          0,
        );
        acc.totalPaid += Math.min(inv.montantTTC, paidEcheances);
        return acc;
      },
      { totalTTC: 0, totalHT: 0, totalPaid: 0 },
    );

    // Calculate resteAPayer and acompte for each invoice based on paid echeances
    const enrichedData = data.map((inv: any) => {
      const totalPaid = (inv.echeances || [])
        .filter((e: any) => ['PAYEE', 'ENCAISSE'].includes(e.statut))
        .reduce((sum: number, e: any) => sum + (e.montant || 0), 0);
      
      const resteAPayer = Math.max(0, Math.round((inv.montantTTC - totalPaid) * 100) / 100);
      const acompte = Math.round(Math.min(totalPaid, inv.montantTTC) * 100) / 100;

      return { ...inv, resteAPayer, acompte };
    });

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
    return this.prisma.factureFournisseur.findUnique({
      where: { id },
      include: {
        fournisseur: true,
        echeances: true,
        depenses: true,
        client: true,
        fiche: true,
      },
    });
  }

  async checkExistence(fournisseurId: string, numeroFacture: string) {
    if (!fournisseurId || !numeroFacture) return null;
    const trimmedNumero = numeroFacture.trim();
    return this.prisma.factureFournisseur.findFirst({
      where: {
        fournisseurId: fournisseurId,
        numeroFacture: {
          equals: trimmedNumero,
          mode: 'insensitive',
        },
      },
      include: {
        echeances: true,
        fournisseur: true,
      },
    });
  }

  async update(id: string, updateDto: InvoiceInput) {
    const { echeances, base64File, fileName, ...invoiceData } = updateDto;

    // Clean invoiceData to remove unwanted circular or extra relation objects
    const cleanedInvoiceData: Partial<Prisma.FactureFournisseurUpdateInput> = {
      numeroFacture: invoiceData.numeroFacture,
      dateEmission: normalizeToUTCNoon(invoiceData.dateEmission) || new Date(),
      dateEcheance: normalizeToUTCNoon(invoiceData.dateEcheance),
      montantHT: Number(invoiceData.montantHT),
      montantTVA: Number(invoiceData.montantTVA),
      montantTTC: Number(invoiceData.montantTTC),
      statut: invoiceData.statut,
      type: invoiceData.type,
      pieceJointeUrl: invoiceData.pieceJointeUrl,
      fournisseur: { connect: { id: invoiceData.fournisseurId } },
      centre: invoiceData.centreId
        ? { connect: { id: invoiceData.centreId } }
        : undefined,
      client: invoiceData.clientId
        ? { connect: { id: invoiceData.clientId } }
        : undefined,
      fiche: invoiceData.ficheId
        ? { connect: { id: invoiceData.ficheId } }
        : undefined,
    };

    // Handle File Attachment Update (Multi-file support)
    const newAttachments = updateDto.newAttachments || [];
    const existingAttachments = updateDto.existingAttachments || [];
    const finalUrls: string[] = [];

    // 1. Process Existing Attachments
    if (Array.isArray(existingAttachments)) {
      existingAttachments.forEach((url) => {
        // Clean URL if it comes with domain
        let cleanUrl = url;
        if (url.includes('/uploads/')) {
          const parts = url.split('/uploads/');
          cleanUrl = '/uploads/' + parts[parts.length - 1];
        }
        finalUrls.push(cleanUrl);
      });
    } else if (invoiceData.pieceJointeUrl) {
      // Fallback for legacy single URL in pieceJointeUrl
      finalUrls.push(invoiceData.pieceJointeUrl);
    }

    // 2. Process New Attachments (Array)
    for (const attachment of newAttachments) {
      if (attachment.base64 && attachment.name) {
        const fileExt = path.extname(attachment.name) || '.jpg';
        const safeName = `inv_${Date.now()}_${Math.round(Math.random() * 1000)}${fileExt}`;
        const url = await this.storage.uploadBase64(
          attachment.base64,
          'invoices',
          safeName,
        );
        finalUrls.push(url);
      }
    }

    // 3. Fallback: Legacy Single File (if newAttachments empty but base64File present)
    if (newAttachments.length === 0 && base64File && fileName) {
      const fileExt = path.extname(fileName) || '.jpg';
      const safeName = `inv_update_${Date.now()}${fileExt}`;
      const url = await this.storage.uploadBase64(
        base64File,
        'invoices',
        safeName,
      );
      finalUrls.push(url);
    }

    // 4. Save combined URLs
    if (finalUrls.length > 0) {
      cleanedInvoiceData.pieceJointeUrl = finalUrls.join(';');
    } else if (
      updateDto.pieceJointeUrl === null &&
      existingAttachments.length === 0
    ) {
      cleanedInvoiceData.pieceJointeUrl = null;
    }

    return this.prisma.$transaction(async (tx) => {
      if (echeances) {
        // Pour simplifier, on supprime les anciennes échéances et on recrée
        await tx.echeancePaiement.deleteMany({
          where: { factureFournisseurId: id },
        });
      }

      const status = this.calculateInvoiceStatus(
        Number(cleanedInvoiceData.montantTTC || 0),
        echeances || [],
      );
      cleanedInvoiceData.statut = status;

      return tx.factureFournisseur.update({
        where: { id },
        data: {
          ...cleanedInvoiceData,
          echeances: echeances
            ? {
                create: echeances.map((e: EcheanceInput) => ({
                  type: e.type,
                  dateEcheance:
                    normalizeToUTCNoon(e.dateEcheance) || new Date(),
                  dateEncaissement: normalizeToUTCNoon(e.dateEncaissement),
                  montant: Number(e.montant || 0),
                  statut: e.statut,
                  reference: e.reference || null,
                  banque: e.banque || null,
                  remarque: e.remarque || null,
                })),
              }
            : undefined,
        },
        include: {
          echeances: true,
        },
      });
    });
  }

  private calculateInvoiceStatus(
    totalTTC: number,
    echeances: EcheanceInput[],
  ): string {
    if (!echeances || echeances.length === 0) return 'EN_ATTENTE';

    // Filter out cancelled ones
    const activeEcheances = echeances.filter((e) => e.statut !== 'ANNULE');
    if (activeEcheances.length === 0) return 'EN_ATTENTE';

    const totalPaid =
      Math.round(
        activeEcheances
          .filter((e) => ['PAYEE', 'ENCAISSE'].includes(e.statut))
          .reduce((sum, e) => sum + (e.montant || 0), 0) * 100,
      ) / 100;

    const roundedTotalTTC = Math.round(totalTTC * 100) / 100;

    if (totalPaid >= roundedTotalTTC && roundedTotalTTC > 0) {
      return 'PAYEE';
    }

    if (totalPaid > 0) return 'PARTIELLE';

    const hasScheduled = activeEcheances.some(
      (e) => e.type !== 'ESPECES' && e.statut === 'EN_ATTENTE',
    );
    return hasScheduled ? 'PARTIELLE' : 'EN_ATTENTE';
  }

  async remove(id: string) {
    return this.prisma.$transaction(async (tx) => {
      const invoice = await tx.factureFournisseur.findUnique({
        where: { id },
        include: { mouvementsStock: true },
      });

      if (!invoice) return null;

      // 1. Charger les dépenses liées pour nettoyage de trésorerie
      const linkedExpenses = await tx.depense.findMany({
        where: { factureFournisseurId: id },
      });

      for (const expense of linkedExpenses) {
        await this.expensesService.cleanupTreasuryImpact(expense.id, tx);
      }

      // 2. Delete linked Expense records (the impact is already cleaned)
      await tx.depense.deleteMany({
        where: { factureFournisseurId: id },
      });

      // 3. Revert stock movements
      const productIds = Array.from(
        new Set(invoice.mouvementsStock.map((m) => m.produitId)),
      );
      await tx.mouvementStock.deleteMany({
        where: { factureFournisseurId: id },
      });

      await Promise.all(
        productIds
          .filter((pid): pid is string => pid !== null)
          .map((pid) => this.productsService.syncProductState(pid, tx)),
      );

      // 4. Delete linked echeances
      await tx.echeancePaiement.deleteMany({
        where: { factureFournisseurId: id },
      });

      // Final deletion
      return tx.factureFournisseur.delete({
        where: { id },
      });
    });
  }

  async getSupplierSituation(
    fournisseurId: string,
    startDate?: string,
    endDate?: string,
  ) {
    const whereClause: Prisma.FactureFournisseurWhereInput = {
      fournisseurId: fournisseurId,
      statut: { not: 'ANNULEE' },
    };

    if (startDate || endDate) {
      const dateFilter: Prisma.DateTimeFilter = {};
      if (startDate) dateFilter.gte = new Date(startDate);
      if (endDate) dateFilter.lte = new Date(endDate);
      whereClause.dateEmission = dateFilter;
    }

    const invoices = await this.prisma.factureFournisseur.findMany({
      where: whereClause,
      include: {
        echeances: true,
      },
    });

    let totalTTC = 0;
    let totalPaye = 0;

    for (const invoice of invoices) {
      totalTTC += invoice.montantTTC;

      if (invoice.echeances) {
        const paidEcheances = invoice.echeances.filter(
          (e) => e.statut === 'ENCAISSE',
        );
        const paidAmount = paidEcheances.reduce((sum, e) => sum + e.montant, 0);
        totalPaye += paidAmount;
      }
    }

    return {
      fournisseurId,
      totalTTC,
      totalPaye,
      resteAPayer: totalTTC - totalPaye,
      invoiceCount: invoices.length,
    };
  }

  async groupBLsToInvoice(blIds: string[], targetInvoiceData: InvoiceInput) {
    const { echeances, newAttachments } = targetInvoiceData;

    // Clean invoiceData: Prisma will crash if we pass unknown fields
    const invoiceData = {
      numeroFacture: targetInvoiceData.numeroFacture?.trim() || '',
      dateEmission:
        normalizeToUTCNoon(targetInvoiceData.dateEmission) || new Date(),
      dateEcheance: normalizeToUTCNoon(targetInvoiceData.dateEcheance),
      montantHT: Number(targetInvoiceData.montantHT || 0),
      montantTVA: Number(targetInvoiceData.montantTVA || 0),
      montantTTC: Number(targetInvoiceData.montantTTC || 0),
      type: targetInvoiceData.type || 'ACHAT_STOCK',
      fournisseurId: targetInvoiceData.fournisseurId,
      centreId: targetInvoiceData.centreId,
      clientId: targetInvoiceData.clientId || null,
      ficheId: targetInvoiceData.ficheId || null,
      pieceJointeUrl: targetInvoiceData.pieceJointeUrl || '',
    };

    if (!invoiceData.dateEmission) {
      throw new BadRequestException(
        "La date d'émission est invalide ou manquante.",
      );
    }

    if (!blIds || blIds.length === 0) {
      throw new BadRequestException('Aucun BL sélectionné pour le groupement.');
    }

    // Robust duplicate check
    const existing = await this.checkExistence(
      invoiceData.fournisseurId,
      invoiceData.numeroFacture,
    );
    if (existing) {
      console.warn(
        `[GROUP] Duplicate invoice number detected: ${invoiceData.numeroFacture} for supplier ${invoiceData.fournisseurId}`,
      );
      throw new ConflictException(
        `Une facture avec le numéro "${invoiceData.numeroFacture || 'vide'}" existe déjà pour ce fournisseur.`,
      );
    }

    // Handle Attachments (Shared logic with create/update)
    let finalPieceJointeUrl = invoiceData.pieceJointeUrl || '';

    if (newAttachments && newAttachments.length > 0) {
      const urls: string[] = [];
      for (const attachment of newAttachments) {
        if (attachment.base64 && attachment.name) {
          const fileExt = path.extname(attachment.name) || '.jpg';
          const safeName = `grouped_${Date.now()}_${Math.round(Math.random() * 1000)}${fileExt}`;
          const url = await this.storage.uploadBase64(
            attachment.base64,
            'invoices',
            safeName,
          );
          urls.push(url);
        }
      }
      finalPieceJointeUrl = urls.join(';');
    }

    const status = this.calculateInvoiceStatus(
      Number(invoiceData.montantTTC),
      echeances || [],
    );

    return this.prisma.$transaction(async (tx) => {
      try {
        // 1. Create the consolidated invoice
        const invoice = await tx.factureFournisseur.create({
          data: {
            ...invoiceData,
            pieceJointeUrl: finalPieceJointeUrl,
            statut: status,
            dateEmission: invoiceData.dateEmission,
            dateEcheance: invoiceData.dateEcheance,
            // Link all BLs to this new invoice
            childBLs: {
              connect: blIds.map((id) => ({ id })),
            },
            echeances:
              echeances && echeances.length > 0
                ? {
                    create: echeances
                      .filter((e: EcheanceInput) => {
                        // Skip if this looks like a payment already on the BLs (to avoid duplicates)
                        // The UI usually pre-fills these, so we don't want to create them again
                        // if we are going to move them anyway.
                        // Note: This is a heuristic, but IDs would be better if available.
                        return !e.id;
                      })
                      .map((e: EcheanceInput) => ({
                        type: e.type,
                        dateEcheance:
                          normalizeToUTCNoon(e.dateEcheance) || new Date(),
                        montant: Number(e.montant || 0),
                        statut: e.statut,
                        reference: e.reference || null,
                        banque: e.banque || null,
                      })),
                  }
                : undefined,
          },
          include: {
            childBLs: true,
            echeances: true,
            fournisseur: true,
          },
        });

        // 2. Update grouped BLs status to VALIDEE and link them
        await tx.bonLivraison.updateMany({
          where: { id: { in: blIds } },
          data: {
            statut: 'VALIDEE',
            factureFournisseurId: invoice.id,
          },
        });

        // 3. Move all existing payments from BLs to this new invoice
        // This preserves treasury history and reconciliation
        await tx.echeancePaiement.updateMany({
          where: { bonLivraisonId: { in: blIds } },
          data: { factureFournisseurId: invoice.id },
        });

        console.log('[GROUP] Successfully created invoice', invoice.id);
        return invoice;
      } catch (txError) {
        console.error('[GROUP] TRANSACTION FAILED:', txError);
        throw txError;
      }
    });
  }
}
