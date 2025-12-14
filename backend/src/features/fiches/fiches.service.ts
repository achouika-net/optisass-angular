import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { FacturesService } from '../factures/factures.service';

@Injectable()
export class FichesService {
    constructor(
        private prisma: PrismaService,
        private facturesService: FacturesService
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

            // 1. Fetch the client to check status
            console.log('🔍 Verifying client existence for ID:', clientId);
            const client = await this.prisma.client.findUnique({
                where: { id: clientId as string }
            });

            if (!client) {
                console.error('❌ Client not found for ID:', clientId);
                throw new BadRequestException('Client not found');
            }

            // 2. If client is INACTIF, validate required fields
            if (client.statut === 'INACTIF') {
                console.log('⚠️ Client is INACTIF, validating required fields...');
                this.validateRequiredFields(client);
            }

            // 3. Create the fiche with explicit data mapping
            // Using UncheckedCreateInput to allow scalar clientId
            const createData: Prisma.FicheUncheckedCreateInput = {
                clientId: clientId as string,
                statut: data.statut,
                type: data.type,
                montantTotal: data.montantTotal,
                montantPaye: data.montantPaye,
                dateLivraisonEstimee: data.dateLivraisonEstimee,
                content: data.content as any, // Ensure JSON compatibility
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
                    await this.facturesService.create({
                        clientId: clientId as string,
                        numero: 'TEMP', // Will be overwritten by service
                        type: 'FACTURE',
                        statut: 'BROUILLON', // Will trigger BRO- prefix logic
                        ficheId: result.id,
                        totalHT: data.montantTotal, // Assuming TTC for now, or simple flat tax
                        totalTTC: data.montantTotal,
                        totalTVA: 0,
                        resteAPayer: data.montantTotal,
                        lignes: [
                            {
                                description: `Fiche ${result.type} du ${new Date().toLocaleDateString()}`,
                                qte: 1,
                                prixUnitaireTTC: data.montantTotal,
                                remise: 0,
                                totalTTC: data.montantTotal
                            }
                        ],
                        notes: 'Facture générée automatiquement depuis la fiche technique.'
                    });
                    console.log('✅ Draft Invoice created successfully');
                } else {
                    console.log('ℹ️ Invoice already exists for this Fiche, skipping creation.');
                }
            } catch (invError) {
                console.error('⚠️ Failed to create draft invoice automatically:', invError);
                // We don't block the response, just log the error
            }

            return result;
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
        return this.prisma.fiche.findMany({
            where: { clientId },
            orderBy: { dateCreation: 'desc' },
        });
    }

    async findOne(id: string) {
        return this.prisma.fiche.findUnique({
            where: { id },
        });
    }

    async update(id: string, data: Prisma.FicheUpdateInput) {
        return this.prisma.fiche.update({
            where: { id },
            data,
        });
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
}
