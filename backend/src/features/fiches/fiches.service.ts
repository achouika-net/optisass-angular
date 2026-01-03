import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { FacturesService } from '../factures/factures.service';
import { LoyaltyService } from '../loyalty/loyalty.service';

@Injectable()
export class FichesService {
    constructor(
        private prisma: PrismaService,
        private facturesService: FacturesService,
        private loyaltyService: LoyaltyService
    ) { }

    async create(data: Prisma.FicheCreateInput) {
        try {
            console.log('💾 Attempting to save fiche to database...');

            // Extract clientId from the data (support both flat clientId and nested client.connect.id)
            let clientId: string | undefined;

            // First check for flat clientId (what frontend sends)
            if ((data as any).clientId) {
                clientId = (data as any).clientId;
                console.log('✅ Found clientId in flat structure:', clientId);
            }
            // Then check for nested client.connect.id structure
            else if (typeof data.client === 'object' && data.client && 'connect' in data.client && (data.client as any).connect) {
                clientId = (data.client as any).connect.id;
                console.log('✅ Found clientId in nested structure:', clientId);
            }

            if (!clientId) {
                console.log('❌ No clientId found in data:', JSON.stringify(data, null, 2));
                throw new BadRequestException('Client ID is required');
            }

            // check client
            // 1. Fetch the client to check status
            console.log('🔍 Verifying client existence for ID:', clientId);
            const client = await this.prisma.client.findUnique({
                where: { id: clientId as string }
            });

            if (!client) {
                console.error('❌ Client not found for ID:', clientId);
                throw new BadRequestException('Client not found');
            }

            // 2. If client is INACTIF, validate required fields (skip for anonymous)
            if (client.statut === 'INACTIF' && client.typeClient !== 'anonyme') {
                console.log('⚠️ Client is INACTIF, validating required fields...');
                this.validateRequiredFields(client);
            }

            // Construct Content JSON from loose fields
            const looseData = data as any;

            // Fix: Frontend sends content nested in 'content' field via FicheService.createFicheMonture
            // We must extract it correctly, falling back to looseData (flat) if not nested.
            const incomingContent = (looseData.content && typeof looseData.content === 'object') ? looseData.content : looseData;

            const content = {
                ordonnance: incomingContent.ordonnance,
                monture: incomingContent.monture,
                verres: incomingContent.verres,
                montage: incomingContent.montage,
                suggestions: incomingContent.suggestions,
                equipements: incomingContent.equipements,
            };

            // 3. Create the fiche with explicit data mapping
            // Using UncheckedCreateInput to allow scalar clientId
            const createData: Prisma.FicheUncheckedCreateInput = {
                clientId: clientId as string,
                statut: data.statut,
                type: data.type,
                montantTotal: data.montantTotal,
                montantPaye: data.montantPaye,
                dateLivraisonEstimee: data.dateLivraisonEstimee,
                content: content as any,
            };

            const result = await this.prisma.fiche.create({
                data: createData,
            });
            console.log('✅ Fiche saved successfully:', result.id);

            // 4. If client was INACTIF, transition to ACTIF
            if (client.statut === 'INACTIF') {
                await this.prisma.client.update({
                    where: { id: clientId as string },
                    data: { statut: 'ACTIF' }
                });
                console.log('✅ Client status updated: INACTIF → ACTIF');
            }

            // 5. AUTOMATIC INVOICE GENERATION (BROUILLON)
            console.log('🧾 Checking/Creating Draft Invoice for Fiche...');
            try {
                // Check if invoice already exists for this Fiche
                const existingInvoice = await this.prisma.facture.findUnique({
                    where: { ficheId: result.id }
                });

                if (!existingInvoice) {
                    // AUTOMATIC INVOICE CREATION REMOVED
                    // Reason: Frontend creates detailed invoice immediately after (Scenario 2).
                    console.log('ℹ️ Automatic draft creation disabled to prevent duplicates.');
                } else {
                    console.log('ℹ️ Invoice already exists for this Fiche, skipping creation.');
                }
            } catch (invError) {
                console.error('⚠️ Failed to check invoice existence:', invError);
            }

            // 6. Award Loyalty Points for Folder Creation
            console.log('💎 Triggering loyalty points for folder creation. Client:', clientId, 'Fiche:', result.id);
            try {
                await this.loyaltyService.awardPointsForFolderCreation(clientId as string, result.id);
                console.log('✅ Loyalty points trigger finished.');
            } catch (pError) {
                console.error('⚠️ Failed to award loyalty points:', pError);
            }

            return this.unpackContent(result);
        } catch (error) {
            console.error('❌ ERROR saving fiche:');
            console.error('Error:', error);
            console.error('Error message:', error.message);
            console.error('Error stack:', error.stack);
            throw error;
        }
    }

    private validateRequiredFields(client: any): void {
        const missing: string[] = [];

        if (!client.dateNaissance) missing.push('Date de naissance');
        if (!client.telephone) missing.push('Téléphone');
        if (!client.ville) missing.push('Ville');

        if (missing.length > 0) {
            throw new BadRequestException({
                message: 'Profil client incomplet. Veuillez compléter les champs requis avant de créer un dossier médical.',
                missingFields: missing,
                clientId: client.id
            });
        }
    }

