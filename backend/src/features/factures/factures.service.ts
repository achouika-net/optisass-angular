import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class FacturesService {
    constructor(private prisma: PrismaService) { }

    async create(data: Prisma.FactureUncheckedCreateInput) {
        // 1. Vérifier que le client existe
        const client = await this.prisma.client.findUnique({
            where: { id: data.clientId }
        });

        if (!client) {
            throw new NotFoundException(`Client ${data.clientId} non trouvé`);
        }

        // 2. Valider les lignes (si c'est un objet JSON)
        if (!data.lignes || (Array.isArray(data.lignes) && data.lignes.length === 0)) {
            // Allow empty lines if it's an AVOIR (auto-generated) or strict? 
            // Usually Avoir copies lines. So we should be good.
            throw new BadRequestException('La facture doit contenir au moins une ligne');
        }

        // 3. Generate number based on status
        const type = data.type; // FACTURE, DEVIS, AVOIR, BL
        let numero = '';

        if (data.statut === 'BROUILLON') {
            // Temporary number for drafts
            numero = `BRO-${new Date().getTime()}`;
        } else {
            numero = await this.generateNextNumber(type);
        }

        console.log('💾 Creating facture with proprietes:', data.proprietes);

        // 4. Créer la facture
        const facture = await this.prisma.facture.create({
            data: {
                ...data,
                numero,
                statut: data.statut || 'BROUILLON',
                resteAPayer: data.totalTTC || 0
            }
        });

        console.log('✅ Facture created with proprietes:', facture.proprietes);

        return facture;
    }

    private async generateNextNumber(type: string): Promise<string> {
        const year = new Date().getFullYear();
        const prefix = this.getPrefix(type);

        // Find last document of this type for current year
        const lastDoc = await this.prisma.facture.findFirst({
            where: {
                type: type,
                numero: {
                    startsWith: `${prefix}-${year}`
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        let sequence = 1;
        if (lastDoc) {
            const parts = lastDoc.numero.split('-');
            if (parts.length === 3) {
                sequence = parseInt(parts[2]) + 1;
            }
        }

        return `${prefix}-${year}-${sequence.toString().padStart(3, '0')}`;
    }

    async findAll(params: {
        skip?: number;
        take?: number;
        cursor?: Prisma.FactureWhereUniqueInput;
        where?: Prisma.FactureWhereInput;
        orderBy?: Prisma.FactureOrderByWithRelationInput;
    }) {
        const { skip, take, cursor, where, orderBy } = params;
        return this.prisma.facture.findMany({
            skip,
            take,
            cursor,
            where,
            orderBy,
            include: {
                client: true,
                fiche: true,
                paiements: true
            }
        });
    }

    async findOne(id: string) {
        return this.prisma.facture.findUnique({
            where: { id },
            include: {
                client: true,
                fiche: true,
                paiements: true
            }
        });
    }

    async update(params: {
        where: Prisma.FactureWhereUniqueInput;
        data: Prisma.FactureUpdateInput;
    }) {
        const { where, data } = params;

        // Check if we are validating a BROUILLON (BROUILLON → VALIDE)
        if (data.statut === 'VALIDE') {
            const currentFacture = await this.prisma.facture.findUnique({
                where,
                include: { paiements: true, client: true }
            });

            // If currently BROUILLON, create AVOIR for fiscal traceability
            if (currentFacture && currentFacture.statut === 'BROUILLON') {
                console.log('📋 Validating BROUILLON - Creating AVOIR for fiscal traceability');

                // 1. Create AVOIR to cancel the BROUILLON
                const avoirData: Prisma.FactureUncheckedCreateInput = {
                    type: 'AVOIR',
                    statut: 'VALIDE',
                    numero: 'TEMP-AVOIR', // Will be replaced by create method
                    dateEmission: new Date(),
                    clientId: currentFacture.clientId,
                    ficheId: currentFacture.ficheId,
                    // Negative amounts to cancel the BROUILLON
                    lignes: (currentFacture.lignes as any[]).map(ligne => ({
                        ...ligne,
                        prixUnitaireTTC: -ligne.prixUnitaireTTC,
                        totalTTC: -ligne.totalTTC
                    })),
                    totalHT: -currentFacture.totalHT,
                    totalTVA: -currentFacture.totalTVA,
                    totalTTC: -currentFacture.totalTTC,
                    resteAPayer: 0,
                    proprietes: {
                        ...currentFacture.proprietes as any,
                        factureOriginale: currentFacture.numero,
                        raison: 'Annulation automatique pour validation'
                    }
                };

                const avoir = await this.create(avoirData);
                console.log('✅ AVOIR created:', avoir.numero);

                // 2. Assign official number to the now-VALIDE invoice
                data.numero = await this.generateNextNumber(currentFacture.type);
                console.log('✅ Assigning official number:', data.numero);

                // 3. Check payment status
                let totalPaye = 0;
                if (currentFacture.paiements) {
                    totalPaye = currentFacture.paiements.reduce((sum, p) => sum + p.montant, 0);
                }
                if (totalPaye > 0 && totalPaye < currentFacture.totalTTC) {
                    data.statut = 'PARTIEL';
                }
            }
            // If has temp number (BRO-xxx) but not BROUILLON status, just assign number
            else if (currentFacture && currentFacture.numero.startsWith('BRO')) {
                data.numero = await this.generateNextNumber(currentFacture.type);
                console.log('✅ Assigning new Number:', data.numero);
            }
        }

        return this.prisma.facture.update({
            data,
            where,
        });
    }

    async remove(where: Prisma.FactureWhereUniqueInput) {
        // 1. Get the invoice
        const facture = await this.prisma.facture.findUnique({
            where,
            include: { paiements: true }
        });

        if (!facture) {
            throw new NotFoundException('Facture non trouvée');
        }

        // Note: Cancelled invoices can be deleted, but this should be done with caution
        // as it removes audit trail. Consider using AVOIR instead for production.

        // 3. Logic: Last vs Middle
        // Check if it is the LAST official invoice of its type (and year)
        const isOfficial = !facture.numero.startsWith('BRO');
        let isLast = false;

        if (isOfficial) {
            const year = new Date().getFullYear(); // Or year from invoice date? strict sequential usually means current year context.
            // Better: Check if any invoice exists with same type and a HIGHER number (alphanumerically or creation date)
            const nextInvoice = await this.prisma.facture.findFirst({
                where: {
                    type: facture.type,
                    numero: { gt: facture.numero, startsWith: this.getPrefix(facture.type) }
                }
            });
            isLast = !nextInvoice;
        } else {
            isLast = true; // Drafts are always "last" in sense of deletable safe
        }

        // 3. Execution
        if (isLast) {
            // Safe to delete physically
            // But check payments first?
            if (facture.paiements && facture.paiements.length > 0) {
                // Even if last, if payments exist, we probably shouldn't just vanish it without warning?
                // But user said "doit etre supprimer". If payments exist, usually we should delete payments too?
                // or Block?
                // "les facture valides doivent etre annuler par avoir... si cette facture a des facture generer apres, si nn on la supprime"
                // Implies: If last -> delete. (Implicitly delete payments? Or block if paid?)
                // Usually deleting an invoice DELETES its payments (Cascade in UI or DB?). Schema says Paiement->Facture onDelete: Cascade?
                // Let's check schema. Checked: `onDelete: Cascade`. So payments vanish.
                return this.prisma.facture.delete({ where });
            }
            return this.prisma.facture.delete({ where });
        } else {
            // Not Last -> Create AVOIR
            // Calculate negative amounts
            const lignesAvoir = (facture.lignes as any[]).map(l => ({
                ...l,
                prixUnitaireTTC: -Math.abs(l.prixUnitaireTTC),
                totalTTC: -Math.abs(l.totalTTC),
                description: `Avoir sur facture ${facture.numero}: ${l.description}`
            }));

            // Create Avoir
            const avoirNumero = await this.generateNextNumber('AVOIR');

            const avoir = await this.prisma.facture.create({
                data: {
                    numero: avoirNumero,
                    type: 'AVOIR',
                    clientId: facture.clientId,
                    statut: 'VALIDE', // Avoirs are usually effective immediately
                    dateEmission: new Date(),
                    totalHT: -Math.abs(facture.totalHT),
                    totalTVA: -Math.abs(facture.totalTVA),
                    totalTTC: -Math.abs(facture.totalTTC),
                    resteAPayer: 0, // Avoirs don't have "to pay" usually, or they offset balance.
                    lignes: lignesAvoir,
                    notes: `Annulation de la facture ${facture.numero}`,
                }
            });

            // Mark original as ANNULEE
            await this.prisma.facture.update({
                where: { id: facture.id },
                data: { statut: 'ANNULEE' }
            });

            return { action: 'AVOIR_CREATED', avoir };
        }
    }

    private getPrefix(type: string): string {
        switch (type) {
            case 'FACTURE': return 'FAC';
            case 'DEVIS': return 'DEV';
            case 'AVOIR': return 'AVR';
            case 'BL': return 'BL';
            default: return 'DOC';
        }
    }
}
