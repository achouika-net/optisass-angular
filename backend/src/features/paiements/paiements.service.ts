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
        const paiement = await this.prisma.paiement.findUnique({
            where: { id },
            include: { operationCaisse: true, facture: true }
        });

        if (!paiement) {
            throw new NotFoundException(`Paiement ${id} non trouvé`);
        }

        // 1. Handle Amount Change vs Facture ResteAPayer
        if (updatePaiementDto.montant !== undefined && updatePaiementDto.montant !== paiement.montant) {
            const facture = await this.prisma.facture.findUnique({
                where: { id: paiement.factureId },
                include: { paiements: true }
            });

            if (!facture) throw new NotFoundException('Facture non trouvée');

            const totalAutresPaiements = facture.paiements
                .filter(p => p.id !== id)
                .reduce((sum, p) => sum + p.montant, 0);

            const nouveauTotal = totalAutresPaiements + updatePaiementDto.montant;
            const nouveauReste = facture.totalTTC - nouveauTotal;

            if (nouveauReste < -0.05) {
                throw new BadRequestException(`Le nouveau montant dépasse le total de la facture (Reste: ${nouveauReste})`);
            }

            await this.prisma.facture.update({
                where: { id: paiement.factureId },
                data: {
                    resteAPayer: Math.max(0, nouveauReste),
                    statut: nouveauReste <= 0.05 ? 'PAYEE' : 'PARTIEL'
                }
            });
        }

        // 2. Synchronization with Caisse Integration
        const opId = paiement.operationCaisseId;
        if (opId) {
            await this.prisma.$transaction(async (tx) => {
                const op = await tx.operationCaisse.findUnique({
                    where: { id: opId },
                    include: { journeeCaisse: true }
                });

                if (op && (op as any).journeeCaisse?.statut === 'OUVERTE') {
                    const journeeCaisse = (op as any).journeeCaisse;
                    const newMode = updatePaiementDto.mode || (paiement.mode as any);
                    const newMontant = updatePaiementDto.montant !== undefined ? Math.abs(updatePaiementDto.montant) : op.montant;

                    // A. Reverse old totals
                    await tx.journeeCaisse.update({
                        where: { id: op.journeeCaisseId },
                        data: {
                            totalComptable: { decrement: paiement.montant },
                            totalVentesEspeces: op.moyenPaiement === 'ESPECES' ? { decrement: op.montant } : undefined,
                            totalVentesCarte: op.moyenPaiement === 'CARTE' ? { decrement: op.montant } : undefined,
                            totalVentesCheque: op.moyenPaiement === 'CHEQUE' ? { decrement: op.montant } : undefined,
                        }
                    });

                    // B. Update Operation
                    await tx.operationCaisse.update({
                        where: { id: op.id },
                        data: {
                            montant: newMontant,
                            moyenPaiement: newMode,
                            reference: updatePaiementDto.reference || op.reference
                        }
                    });

                    // C. Apply new totals
                    await tx.journeeCaisse.update({
                        where: { id: op.journeeCaisseId },
                        data: {
                            totalComptable: { increment: updatePaiementDto.montant !== undefined ? updatePaiementDto.montant : paiement.montant },
                            totalVentesEspeces: newMode === 'ESPECES' ? { increment: newMontant } : undefined,
                            totalVentesCarte: newMode === 'CARTE' ? { increment: newMontant } : undefined,
                            totalVentesCheque: newMode === 'CHEQUE' ? { increment: newMontant } : undefined,
                        }
                    });
                }
            });
        }

        // 3. Handle Status Encaissement
        if (updatePaiementDto.statut === 'ENCAISSE' && paiement.statut !== 'ENCAISSE' && !updatePaiementDto.dateEncaissement) {
            updatePaiementDto.dateEncaissement = new Date().toISOString();
        }

        return this.prisma.paiement.update({
            where: { id },
            data: updatePaiementDto
        });
    }

    async remove(id: string) {
        // ... (existing remove code)
    }

    async adminRepair() {
        const fs = require('fs');
        const logFile = 'repair-debug.log';
        const log = (msg: string) => {
            console.log(msg);
            fs.appendFileSync(logFile, msg + '\n');
        };

        fs.writeFileSync(logFile, `--- Repair Start ${new Date().toISOString()} ---\n`);

        // 1. Identify ALL potential mismatches
        const allPayments = await this.prisma.paiement.findMany({
            where: { mode: { in: ['ESPECES', 'CARTE', 'CHEQUE'] } },
            include: {
                operationCaisse: { include: { journeeCaisse: true } },
                facture: {
                    select: {
                        numero: true,
                        type: true,
                        dateEmission: true,
                        totalTTC: true,
                        resteAPayer: true,
                        statut: true,
                        client: {
                            select: {
                                nom: true,
                                prenom: true,
                                raisonSociale: true
                            }
                        }
                    }
                }
            }
        });

        log(`Found ${allPayments.length} relevant payments.`);

        let fixedCount = 0;
        const details: string[] = [];
        const orphans: any[] = [];

        for (const p of allPayments) {
            const op = (p as any).operationCaisse;
            if (!op) {
                const clientName = (p as any).facture?.client?.raisonSociale ||
                    `${(p as any).facture?.client?.prenom || ''} ${(p as any).facture?.client?.nom || ''}`.trim();
                const orphanInfo = {
                    id: p.id,
                    montant: p.montant,
                    mode: p.mode,
                    date: p.date,
                    reference: p.reference,
                    statut: p.statut,
                    facture: {
                        numero: (p as any).facture?.numero,
                        type: (p as any).facture?.type,
                        client: clientName,
                        totalTTC: (p as any).facture?.totalTTC,
                        resteAPayer: (p as any).facture?.resteAPayer
                    }
                };
                orphans.push(orphanInfo);
                log(`⚠️ ORPHAN: Payment ${p.id} (${p.mode} ${p.montant} DH) - Doc: ${(p as any).facture?.numero} - Client: ${clientName}`);
                continue;
            }

            const needsModeFix = p.mode !== op.moyenPaiement;
            const needsAmountFix = Math.abs(p.montant) !== op.montant;

            if (needsModeFix || needsAmountFix) {
                const info = `Mismatch Payment ${p.id} (Ref: ${p.reference}): Paiement(${p.mode} ${p.montant}) vs Op(${op.moyenPaiement} ${op.montant})`;
                log(`✅ FIXING: ${info}`);
                details.push(info);

                await this.prisma.$transaction(async (tx) => {
                    // A. Reverse old totals
                    await tx.journeeCaisse.update({
                        where: { id: op.journeeCaisseId },
                        data: {
                            totalVentesEspeces: op.moyenPaiement === 'ESPECES' ? { decrement: op.montant } : undefined,
                            totalVentesCarte: op.moyenPaiement === 'CARTE' ? { decrement: op.montant } : undefined,
                            totalVentesCheque: op.moyenPaiement === 'CHEQUE' ? { decrement: op.montant } : undefined,
                        }
                    });

                    // B. Update Operation
                    await tx.operationCaisse.update({
                        where: { id: op.id },
                        data: {
                            moyenPaiement: p.mode,
                            montant: Math.abs(p.montant)
                        }
                    });

                    // C. Apply new totals
                    const absMontant = Math.abs(p.montant);
                    await tx.journeeCaisse.update({
                        where: { id: op.journeeCaisseId },
                        data: {
                            totalVentesEspeces: p.mode === 'ESPECES' ? { increment: absMontant } : undefined,
                            totalVentesCarte: p.mode === 'CARTE' ? { increment: absMontant } : undefined,
                            totalVentesCheque: p.mode === 'CHEQUE' ? { increment: absMontant } : undefined,
                        }
                    });
                });
                fixedCount++;
            }
        }

        const result = {
            message: `Repair Finished. Fixed ${fixedCount} mismatches.`,
            orphanCount: orphans.length,
            orphans,
            details
        };
        log(JSON.stringify(result, null, 2));
        return result;
    }

    async repairOrphanOperations() {
        const orphanPayments = await this.prisma.paiement.findMany({
            where: {
                mode: { in: ['ESPECES', 'CARTE', 'CHEQUE'] },
                operationCaisseId: null
            },
            include: {
                facture: {
                    include: {
                        client: true,
                        fiche: { include: { client: true } }
                    }
                }
            }
        });

        if (orphanPayments.length === 0) {
            return { message: 'No orphan payments found', fixed: 0 };
        }

        // Find the current open caisse session
        const journee = await this.prisma.journeeCaisse.findFirst({
            where: { statut: 'OUVERTE' },
            orderBy: { dateOuverture: 'desc' }
        });

        if (!journee) {
            throw new NotFoundException('No open caisse session found');
        }

        const fixed: any[] = [];

        for (const payment of orphanPayments) {
            try {
                await this.prisma.$transaction(async (tx) => {
                    // Get user info
                    let userName = 'Système';
                    let userId = (payment as any).vendeurId;

                    if (userId) {
                        const user = await tx.user.findUnique({ where: { id: userId } });
                        if (user) {
                            userName = `${user.prenom} ${user.nom}`;
                        }
                    } else {
                        const admin = await tx.user.findFirst();
                        if (admin) {
                            userId = admin.id;
                            userName = `${admin.prenom} ${admin.nom}`;
                        }
                    }

                    // Create the operation
                    const operation = await tx.operationCaisse.create({
                        data: {
                            journeeCaisseId: journee.id,
                            type: 'VENTE',
                            moyenPaiement: payment.mode,
                            montant: Math.abs(payment.montant),
                            reference: (payment as any).facture?.numero || '',
                            motif: `Réparation: Paiement ${payment.mode}`,
                            utilisateur: userName,
                            userId: userId
                        }
                    });

                    // Link payment to operation
                    await tx.paiement.update({
                        where: { id: payment.id },
                        data: { operationCaisseId: operation.id }
                    });

                    // Update journee totals
                    const montant = Math.abs(payment.montant);
                    await tx.journeeCaisse.update({
                        where: { id: journee.id },
                        data: {
                            totalComptable: { increment: montant },
                            totalVentesEspeces: payment.mode === 'ESPECES' ? { increment: montant } : undefined,
                            totalVentesCarte: payment.mode === 'CARTE' ? { increment: montant } : undefined,
                            totalVentesCheque: payment.mode === 'CHEQUE' ? { increment: montant } : undefined
                        }
                    });

                    fixed.push({
                        paymentId: payment.id,
                        montant: payment.montant,
                        mode: payment.mode,
                        document: (payment as any).facture?.numero
                    });
                });
            } catch (error) {
                console.error(`Failed to repair payment ${payment.id}:`, error);
            }
        }

        return {
            message: `Repaired ${fixed.length} orphan payments`,
            fixed
        };
    }

    async deleteOrphanPayments() {
        // Find the 2 specific orphan payments
        const orphanIds = [
            '7849cabc-083c-4186-9429-a4cec25483d3', // CARTE 1000 DH
            '7c316cd6-fa66-49db-9973-9622404e989f'  // CHEQUE 1340 DH
        ];

        const deleted: any[] = [];

        for (const paymentId of orphanIds) {
            try {
                const payment = await this.prisma.paiement.findUnique({
                    where: { id: paymentId },
                    include: {
                        operationCaisse: {
                            include: { journeeCaisse: true }
                        },
                        facture: true
                    }
                });

                if (!payment) {
                    continue;
                }

                await this.prisma.$transaction(async (tx) => {
                    // If there's a linked operation, delete it and update journee totals
                    if (payment.operationCaisseId) {
                        const op = (payment as any).operationCaisse;

                        // Reverse the totals
                        await tx.journeeCaisse.update({
                            where: { id: op.journeeCaisseId },
                            data: {
                                totalComptable: { decrement: op.montant },
                                totalVentesEspeces: op.moyenPaiement === 'ESPECES' ? { decrement: op.montant } : undefined,
                                totalVentesCarte: op.moyenPaiement === 'CARTE' ? { decrement: op.montant } : undefined,
                                totalVentesCheque: op.moyenPaiement === 'CHEQUE' ? { decrement: op.montant } : undefined
                            }
                        });

                        // Delete the operation
                        await tx.operationCaisse.delete({
                            where: { id: payment.operationCaisseId }
                        });
                    }

                    // Update facture totals
                    if (payment.facture) {
                        const facture = payment.facture;
                        const nouveauReste = (facture.resteAPayer || 0) + payment.montant;
                        const nouveauStatut = Math.abs(nouveauReste - (facture.totalTTC || 0)) < 0.01 ? 'VALIDE' : 'PARTIEL';

                        await tx.facture.update({
                            where: { id: payment.factureId },
                            data: {
                                resteAPayer: nouveauReste,
                                statut: nouveauStatut
                            }
                        });
                    }

                    // Delete the payment
                    await tx.paiement.delete({
                        where: { id: paymentId }
                    });

                    deleted.push({
                        paymentId,
                        montant: payment.montant,
                        mode: payment.mode,
                        document: (payment as any).facture?.numero
                    });
                });
            } catch (error) {
                console.error(`Failed to delete payment ${paymentId}:`, error);
            }
        }

        return {
            message: `Deleted ${deleted.length} orphan payments`,
            deleted
        };
    }
}
