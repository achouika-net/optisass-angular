import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSupplierInvoiceDto } from './dto/create-supplier-invoice.dto';
import { ProductsService } from '../products/products.service';
import { normalizeToUTCNoon } from '../../shared/utils/date-utils';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class SupplierInvoicesService {
    constructor(
        private prisma: PrismaService,
        private productsService: ProductsService
    ) { }

    async create(createDto: CreateSupplierInvoiceDto) {
        const { echeances, base64File, fileName, ...invoiceData } = createDto;

        // Robust duplicate check
        const existingInvoice = await this.checkExistence(invoiceData.fournisseurId, invoiceData.numeroFacture);

        if (existingInvoice) {
            console.log(`[INVOICE] Update existing invoice ${existingInvoice.numeroFacture} for supplier ${invoiceData.fournisseurId}`);
            return this.update(existingInvoice.id, createDto);
        }

        // Handle File Attachment
        let pieceJointeUrl = invoiceData.pieceJointeUrl || '';
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

        const status = this.calculateInvoiceStatus(invoiceData.montantTTC, echeances || []);

        // Si aucune échéance n'est fournie (ex: BL simple), on en crée une par défaut pour le total
        const finalEcheances = (echeances && echeances.length > 0) ? echeances : [
            {
                type: 'ESPECES',
                dateEcheance: normalizeToUTCNoon(invoiceData.dateEcheance || new Date()) as Date,
                montant: invoiceData.montantTTC,
                statut: 'EN_ATTENTE'
            }
        ];

        return this.prisma.factureFournisseur.create({
            data: {
                ...invoiceData,
                pieceJointeUrl,
                dateEmission: normalizeToUTCNoon(invoiceData.dateEmission) as Date,
                dateEcheance: normalizeToUTCNoon(invoiceData.dateEcheance),
                statut: status,
                centreId: invoiceData.centreId, // Explicitly map it
                echeances: {
                    create: finalEcheances.map(e => ({
                        ...e,
                        dateEcheance: normalizeToUTCNoon(e.dateEcheance) as Date
                    }))
                }
            },
            include: {
                echeances: true,
                fournisseur: true
            }
        });
    }

    async findAll(filters: {
        fournisseurId?: string;
        statut?: string;
        clientId?: string;
        centreId?: string;
        isBL?: boolean;
        categorieBL?: string;
        parentInvoiceId?: string;
        startDate?: string;
        endDate?: string;
    }) {
        const { fournisseurId, statut, clientId, centreId, isBL, categorieBL, parentInvoiceId, startDate, endDate } = filters;
        const whereClause: any = {};

        if (fournisseurId) whereClause.fournisseurId = fournisseurId;
        if (statut) whereClause.statut = statut;
        if (clientId) whereClause.clientId = clientId;
        if (centreId) whereClause.centreId = centreId;
        if (isBL !== undefined) {
            whereClause.isBL = isBL === false ? { in: [false, null] } : isBL;
        }
        if (categorieBL) whereClause.categorieBL = categorieBL;
        if (parentInvoiceId) whereClause.parentInvoiceId = parentInvoiceId;

        if (startDate || endDate) {
            whereClause.dateEmission = {};
            if (startDate) whereClause.dateEmission.gte = new Date(startDate);
            if (endDate) whereClause.dateEmission.lte = new Date(endDate);
        }

        return this.prisma.factureFournisseur.findMany({
            where: whereClause,
            include: {
                fournisseur: true,
                echeances: true,
                client: true,
                parentInvoice: true
            },
            orderBy: { dateEmission: 'desc' }
        });
    }

    async findOne(id: string) {
        return this.prisma.factureFournisseur.findUnique({
            where: { id },
            include: {
                fournisseur: true,
                echeances: true,
                depenses: true,
                client: true,
                parentInvoice: true,
                childBLs: {
                    include: {
                        client: true
                    }
                }
            }
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
                    mode: 'insensitive'
                }
            },
            include: {
                echeances: true,
                fournisseur: true
            }
        });
    }

    async update(id: string, updateDto: any) {
        const { echeances, base64File, fileName, ...invoiceData } = updateDto;

        // Clean invoiceData to remove unwanted circular or extra relation objects
        const cleanedInvoiceData: any = {
            numeroFacture: invoiceData.numeroFacture,
            dateEmission: normalizeToUTCNoon(invoiceData.dateEmission),
            dateEcheance: normalizeToUTCNoon(invoiceData.dateEcheance),
            montantHT: invoiceData.montantHT,
            montantTVA: invoiceData.montantTVA,
            montantTTC: invoiceData.montantTTC,
            statut: invoiceData.statut,
            type: invoiceData.type,
            pieceJointeUrl: invoiceData.pieceJointeUrl,
            fournisseurId: invoiceData.fournisseurId,
            centreId: invoiceData.centreId,
            clientId: invoiceData.clientId,
        };

        // Handle File Attachment Update (Multi-file support)
        const newAttachments = updateDto.newAttachments || [];
        const existingAttachments = updateDto.existingAttachments || [];
        const finalUrls: string[] = [];

        // 1. Process Existing Attachments
        if (Array.isArray(existingAttachments)) {
            existingAttachments.forEach(url => {
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
        const uploadDir = path.join(process.cwd(), 'uploads', 'invoices');
        if (newAttachments.length > 0 && !fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        for (const attachment of newAttachments) {
            if (attachment.base64 && attachment.name) {
                const fileExt = path.extname(attachment.name) || '.jpg';
                const safeName = `inv_${Date.now()}_${Math.round(Math.random() * 1000)}${fileExt}`;
                const filePath = path.join(uploadDir, safeName);

                // Base64 cleanup
                const matches = attachment.base64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
                let fileData = attachment.base64;
                if (matches && matches.length === 3) fileData = matches[2];
                else fileData = attachment.base64.replace(/^data:.*?;base64,/, '');

                fs.writeFileSync(filePath, Buffer.from(fileData, 'base64'));
                finalUrls.push(`/uploads/invoices/${safeName}`);
            }
        }

        // 3. Fallback: Legacy Single File (if newAttachments empty but base64File present)
        if (newAttachments.length === 0 && base64File && fileName) {
            if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
            const fileExt = path.extname(fileName) || '.jpg';
            const safeName = `inv_update_${Date.now()}${fileExt}`;
            const filePath = path.join(uploadDir, safeName);

            const matches = base64File.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
            let fileData = base64File;
            if (matches && matches.length === 3) fileData = matches[2];
            else fileData = base64File.replace(/^data:.*?;base64,/, '');

            fs.writeFileSync(filePath, Buffer.from(fileData, 'base64'));
            finalUrls.push(`/uploads/invoices/${safeName}`);
        }

        // 4. Save combined URLs
        if (finalUrls.length > 0) {
            cleanedInvoiceData.pieceJointeUrl = finalUrls.join(';');
        } else if (updateDto.pieceJointeUrl === null && existingAttachments.length === 0) {
            cleanedInvoiceData.pieceJointeUrl = null;
        }

        return this.prisma.$transaction(async (tx) => {
            if (echeances) {
                // Pour simplifier, on supprime les anciennes échéances et on recrée
                await tx.echeancePaiement.deleteMany({
                    where: { factureFournisseurId: id }
                });
            }

            const status = this.calculateInvoiceStatus(cleanedInvoiceData.montantTTC || 0, echeances || []);
            cleanedInvoiceData.statut = status;

            return tx.factureFournisseur.update({
                where: { id },
                data: {
                    ...cleanedInvoiceData,
                    echeances: echeances ? {
                        create: echeances.map((e: any) => ({
                            type: e.type,
                            dateEcheance: normalizeToUTCNoon(e.dateEcheance) as Date,
                            dateEncaissement: normalizeToUTCNoon(e.dateEncaissement),
                            montant: e.montant,
                            statut: e.statut,
                            reference: e.reference || null,
                            banque: e.banque || null,
                            remarque: e.remarque || null
                        }))
                    } : undefined
                },
                include: {
                    echeances: true
                }
            });
        });
    }

    private calculateInvoiceStatus(totalTTC: number, echeances: any[]): string {
        if (!echeances || echeances.length === 0) return 'EN_ATTENTE';

        // Filter out cancelled ones
        const activeEcheances = echeances.filter(e => e.statut !== 'ANNULE');
        if (activeEcheances.length === 0) return 'EN_ATTENTE';

        const totalPaid = Math.round(activeEcheances
            .filter(e => e.statut === 'ENCAISSE')
            .reduce((sum, e) => sum + (e.montant || 0), 0) * 100) / 100;

        const roundedTotalTTC = Math.round(totalTTC * 100) / 100;

        if (totalPaid >= roundedTotalTTC && roundedTotalTTC > 0) {
            return 'PAYEE';
        }

        if (totalPaid > 0) return 'PARTIELLE';

        const hasScheduled = activeEcheances.some(e => e.type !== 'ESPECES' && e.statut === 'EN_ATTENTE');
        return hasScheduled ? 'PARTIELLE' : 'EN_ATTENTE';
    }

    async remove(id: string) {
        return this.prisma.$transaction(async (tx) => {
            const invoice = await tx.factureFournisseur.findUnique({
                where: { id },
                include: { mouvementsStock: true }
            });

            if (!invoice) return null;

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

            // 4. Delete payment schedules
            await tx.echeancePaiement.deleteMany({
                where: { factureFournisseurId: id }
            });

            // 5. Delete the Invoice itself
            return tx.factureFournisseur.delete({
                where: { id }
            });
        });
    }

    async getSupplierSituation(fournisseurId: string, startDate?: string, endDate?: string) {
        const whereClause: any = {
            fournisseurId: fournisseurId,
            statut: { not: 'ANNULEE' }
        };

        if (startDate || endDate) {
            whereClause.dateEmission = {};
            if (startDate) whereClause.dateEmission.gte = new Date(startDate);
            if (endDate) whereClause.dateEmission.lte = new Date(endDate);
        }

        const invoices = await this.prisma.factureFournisseur.findMany({
            where: whereClause,
            include: {
                echeances: true
            }
        });

        let totalTTC = 0;
        let totalPaye = 0;

        for (const invoice of invoices) {
            totalTTC += invoice.montantTTC;

            // Calculate paid amount from echeances
            if (invoice.echeances) {
                const paidEcheances = invoice.echeances.filter(e => e.statut === 'ENCAISSE');
                const paidAmount = paidEcheances.reduce((sum, e) => sum + e.montant, 0);
                totalPaye += paidAmount;
            }

            // If invoices are marked PAYEE manually but no echeances? 
            // We assume echeances are the source of truth for payment, 
            // but if status is PAYEE and paidAmount is 0, maybe we should count full amount? 
            // Let's stick to echeances for accuracy, or if status is PAYEE assume full if no echeances exist?
            // For now, let's rely on echeances for calculation.
        }

        return {
            fournisseurId,
            totalTTC,
            totalPaye,
            resteAPayer: totalTTC - totalPaye,
            invoiceCount: invoices.length
        };
    }

    async groupBLsToInvoice(blIds: string[], targetInvoiceData: any) {
        const { echeances, newAttachments, ...invoiceData } = targetInvoiceData;

        // Handle Attachments (Shared logic with create/update)
        let finalPieceJointeUrl = invoiceData.pieceJointeUrl || '';
        const uploadDir = path.join(process.cwd(), 'uploads', 'invoices');

        if (newAttachments && newAttachments.length > 0) {
            if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
            const urls: string[] = [];
            for (const attachment of newAttachments) {
                if (attachment.base64 && attachment.name) {
                    const fileExt = path.extname(attachment.name) || '.jpg';
                    const safeName = `grouped_${Date.now()}_${Math.round(Math.random() * 1000)}${fileExt}`;
                    const filePath = path.join(uploadDir, safeName);
                    const fileData = attachment.base64.replace(/^data:.*?;base64,/, '');
                    fs.writeFileSync(filePath, Buffer.from(fileData, 'base64'));
                    urls.push(`/uploads/invoices/${safeName}`);
                }
            }
            finalPieceJointeUrl = urls.join(';');
        }

        const status = this.calculateInvoiceStatus(invoiceData.montantTTC, echeances || []);

        return this.prisma.$transaction(async (tx) => {
            // 1. Create the consolidated invoice
            const invoice = await tx.factureFournisseur.create({
                data: {
                    ...invoiceData,
                    pieceJointeUrl: finalPieceJointeUrl,
                    isBL: false,
                    statut: status,
                    dateEmission: normalizeToUTCNoon(invoiceData.dateEmission) as Date,
                    dateEcheance: normalizeToUTCNoon(invoiceData.dateEcheance),
                    // Link all BLs to this new invoice
                    childBLs: {
                        connect: blIds.map(id => ({ id }))
                    },
                    // Create echeances
                    echeances: echeances ? {
                        create: echeances.map((e: any) => ({
                            type: e.type,
                            dateEcheance: normalizeToUTCNoon(e.dateEcheance) as Date,
                            montant: e.montant,
                            statut: e.statut,
                            reference: e.reference || null,
                            banque: e.banque || null
                        }))
                    } : undefined
                },
                include: {
                    childBLs: true,
                    echeances: true,
                    fournisseur: true
                }
            });

            // 2. [Bonus] Update grouped BLs status to VALIDEE to distinguish them
            await tx.factureFournisseur.updateMany({
                where: { id: { in: blIds } },
                data: { statut: 'VALIDEE' }
            });

            return invoice;
        });
    }
}

