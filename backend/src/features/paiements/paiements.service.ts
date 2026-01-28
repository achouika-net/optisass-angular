import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePaiementDto } from './dto/create-paiement.dto';
import { UpdatePaiementDto } from './dto/update-paiement.dto';
import { StockAvailabilityService } from '../factures/stock-availability.service';

import { CommissionService } from '../personnel/commission.service';

@Injectable()
export class PaiementsService {
    constructor(
        private prisma: PrismaService,
        private stockAvailabilityService: StockAvailabilityService,
        private commissionService: CommissionService
    ) { }

    async create(createPaiementDto: CreatePaiementDto, userId?: string) {
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

        // 2.5 STOCK GUARD: If DEVIS, verify stock before allowing payment (which triggers BC transition)
        if (facture.type === 'DEVIS') {
            const stockCheck = await this.stockAvailabilityService.checkAvailability(factureId);
            if (stockCheck.hasConflicts) {
                console.error(`❌ [PAIEMENT GUARD] Bloqué car stock insuffisant pour le devis ${facture.numero}`);
                throw new ConflictException({
                    message: 'Impossible d\'ajouter un paiement : certains produits sont en rupture de stock. Veuillez résoudre les conflits avant de transformer ce devis en bon de commande.',
                    conflicts: stockCheck.conflicts
                });
            }
        }

        // 3. Déterminer le statut par défaut si non fourni
        let finalStatut = createPaiementDto.statut;
        if (montant < 0) {
            finalStatut = 'DECAISSEMENT';
            createPaiementDto.mode = 'ESPECES'; // Force Cash for refunds
        } else if (!finalStatut) {
            finalStatut = (createPaiementDto.mode === 'ESPECES' || createPaiementDto.mode === 'CARTE')
                ? 'ENCAISSE'
                : 'EN_ATTENTE';
        }

        const paiement = await this.prisma.paiement.create({
            data: {
                ...createPaiementDto,
                statut: finalStatut,
                userId: userId || null
            }
        });

        // 4. AUTOMATED CASH RECORDING (INTEGRATION CAISSE)
        if (createPaiementDto.mode === 'ESPECES' || createPaiementDto.mode === 'CARTE' || createPaiementDto.mode === 'CHEQUE') {
            try {
                await this.prisma.$transaction(async (tx) => {
                    await this.handleCaisseIntegration(tx, paiement, facture, userId);
                });
            } catch (caisseError) {
                console.error('Failed to link payment to Caisse', caisseError);
                // We don't block the payment if caisse integration fails, but we log it
            }
        }

        // 5. Mettre à jour le reste à payer et le statut de la facture
        const nouveauReste = facture.resteAPayer - montant;
        const nouveauStatut = nouveauReste <= 0 ? (facture.totalTTC > 0 ? 'PAYEE' : 'VALIDE') : 'PARTIEL';

        const updateData: any = {
            resteAPayer: nouveauReste,
            statut: nouveauStatut
        };

        // [FIX] Standardize transition DEVIS -> BON_COMM
        if (facture.type === 'DEVIS') {
            console.log(`📌 [TRANSITION] Devis ${facture.numero} receiving payment. Upgrading to BON_COMM.`);
            updateData.type = 'BON_COMM';
            updateData.numero = await this.generateNextNumber('BON_COMM');

            // For BC, we use VENTE_EN_INSTANCE as the base status if not fully paid
            if (nouveauReste > 0) {
                updateData.statut = 'PARTIEL'; // Or VENTE_EN_INSTANCE? Backend mapping usually uses PARTIEL for paid.
                // Actually, let's stick to status derived above but ensure type is BON_COMM
            }
        }


        const updatedFacture = await this.prisma.facture.update({
            where: { id: factureId },
            data: updateData
        });

        // [NEW] Commission Trigger
        if (updatedFacture.vendeurId && (updatedFacture.statut === 'VALIDE' || updatedFacture.statut === 'PARTIEL' || updatedFacture.statut === 'PAYEE' || updatedFacture.statut === 'BON_DE_COMMANDE')) {
            try {
                await this.commissionService.calculateForInvoice(updatedFacture.id);
            } catch (e) {
                console.error('⚠️ [COMMISSION] Failed to calculate commissions after payment:', e);
            }
        }

        return paiement;
    }

