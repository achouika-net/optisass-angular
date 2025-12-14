import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class ClientsService {
    constructor(private prisma: PrismaService) { }

    async create(data: Prisma.ClientCreateInput) {
        return this.prisma.client.create({
            data,
        });
    }

    async findAll(nom?: string) {
        if (nom) {
            return this.prisma.client.findMany({
                where: {
                    nom: {
                        contains: nom,
                        mode: 'insensitive',
                    },
                    typeClient: 'particulier' // Family logic usually applies to individuals
                },
                orderBy: { dateCreation: 'desc' },
            });
        }
        return this.prisma.client.findMany({
            orderBy: { dateCreation: 'desc' },
        });
    }

    async findOne(id: string) {
        return this.prisma.client.findUnique({
            where: { id },
            include: {
                fiches: true,
            },
        });
    }

    async update(id: string, data: Prisma.ClientUpdateInput) {
        return this.prisma.client.update({
            where: { id },
            data,
        });
    }

    async remove(id: string) {
        // 1. Check for Invoices (Blocker)
        const invoiceCount = await this.prisma.facture.count({
            where: { clientId: id }
        });

        if (invoiceCount > 0) {
            throw new Error('Action refusée: Ce client possède des factures (Actives ou Archivées). Suppression impossible pour préserver la comptabilité.');
        }

        // 2. Check for blocking fiches (Finalized states or even Active ones)
        // User said: "dossier ouverte avec des fiche medicales ... impacte chiffre d affaire"
        // Safest is to block if ANY fiche exists, or at least important ones.
        // Existing logic blocked 'FACTURE', 'LIVRE', 'COMMANDE'.
        // If we want to be safe, we might block all. But let's stick to "Important" ones or just Delete Valid ones?
        // Actually, if no invoices exist, Fiches are just "potential" orders. 
        // But if `statut` is VALIDE, it might be relevant history.
        // Let's keep existing check but maybe broaden it or clarify message.
        // If we delete client, we cascade delete fiches (see transaction below).
        // So strict safety = Block if key statuses.
        const blockingCount = await this.prisma.fiche.count({
            where: {
                clientId: id,
                statut: { in: ['FACTURE', 'LIVRE', 'COMMANDE', 'EN_COURS', 'VALIDE'] }
            }
        });

        if (blockingCount > 0) {
            throw new Error('Action refusée: Ce client a des dossiers en cours ou validés. Veuillez les archiver ou annuler avant suppression.');
        }

        // 3. Delete Safe Fiches & Client in Transaction
        const [_, deletedClient] = await this.prisma.$transaction([
            this.prisma.fiche.deleteMany({ where: { clientId: id } }),
            this.prisma.client.delete({ where: { id } })
        ]);

        return deletedClient;
    }
}
