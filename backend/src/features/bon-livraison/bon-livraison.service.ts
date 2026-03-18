import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateBonLivraisonDto } from './dto/create-bon-livraison.dto';
import { ProductsService } from '../products/products.service';
import { normalizeToUTCNoon } from '../../shared/utils/date-utils';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class BonLivraisonService {
    constructor(
        private prisma: PrismaService,
        private productsService: ProductsService,
    ) { }

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
            const uploadDir = path.join(process.cwd(), 'uploads', 'bl');
            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
            }
            const fileExt = path.extname(fileName) || '.jpg';
            const safeName = `bl_${Date.now()}${fileExt}`;
            const filePath = path.join(uploadDir, safeName);
            const buffer = Buffer.from(
                base64File.replace(/^data:.*?;base64,/, ''),
                'base64',
            );
            fs.writeFileSync(filePath, buffer);
            pieceJointeUrl = `/uploads/bl/${safeName}`;
        }

        const finalEcheances = echeances || [];

        return this.prisma.bonLivraison.create({
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
    }) {
        const { fournisseurId, statut, clientId, centreId, ficheId, startDate, endDate, page, limit, categorieBL } = filters;
        const whereClause: any = {};

        if (fournisseurId) whereClause.fournisseurId = fournisseurId;
        if (statut) whereClause.statut = statut;
        if (clientId) whereClause.clientId = clientId;
        if (centreId) whereClause.centreId = centreId;
        if (ficheId) whereClause.ficheId = ficheId;
        if (categorieBL) whereClause.categorieBL = categorieBL;

        if (startDate || endDate) {
            whereClause.dateEmission = {};
            if (startDate) whereClause.dateEmission.gte = new Date(startDate);
            if (endDate) whereClause.dateEmission.lte = new Date(endDate);
        }

        const skip = page && limit ? (Number(page) - 1) * Number(limit) : undefined;
        const take = limit ? Number(limit) : 10;

        // BULK AUTO-REPAIR: Link orphan expenses to BLs with same amount and date (recent only)
        try {
            const unlinkedBLs = await this.prisma.bonLivraison.findMany({
                where: {
                    ...whereClause,
                    depense: null,
                    montantTTC: { gt: 0 }
                },
                take: 50 // Limit per request for performance
            });

            for (const bl of unlinkedBLs) {
                const orphanMatch = await this.prisma.depense.findFirst({
                    where: {
                        bonLivraisonId: null,
                        montant: bl.montantTTC,
                        statut: 'VALIDE',
                        createdAt: {
                            gte: new Date(bl.dateEmission.getTime() - 2 * 24 * 60 * 60 * 1000),
                            lte: new Date(bl.dateEmission.getTime() + 2 * 24 * 60 * 60 * 1000)
                        }
                    }
                });

                if (orphanMatch) {
                    await this.prisma.depense.update({
                        where: { id: orphanMatch.id },
                        data: { bonLivraisonId: bl.id }
                    });
                }
            }
        } catch (e) {
            console.error('[BonLivraisonService] Auto-repair failed:', e);
        }

        const [data, total] = await Promise.all([
            this.prisma.bonLivraison.findMany({
                where: whereClause,
                include: {
                    fournisseur: { select: { id: true, nom: true } },
                    echeances: true,
                    depense: true,
                    // Inclus les fiches du client pour trouver la plus proche si nécessaire
                    client: {
                        select: {
                            id: true,
                            nom: true,
                            prenom: true,
                            numeroPieceIdentite: true,
                            fiches: { select: { id: true, numero: true, dateCreation: true } },
                        },
                    },
                    fiche: { select: { id: true, numero: true, type: true } },
                    factureFournisseur: { select: { id: true, numeroFacture: true } },
                },
                orderBy: { dateEmission: 'desc' },
                skip,
                take,
            }),
            this.prisma.bonLivraison.count({ where: whereClause }),
        ]);

        const enrichedData = await Promise.all(
            data.map(async (bl) => {
                const result = { ...bl } as any;

                // AUTO-LINK: If no result.depense is linked, try to find a matching orphan expense
                // Refined: Check both 'VALIDE' and 'VALIDEE', use user-entered 'date' field, and match 'fournisseurId'
                if (!result.depense && result.montantTTC > 0) {
                    const blDate = result.dateEmission.getTime();
                    const orphanMatch = await this.prisma.depense.findFirst({
                        where: {
                            bonLivraisonId: null,
                            fournisseurId: result.fournisseurId,
                            montant: {
                                gte: result.montantTTC - 0.05,
                                lte: result.montantTTC + 0.05,
                            },
                            statut: { in: ['VALIDE', 'VALIDEE'] },
                            date: {
                                gte: new Date(blDate - 4 * 24 * 60 * 60 * 1000), // +/- 4 days window
                                lte: new Date(blDate + 4 * 24 * 60 * 60 * 1000),
                            },
                        },
                    });

                    if (orphanMatch) {
                        await this.prisma.depense.update({
                            where: { id: orphanMatch.id },
                            data: { bonLivraisonId: result.id },
                        });
                        result.depense = orphanMatch;
                    }
                }

                // SELF-REPAIR: Ensure status matches actual payments
                const activeEcheances = (result.echeances || []).filter((e: any) => e.statut !== 'ANNULE');
                const totalPaidEcheances = activeEcheances
                    .filter((e: any) => e.statut === 'ENCAISSE')
                    .reduce((sum: number, e: any) => sum + e.montant, 0);

                const directPaid = (result.depense && (result.depense.statut === 'VALIDE' || result.depense.statut === 'VALIDEE')) ? result.depense.montant : 0;
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
                        (e: any) => (e.type === 'CHEQUE' || e.type === 'LCN' || e.type === 'VIREMENT') && e.statut !== 'ANNULE',
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

                if (
                    !result.fiche &&
                    result.client &&
                    (result.client as any).fiches &&
                    (result.client as any).fiches.length > 0
                ) {
                    const closestFiche = (result.client as any).fiches.reduce((prev: any, curr: any) => {
                        const prevDiff = Math.abs(prev.dateCreation.getTime() - result.dateEmission.getTime());
                        const currDiff = Math.abs(curr.dateCreation.getTime() - result.dateEmission.getTime());
                        return currDiff < prevDiff ? curr : prev;
                    });
                    result.fiche = closestFiche as any;
                }

                if (result.client) {
                    delete (result.client as any).fiches;
                }
                return result;
            }),
        );

        // Calculate stats on enriched data
        const finalStats = enrichedData.reduce(
            (acc: any, curr: any) => {
                acc.totalTTC += curr.montantTTC || 0;
                const paidEcheances = (curr.echeances || [])
                    .filter((e: any) => e.statut === 'ENCAISSE')
                    .reduce((sum: number, e: any) => sum + e.montant, 0);
                const directPaid = (curr.depense && (curr.depense.statut === 'VALIDE' || curr.depense.statut === 'VALIDEE')) ? curr.depense.montant : 0;
                acc.totalPaid += paidEcheances + directPaid;
                return acc;
            },
            { totalTTC: 0, totalPaid: 0 },
        );

        return {
            data: enrichedData,
            total,
            stats: {
                totalTTC: Math.round(finalStats.totalTTC * 100) / 100,
                totalPaid: Math.round(finalStats.totalPaid * 100) / 100,
                totalRemaining: Math.round((finalStats.totalTTC - finalStats.totalPaid) * 100) / 100,
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
            const uploadDir = path.join(process.cwd(), 'uploads', 'bl');
            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
            }
            const fileExt = path.extname(fileName) || '.jpg';
            const safeName = `bl_update_${Date.now()}${fileExt}`;
            const filePath = path.join(uploadDir, safeName);
            const buffer = Buffer.from(
                base64File.replace(/^data:.*?;base64,/, ''),
                'base64',
            );
            fs.writeFileSync(filePath, buffer);
            pieceJointeUrl = `/uploads/bl/${safeName}`;
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
                    dateEmission: inputData.dateEmission ? normalizeToUTCNoon(inputData.dateEmission) as Date : undefined,
                    dateEcheance: inputData.dateEcheance ? normalizeToUTCNoon(inputData.dateEcheance) as Date : undefined,
                    montantHT: inputData.montantHT !== undefined ? Number(inputData.montantHT) : undefined,
                    montantTVA: inputData.montantTVA !== undefined ? Number(inputData.montantTVA) : undefined,
                    montantTTC: inputData.montantTTC !== undefined ? Number(inputData.montantTTC) : undefined,
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
        return this.prisma.bonLivraison.delete({ where: { id } });
    }
}
