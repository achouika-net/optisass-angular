import { Injectable, BadRequestException, NotFoundException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class FacturesService implements OnModuleInit {
    constructor(private prisma: PrismaService) { }

    async onModuleInit() {
        await this.cleanupExpiredDrafts();
        await this.migrateDraftsToDevis();
        await this.migrateBroNumbersToDevis();
    }

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
            numero = `Devis-${new Date().getTime()}`;
        } else {
            numero = await this.generateNextNumber(type);
        }

        console.log('💾 Creating facture with proprietes:', data.proprietes);

        // 4. Créer la facture
        // 4. Créer la facture - FIX: Sanitize input to remove nested relations
        const { client: ignoredClient, paiements, fiche, ...cleanData } = data as any;

        const facture = await this.prisma.facture.create({
            data: {
                ...cleanData,
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
                numero: 'desc'
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

            const isBrouillon = currentFacture?.statut === 'BROUILLON';
            const hasDraftNumber = currentFacture?.numero?.startsWith('BRO') || currentFacture?.numero?.startsWith('Devis');

            if (currentFacture && (isBrouillon || hasDraftNumber)) {
                console.log('📋 Validating BROUILLON/Draft-Number - Triggering Fiscal Traceability Flow');

                return this.prisma.$transaction(async (tx) => {
                    // 1. Create AVOIR (Cancel Draft)
                    const avoirData: Prisma.FactureUncheckedCreateInput = {
                        type: 'AVOIR',
                        statut: 'VALIDE',
                        numero: await this.generateNextNumber('AVOIR'), // Improve: Async inside transaction? Helper needs to be transaction-aware or careful.
                        dateEmission: new Date(),
                        clientId: currentFacture.clientId,
                        // No FicheID on Avoir
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
                            ...(currentFacture.proprietes as any || {}),
                            factureOriginale: currentFacture.numero,
                            ficheId: currentFacture.ficheId, // Store Fiche ID in proprietes due to unique constraint
                            raison: 'Annulation automatique du brouillon lors de la validation'
                        }
                    };
                    const avoir = await tx.facture.create({ data: avoirData });
                    console.log('✅ AVOIR created:', avoir.numero);

                    // 2. Prepare Valid Invoice Data (Official Number)
                    // Note: generateNextNumber checks DB. In transaction, we might need to be careful.
                    // But assume low concurrency for now or that it sees committed stats? 
                    // Prisma transaction holds connection. generateNextNumber uses `this.prisma` (outside tx).
                    // Logic fix: pass `tx` to generateNextNumber? Or just run it. 
                    // `generateNextNumber` is private. Let's call it before transaction or assume it's fine.
                    // Better: Get number BEFORE transaction to avoid locking/complexity, or use `tx` inside if refactored.
                    // For now, I'll allow `this.generateNextNumber` (non-tx) but it might miss the AVOIR increment if run strictly parallel?
                    // But here we generate FACTURE number. Avoir is AVOIR type. Distinct sequences. Safe.

                    const officialNumber = await this.generateNextNumber('FACTURE'); // Validating a DEVIS creates a FACTURE

                    // 3. Create New Valid Invoice
                    // Fix: Explicitly destruct to avoid passing nested objects like 'client' which cause PRISMA validation errors
                    // when mixed with 'clientId'. We want UNCHECKED input (flat IDs).
                    const { client, paiements, fiche, ...flatFacture } = currentFacture as any;

                    const newInvoiceData: Prisma.FactureUncheckedCreateInput = {
                        ...flatFacture,
                        id: undefined, // New ID
                        numero: officialNumber,
                        statut: 'VALIDE', // Starts as Valid
                        dateEmission: new Date(), // Reset emission date to Now
                        createdAt: new Date(), // Force new creation date
                        updatedAt: new Date(),
                        ficheId: undefined, // Will link after unlinking old
                        clientId: currentFacture.clientId, // Ensure clientId is explicitly passed
                        proprietes: {
                            ...(currentFacture.proprietes as any || {}),
                            ancienneReference: currentFacture.numero,
                            source: 'Validation Brouillon'
                        },
                        type: 'FACTURE' // Force type validation to FACTURE (Devis -> Facture)
                    };
                    const newInvoice = await tx.facture.create({ data: newInvoiceData });
                    console.log('✅ New Valid Invoice created:', newInvoice.numero);

                    // 4. Move Payments from Old -> New
                    await tx.paiement.updateMany({
                        where: { factureId: currentFacture.id },
                        data: { factureId: newInvoice.id }
                    });

                    // 5. Update Old Draft: Cancel + Unlink Fiche + Unlink Client? No client ok.
                    await tx.facture.update({
                        where: { id: currentFacture.id },
                        data: {
                            statut: 'ANNULEE',
                            ficheId: null, // Free up the Fiche linkage
                            proprietes: {
                                ...(currentFacture.proprietes as any || {}),
                                ficheId: currentFacture.ficheId // Preserve Fiche ID in proprietes
                            },
                            notes: `Remplacée par facture ${newInvoice.numero}`
                        }
                    });

                    // 6. Check Payment Status for New Invoice
                    // Recalculate based on moved payments
                    const movedPayments = await tx.paiement.findMany({ where: { factureId: newInvoice.id } });
                    const totalPaye = movedPayments.reduce((acc, p) => acc + p.montant, 0);
                    let finalStatut = 'VALIDE';
                    let reste = newInvoice.totalTTC - totalPaye;
                    if (totalPaye >= newInvoice.totalTTC) {
                        finalStatut = 'PAYEE';
                        reste = 0;
                    } else if (totalPaye > 0) {
                        finalStatut = 'PARTIEL';
                    }

                    // Link Fiche to New Invoice and update Status
                    const finalInvoice = await tx.facture.update({
                        where: { id: newInvoice.id },
                        data: {
                            ficheId: currentFacture.ficheId, // Re-link Fiche
                            statut: finalStatut,
                            resteAPayer: reste
                        }
                    });

                    return finalInvoice; // Return the NEW invoice so frontend redirects/updates
                });
            }
        }

        // FIX: Sanitize input for update as well
        const { client, paiements, fiche, ...cleanData } = data as any;

        return this.prisma.facture.update({
            data: cleanData,
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
        const isOfficial = !facture.numero.startsWith('BRO') && !facture.numero.startsWith('Devis');
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
                    proprietes: {
                        ...(facture.proprietes as any || {}),
                        ficheId: facture.ficheId // Store Fiche ID in proprietes
                    }
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

    async cleanupExpiredDrafts() {
        console.log('🧹 Cleaning up expired drafts...');
        const twoMonthsAgo = new Date();
        twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

        // Find unpaid drafts older than 2 months
        const expiredDrafts = await this.prisma.facture.findMany({
            where: {
                statut: 'BROUILLON',
                dateEmission: { lt: twoMonthsAgo },
                paiements: { none: {} } // No payments
            }
        });

        if (expiredDrafts.length > 0) {
            console.log(`🧹 Found ${expiredDrafts.length} expired drafts. Cancelling...`);

            // Bulk update (Prisma assumes same update for all)
            // or loop if we want to log each.
            await this.prisma.facture.updateMany({
                where: {
                    id: { in: expiredDrafts.map(d => d.id) }
                },
                data: {
                    statut: 'ANNULEE',
                    notes: 'Annulation automatique (Expiration > 2 mois sans paiement)'
                }
            });
            console.log('✅ Expired drafts cancelled.');
        } else {
            console.log('✨ No expired drafts found.');
        }
    }

    async migrateDraftsToDevis() {
        console.log('🔄 Migrating existing Drafts to Devis...');
        const result = await this.prisma.facture.updateMany({
            where: {
                statut: 'BROUILLON',
                type: 'FACTURE' // Change only those marked as FACTURE
            },
            data: {
                type: 'DEVIS'
            }
        });
        if (result.count > 0) {
            console.log(`✅ Migrated ${result.count} drafts to DEVIS.`);
        } else {
            console.log('✨ No drafts to migrate.');
        }
    }

    async migrateBroNumbersToDevis() {
        console.log('🔄 Migrating BRO- numbers to Devis-...');
        const drafts = await this.prisma.facture.findMany({
            where: {
                numero: { startsWith: 'BRO-' }
            }
        });

        let count = 0;
        for (const draft of drafts) {
            const newNumero = draft.numero.replace('BRO-', 'Devis-');
            await this.prisma.facture.update({
                where: { id: draft.id },
                data: { numero: newNumero }
            });
            count++;
        }

        if (count > 0) {
            console.log(`✅ Renamed ${count} drafts from BRO- to Devis-.`);
        } else {
            console.log('✨ No BRO- drafts to rename.');
        }
    }
}
