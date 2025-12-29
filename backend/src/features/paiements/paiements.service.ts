import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePaiementDto } from './dto/create-paiement.dto';
import { UpdatePaiementDto } from './dto/update-paiement.dto';

@Injectable()
export class PaiementsService {
    constructor(private prisma: PrismaService) { }

    async create(createPaiementDto: CreatePaiementDto) {
        const { factureId, montant } = createPaiementDto;

        // 1. Vérifier que la facture existe et est VALIDE
        const facture = await this.prisma.facture.findUnique({
            where: { id: factureId },
            include: { paiements: true }
        });

        if (!facture) {
            throw new NotFoundException('Facture non trouvée');
        }

        // 2. Vérifier que le montant ne dépasse pas le reste à payer
        if (montant > facture.resteAPayer) {
            throw new BadRequestException(
                `Le montant du paiement (${montant}) dépasse le reste à payer (${facture.resteAPayer})`
            );
        }

        // 3. Déterminer le statut par défaut si non fourni
        let finalStatut = createPaiementDto.statut;
        if (!finalStatut) {
            finalStatut = (createPaiementDto.mode === 'ESPECES' || createPaiementDto.mode === 'CARTE')
                ? 'ENCAISSE'
                : 'EN_ATTENTE';
        }

        const paiement = await this.prisma.paiement.create({
            data: {
                ...createPaiementDto,
                statut: finalStatut
            }
        });

        // 4. Mettre à jour le reste à payer et le statut de la facture
        const nouveauReste = facture.resteAPayer - montant;
        const nouveauStatut = nouveauReste === 0 ? 'PAYEE' : 'PARTIEL';

        await this.prisma.facture.update({
            where: { id: factureId },
            data: {
                resteAPayer: nouveauReste,
                statut: nouveauStatut
            }
        });

        // 5. STOCK DECREMENT LOGIC (SECONDARY WAREHOUSES)
        // Check lines that are NOT yet marked as 'stockProcessed'.

        /* 
           NOTE: We rely on 'lignes' from the fetched 'facture' (Step 1).
           If stock logic needs the absolute latest, we might re-fetch, but 'lignes' usually static here.
        */

        const currentLines = (facture.lignes as any[]) || [];
        let stockUpdated = false;
        const updatedLines: any[] = [];

        /* 
           [FIX] Disabled Stock Decrement on Payment to prevent Double Counting.
           Stock should ONLY be decremented upon Facture/BL Validation, not Payment.
           Previous logic caused double decrement for Secondary warehouses when user Paid then Validated.
        */

        // Return untouched lines as we don't process stock here anymore
        // updatedLines.push(...currentLines); 
        // passing currentLines directly is not enough if we assume we need to return 'paiement'
        // actually the loop was building updatedLines to update the invoice.
        // We can skip the whole update block.

        return paiement;

        return paiement;
    }

    async findAll(factureId?: string) {
        if (factureId) {
            return this.prisma.paiement.findMany({
                where: { factureId },
                include: { facture: true },
                orderBy: { date: 'desc' }
            });
        }

        return this.prisma.paiement.findMany({
            include: { facture: true },
            orderBy: { date: 'desc' }
        });
    }

    async findOne(id: string) {
        const paiement = await this.prisma.paiement.findUnique({
            where: { id },
            include: { facture: true }
        });

        if (!paiement) {
            throw new NotFoundException(`Paiement ${id} non trouvé`);
        }

        return paiement;
    }

    async update(id: string, updatePaiementDto: UpdatePaiementDto) {
        const paiement = await this.findOne(id);

        // Si le montant change, recalculer le reste à payer de la facture
        if (updatePaiementDto.montant && updatePaiementDto.montant !== paiement.montant) {
            const facture = await this.prisma.facture.findUnique({
                where: { id: paiement.factureId },
                include: { paiements: true }
            });

            if (!facture) {
                throw new NotFoundException('Facture non trouvée');
            }

            const totalPaiements = facture.paiements
                .filter(p => p.id !== id)
                .reduce((sum, p) => sum + p.montant, 0) + updatePaiementDto.montant;

            const nouveauReste = facture.totalTTC - totalPaiements;
            const nouveauStatut = nouveauReste === 0 ? 'PAYEE' : nouveauReste < facture.totalTTC ? 'PARTIEL' : 'VALIDE';

            await this.prisma.facture.update({
                where: { id: paiement.factureId },
                data: {
                    resteAPayer: nouveauReste,
                    statut: nouveauStatut
                }
            });
        }

        // Automatically set dateEncaissement if status changes to ENCAISSE
        if (updatePaiementDto.statut === 'ENCAISSE' && paiement.statut !== 'ENCAISSE' && !updatePaiementDto.dateEncaissement) {
            updatePaiementDto.dateEncaissement = new Date().toISOString();
        }

        return this.prisma.paiement.update({
            where: { id },
            data: updatePaiementDto
        });
    }

    async remove(id: string) {
        const paiement = await this.findOne(id);

        // Recalculer le reste à payer de la facture
        const facture = await this.prisma.facture.findUnique({
            where: { id: paiement.factureId },
            include: { paiements: true }
        });

        if (!facture) {
            throw new NotFoundException('Facture non trouvée');
        }

        const totalPaiements = facture.paiements
            .filter(p => p.id !== id)
            .reduce((sum, p) => sum + p.montant, 0);

        const nouveauReste = facture.totalTTC - totalPaiements;
        const nouveauStatut = nouveauReste === facture.totalTTC ? 'VALIDE' : 'PARTIEL';

        await this.prisma.facture.update({
            where: { id: paiement.factureId },
            data: {
                resteAPayer: nouveauReste,
                statut: nouveauStatut
            }
        });

        return this.prisma.paiement.delete({
            where: { id }
        });
    }
}
