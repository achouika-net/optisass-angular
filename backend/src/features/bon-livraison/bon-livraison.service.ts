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

        const [data, total] = await Promise.all([
            this.prisma.bonLivraison.findMany({
                where: whereClause,
                include: {
                    fournisseur: { select: { id: true, nom: true } },
                    echeances: true,
                    // Inclus les fiches du client pour trouver la plus proche si nécessaire
                    client: {
                        select: {
                            id: true, nom: true, prenom: true, numeroPieceIdentite: true,
                            fiches: { select: { id: true, numero: true, dateCreation: true } }
                        }
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

        const enrichedData = data.map(bl => {
            const result = { ...bl };
            if (!result.fiche && result.client && (result.client as any).fiches && (result.client as any).fiches.length > 0) {
                // Find closest fiche
                const closestFiche = (result.client as any).fiches.reduce((prev: any, curr: any) => {
                    const prevDiff = Math.abs(prev.dateCreation.getTime() - result.dateEmission.getTime());
                    const currDiff = Math.abs(curr.dateCreation.getTime() - result.dateEmission.getTime());
                    return currDiff < prevDiff ? curr : prev;
                });
                result.fiche = closestFiche as any;
            }
            // Nettoyage pour ne pas renvoyer toutes les fiches au front
            if (result.client) {
                delete (result.client as any).fiches;
            }
            return result;
        });

        return { data: enrichedData, total };
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

        return this.prisma.bonLivraison.update({
            where: { id },
            data: {
                ...inputData as any,
                dateEmission: inputData.dateEmission ? normalizeToUTCNoon(inputData.dateEmission) as Date : undefined,
                dateEcheance: inputData.dateEcheance ? normalizeToUTCNoon(inputData.dateEcheance) as Date : undefined,
            },
        });
    }

    async remove(id: string) {
        return this.prisma.bonLivraison.delete({ where: { id } });
    }
}