    async findAllByClient(clientId: string) {
        const fiches = await this.prisma.fiche.findMany({
            where: { clientId },
            orderBy: { dateCreation: 'desc' },
        });
        return fiches.map((f: any) => this.unpackContent(f));
    }

    async findOne(id: string) {
        const fiche = await this.prisma.fiche.findUnique({
            where: { id },
        });
        return fiche ? this.unpackContent(fiche) : null;
    }

    async update(id: string, data: Prisma.FicheUpdateInput) {
        const looseData = data as any;
        // Safe Merge Strategy: Fetch existing content first
        const currentFiche = await this.prisma.fiche.findUnique({
            where: { id },
            select: { content: true }
        });
        const currentContent = currentFiche?.content as any || {};

        // Fix: Frontend sends content nested in 'content' field via FicheService.updateFiche
        // We must extract it correctly, falling back to looseData (flat) if not nested.
        const incomingContent = (looseData.content && typeof looseData.content === 'object') ? looseData.content : looseData;

        const content = {
            ordonnance: incomingContent.ordonnance !== undefined ? incomingContent.ordonnance : currentContent.ordonnance,
            monture: incomingContent.monture !== undefined ? incomingContent.monture : currentContent.monture,
            verres: incomingContent.verres !== undefined ? incomingContent.verres : currentContent.verres,
            montage: incomingContent.montage !== undefined ? incomingContent.montage : currentContent.montage,
            suggestions: incomingContent.suggestions !== undefined ? incomingContent.suggestions : currentContent.suggestions,
            equipements: incomingContent.equipements !== undefined ? incomingContent.equipements : currentContent.equipements,
        };

        const updateData: any = {
            statut: data.statut,
            type: data.type,
            montantTotal: data.montantTotal,
            montantPaye: data.montantPaye,
            dateLivraisonEstimee: data.dateLivraisonEstimee,
            content: content,
        };
        // Add optional fields if present
        if ((data as any).clientId) updateData.clientId = (data as any).clientId;

        const result = await this.prisma.fiche.update({
            where: { id },
            data: updateData,
        });

        // AUTOMATIC INVOICE UPDATE REMOVED (prevent data loss)
        /*
        try {
            const draftInvoice = await this.prisma.facture.findFirst({
                where: { ficheId: id, statut: 'BROUILLON' }
            });
        
            if (draftInvoice && draftInvoice.numero.startsWith('BRO-')) {
                console.log('🔄 Updating Draft Invoice for Fiche:', draftInvoice.id);
        
                // Re-calculate lines based on new content logic (simplified mirror of Frontend or explicit map)
                // For backend simplicity, we might just update the MAIN summary line, OR we need the frontend to send the lines.
                // IF the frontend doesn't send "lines", we can't perfectly replicate the complex frontend logic here without duplicating it.
                // HOWEVER, the user issue is "Generic Description". 
                // Let's try to construct a BETTER description at least, or check if we can get lines from data?
                // The `data` passed here is just Fiche structure, not Invoice lines. 
        
                // Better approach: Update the invoice TOTALS and a Summary Description.
                // But the user wants "Detail". 
                // Creating detailed lines in backend requires duplicating the `getInvoiceLines` logic from frontend.
                // A quick win: Update the generic line with more info if possible, OR
                // Rely on the Frontend to explicitely update the Invoice when saving the Fiche (which was the original plan with `generateInvoiceLines` syncing to `FactureComponent`).
        
                // WAITING: The user said "Modifier ne prend pas en charge". This suggests the Frontend sync failed.
                // If I update it here, I fix the "Server side" draft.
        
                let newDescription = `Fiche ${result.type} du ${new Date(result.dateCreation).toLocaleDateString()}`;
                if (looseData.monture?.marque) newDescription += ` - ${looseData.monture.marque}`;
                if (looseData.monture?.reference) newDescription += ` (${looseData.monture.reference})`;
        
                await this.prisma.facture.update({
                    where: { id: draftInvoice.id },
                    data: {
                        totalHT: result.montantTotal,
                        totalTTC: result.montantTotal,
                        resteAPayer: result.montantTotal,
                        lignes: [
                            {
                                description: newDescription,
                                qte: 1,
                                prixUnitaireTTC: result.montantTotal,
                                remise: 0,
                                totalTTC: result.montantTotal
                            }
                        ]
                    }
                });
            }
            } */

        return this.unpackContent(result);
    }

    async remove(id: string) {
        const fiche = await this.prisma.fiche.findUnique({ where: { id } });
        if (!fiche) throw new Error('Fiche introuvable');

        // Prevent deletion if finalized
        if (['FACTURE', 'LIVRE', 'COMMANDE'].includes(fiche.statut)) {
            throw new Error('Action refusée: Impossible de supprimer une fiche validée (Facturée/Livrée/Commandée).');
        }

        return this.prisma.fiche.delete({
            where: { id },
        });
    }
    private unpackContent(fiche: any) {
        if (!fiche) return fiche;
        const content = fiche.content as any || {};
        // Merge content properties to top level
        return {
            ...fiche,
            ...content,
            content: undefined // Optional: hide raw content, or keep it
        };
    }
}
