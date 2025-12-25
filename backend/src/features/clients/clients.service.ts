import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LoyaltyService } from '../loyalty/loyalty.service';
import { Prisma } from '@prisma/client';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

@Injectable()
export class ClientsService {
    constructor(
        private prisma: PrismaService,
        private loyaltyService: LoyaltyService
    ) { }

    async create(createClientDto: CreateClientDto) {
        // Validate centre existence
        const centreId = createClientDto.centreId;
        if (centreId) {
            const centreExists = await this.prisma.centre.findUnique({
                where: { id: centreId }
            });
            if (!centreExists) {
                throw new BadRequestException(`Centre non trouvé (${centreId}). Votre session est peut-être obsolète. Veuillez vous déconnecter et vous reconnecter pour rafraîchir vos accès.`);
            }
        }

        const client = await this.prisma.client.create({
            data: createClientDto as unknown as Prisma.ClientCreateInput,
        });

        if (client.parrainId) {
            await this.loyaltyService.awardReferralBonus(client.parrainId, client.id);
        }

        return client;
    }

    async findAll(nom?: string, centreId?: string) {
        const whereClause: any = {};

        if (nom) {
            whereClause.nom = {
                contains: nom,
                mode: 'insensitive',
            };
            whereClause.typeClient = 'particulier';
        }

        if (!centreId) return []; // Isolation
        whereClause.centreId = centreId;

        return this.prisma.client.findMany({
            where: whereClause,
            orderBy: { dateCreation: 'desc' },
            include: {
                centre: true // Optional: verification
            }
        });
    }

    async findOne(id: string) {
        return this.prisma.client.findUnique({
            where: { id },
            include: {
                fiches: true,
                parrain: true,
                filleuls: true,
                pointsHistory: {
                    include: { facture: true },
                    orderBy: { date: 'desc' }
                }
            },
        });
    }

    async update(id: string, updateClientDto: UpdateClientDto) {
        return this.prisma.client.update({
            where: { id },
            data: updateClientDto as unknown as Prisma.ClientUpdateInput,
        });
    }

    async remove(id: string) {
        // 1. Check for **VALID** Invoices (FISCAL INTEGRITY - First Test)
        const clientValidInvoices = await this.prisma.facture.findMany({
            where: {
                clientId: id,
                statut: { in: ['VALIDE', 'PAYEE', 'PARTIEL'] } // Official statuses
            },
            orderBy: { numero: 'desc' }
        });

        if (clientValidInvoices.length > 0) {
            const globalLastValidInvoices = await this.prisma.facture.findMany({
                where: {
                    statut: { in: ['VALIDE', 'PAYEE', 'PARTIEL'] }
                },
                orderBy: { numero: 'desc' },
                take: clientValidInvoices.length
            });

            const clientIds = clientValidInvoices.map(f => f.id).sort();
            const globalIds = globalLastValidInvoices.map(f => f.id).sort();

            const isSafeToDelete = clientIds.length === globalIds.length &&
                clientIds.every((val, index) => val === globalIds[index]);

            if (!isSafeToDelete) {
                const globalLast = globalLastValidInvoices[0];
                throw new Error(`Supression impossible: La continuité fiscale n'est pas respectée. Une facture plus récente existe (${globalLast?.numero}). Action strictement interdite.`);
            }
        }

        // 2. Check for **OPEN** Fiches (OPERATIONAL SAFETY)
        const openFichesCount = await this.prisma.fiche.count({
            where: {
                clientId: id,
                statut: 'EN_COURS'
            }
        });

        if (openFichesCount > 0) {
            throw new Error('Supression impossible: Ce client a des fiches en cours. Veuillez les annuler d\'abord.');
        }

        // 3. SAFE EXECUTION: Cascade Delete
        return this.prisma.$transaction(async (tx) => {
            const invoices = await tx.facture.findMany({ where: { clientId: id } });
            const invoiceIds = invoices.map(i => i.id);

            if (invoiceIds.length > 0) {
                await tx.paiement.deleteMany({ where: { factureId: { in: invoiceIds } } });
            }

            await tx.facture.deleteMany({ where: { clientId: id } });
            await tx.fiche.deleteMany({ where: { clientId: id } });
            return tx.client.delete({ where: { id } });
        });
    }
}
