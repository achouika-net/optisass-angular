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
        // 1. Check for **VALID** Invoices (FISCAL INTEGRITY - First Test)
        // User rule: "le premier test sera pour facture valide"

        const clientValidInvoices = await this.prisma.facture.findMany({
            where: {
                clientId: id,
                statut: { in: ['VALIDE', 'PAYEE', 'PARTIEL'] } // Official statuses
            },
            orderBy: { numero: 'desc' }
        });

        if (clientValidInvoices.length > 0) {
            // Client has valid invoices. We must verify they are the LAST ones globally.
            // "stricetement interdit de suprimer touts le process meme les paiments" if not last.

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
        // User rule: "on doit pas supprimer un dossier client qui a une fiche ouverte"
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
        // Order: Paiements -> Factures -> Fiches -> Client
        return this.prisma.$transaction(async (tx) => {

            // Delete payments linked to client invoices
            // (Actually Prisma generic cascade on Facture deletion handles this usually, but explicit is cleaner if relationships vary)
            // We'll rely on Prisma schema cascades if configured, but let's be thorough.
            // Actually, we can just delete Invoices and Fiches. 
            // Fiche -> Facture relation is 1-1 or 1-N.
            // Client -> Fiche (Cascade)
            // Client -> Facture (Restrict usually?)

            // Let's delete invoices manually first
            const invoices = await tx.facture.findMany({ where: { clientId: id } });
            const invoiceIds = invoices.map(i => i.id);

            // Delete payments
            if (invoiceIds.length > 0) {
                await tx.paiement.deleteMany({ where: { factureId: { in: invoiceIds } } });
            }

            // Delete invoices
            await tx.facture.deleteMany({ where: { clientId: id } });

            // Delete fiches
            await tx.fiche.deleteMany({ where: { clientId: id } });

            // Delete client
            return tx.client.delete({ where: { id } });
        });
    }
}
