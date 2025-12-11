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
        // 1. Check for blocking fiches (Finalized states)
        const blockingCount = await this.prisma.fiche.count({
            where: {
                clientId: id,
                statut: { in: ['FACTURE', 'LIVRE', 'COMMANDE'] }
            }
        });

        if (blockingCount > 0) {
            throw new Error('Action refusée: Ce client possède des dossiers validés (Facturés/Livrés). Suppression impossible.');
        }

        // 2. Delete Safe Fiches & Client in Transaction
        const [_, deletedClient] = await this.prisma.$transaction([
            this.prisma.fiche.deleteMany({ where: { clientId: id } }),
            this.prisma.client.delete({ where: { id } })
        ]);

        return deletedClient;
    }
}