    private async generateNextNumber(type: 'BON_COMM'): Promise<string> {
        const year = new Date().getFullYear();
        const prefix = 'BC';

        // Find last document starting with this prefix for current year
        const lastDoc = await this.prisma.facture.findFirst({
            where: {
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
                const lastSeq = parseInt(parts[2]);
                if (!isNaN(lastSeq)) sequence = lastSeq + 1;
            }
        }

        return `${prefix}-${year}-${sequence.toString().padStart(3, '0')}`;
    }


    async handleCaisseIntegration(tx: any, paiement: any, facture: any, userId?: string) {
        const isRefund = paiement.montant < 0;
        let caisseType = 'PRINCIPALE';

        if (isRefund) {
            // Refunds MUST go through the expense register
            const expenseJournee = await tx.journeeCaisse.findFirst({
                where: {
                    centreId: facture.centreId!,
                    statut: 'OUVERTE',
                    caisse: { type: 'DEPENSES' }
                }
            });

            if (!expenseJournee) {
                throw new BadRequestException('Le remboursement nécessite une caisse de dépenses ouverte pour ce centre');
            }
            caisseType = 'DEPENSES';
        }

        // Find an OPEN JourneeCaisse for the appropriate caisse type in this centre
        const openJournee = await tx.journeeCaisse.findFirst({
            where: {
                centreId: facture.centreId!,
                statut: 'OUVERTE',
                caisse: {
                    type: caisseType
                }
            },
            include: { caisse: true }
        });

        if (openJournee) {
            const absMontant = Math.abs(paiement.montant);

            // If it's a refund in the expense register, check for funds
            if (caisseType === 'DEPENSES' && isRefund) {
                const availableCash = openJournee.fondInitial + openJournee.totalInterne - openJournee.totalDepenses;

                if (availableCash < absMontant) {
                    // Insufficient funds - create funding request
                    await (tx as any).demandeAlimentation.create({
                        data: {
                            montant: absMontant,
                            paiementId: paiement.id,
                            journeeCaisseId: openJournee.id,
                            statut: 'EN_ATTENTE'
                        }
                    });

                    // Update payment status
                    await tx.paiement.update({
                        where: { id: paiement.id },
                        data: { statut: 'EN_ATTENTE_ALIMENTATION' }
                    });

                    return; // Do not create OperationCaisse yet
                }
            }

            // Create OperationCaisse
            const operation = await tx.operationCaisse.create({
                data: {
                    type: isRefund ? 'DECAISSEMENT' : 'ENCAISSEMENT',
                    typeOperation: 'COMPTABLE',
                    montant: absMontant,
                    moyenPaiement: paiement.mode,
                    reference: paiement.reference || `FAC ${facture.numero}`,
                    motif: isRefund ? 'Régularisation Avoir' : `Paiement: FAC ${facture.numero}`,
                    utilisateur: userId ? `User ${userId} ` : 'Système',
                    userId: userId || null,
                    journeeCaisseId: openJournee.id,
                    factureId: facture.id
                }
            });

            // Link Payment to Operation
            await tx.paiement.update({
                where: { id: paiement.id },
                data: { operationCaisseId: operation.id }
            });

            // Update Journee totals based on register type
            if (caisseType === 'DEPENSES') {
                // For expense register, only update totalDepenses
                await tx.journeeCaisse.update({
                    where: { id: openJournee.id },
                    data: {
                        totalDepenses: { increment: absMontant }
                    }
                });
            } else {
                // For main register, update sales totals
                await tx.journeeCaisse.update({
                    where: { id: openJournee.id },
                    data: {
                        totalComptable: { increment: paiement.montant },
                        totalVentesEspeces: paiement.mode === 'ESPECES' ? { increment: paiement.montant } : undefined,
                        totalVentesCarte: paiement.mode === 'CARTE' ? { increment: paiement.montant } : undefined,
                        totalVentesCheque: paiement.mode === 'CHEQUE' ? { increment: paiement.montant } : undefined,
                    }
                });
            }
        }
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
            orderBy: { date: 'desc' },
            take: 100
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

        if (!paiement) {
            throw new NotFoundException('Paiement non trouvé');
        }

        return await this.prisma.$transaction(async (tx) => {
            if (paiement.operationCaisseId) {
                const op = await tx.operationCaisse.findUnique({
                    where: { id: paiement.operationCaisseId }
                });

                if (op) {
                    await tx.journeeCaisse.update({
                        where: { id: op.journeeCaisseId },
                        data: {
                            totalComptable: { decrement: op.montant },
                            totalVentesEspeces: op.moyenPaiement === 'ESPECES' ? { decrement: op.montant } : undefined,
                            totalVentesCarte: op.moyenPaiement === 'CARTE' ? { decrement: op.montant } : undefined,
                            totalVentesCheque: op.moyenPaiement === 'CHEQUE' ? { decrement: op.montant } : undefined,
                        }
                    });

                    await tx.operationCaisse.delete({
                        where: { id: op.id }
                    });
                }
            }

            const facture = await tx.facture.findUnique({
                where: { id: paiement.factureId },
                include: { paiements: true }
            });

            if (facture) {
                const totalPaiements = facture.paiements
                    .filter(p => p.id !== id)
                    .reduce((sum, p) => sum + (p.montant || 0), 0);

                const nouveauReste = (facture.totalTTC || 0) - totalPaiements;
                const nouveauStatut = Math.abs(nouveauReste - (facture.totalTTC || 0)) < 0.01 ? 'VALIDE' : 'PARTIEL';

                await tx.facture.update({
                    where: { id: paiement.factureId },
                    data: {
                        resteAPayer: nouveauReste,
                        statut: nouveauStatut
                    }
                });
            }

            return tx.paiement.delete({
                where: { id }
            });
        });
    }
}
