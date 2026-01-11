import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { normalizeToUTCNoon } from '../../shared/utils/date-utils';

@Injectable()
export class ExpensesService {
    constructor(private prisma: PrismaService) { }

    async create(createExpenseDto: CreateExpenseDto) {
        const { reference, dateEcheance, fournisseurId, banque, ...data } = createExpenseDto;

        return this.prisma.$transaction(async (tx) => {
            let finalEcheanceId = createExpenseDto.echeanceId;

            if (!finalEcheanceId && (data.modePaiement === 'CHEQUE' || data.modePaiement === 'LCN') && dateEcheance) {
                const echeance = await tx.echeancePaiement.create({
                    data: {
                        type: data.modePaiement,
                        reference: reference,
                        dateEcheance: normalizeToUTCNoon(dateEcheance) as Date,
                        montant: data.montant,
                        statut: 'EN_ATTENTE',
                        banque: banque,
                    }
                });
                finalEcheanceId = echeance.id;
            }

            // If we are paying an existing echeance or creating an immediate expense for a BL
            const factureFournisseurId = (createExpenseDto as any).factureFournisseurId;

            // NEW: If no echeanceId but linked to a BL, try to find a pending echeance or create one
            if (!finalEcheanceId && factureFournisseurId && data.statut === 'VALIDEE') {
                const pending = await tx.echeancePaiement.findFirst({
                    where: {
                        factureFournisseurId: factureFournisseurId,
                        statut: 'EN_ATTENTE'
                    }
                });

                if (pending) {
                    finalEcheanceId = pending.id;
                } else {
                    // Create one linked to this payment
                    const newEch = await tx.echeancePaiement.create({
                        data: {
                            type: data.modePaiement,
                            reference: reference || 'Paiement',
                            dateEcheance: new Date(),
                            montant: data.montant,
                            statut: 'ENCAISSE',
                            banque: banque,
                            factureFournisseurId: factureFournisseurId,
                            dateEncaissement: new Date()
                        }
                    });
                    finalEcheanceId = newEch.id;
                }
            }

            if (finalEcheanceId && data.statut === 'VALIDEE') {
                await tx.echeancePaiement.update({
                    where: { id: finalEcheanceId },
                    data: {
                        statut: 'ENCAISSE',
                        dateEncaissement: new Date(),
                        // Ensure amount matches if it was a pending one being fulfilled
                        montant: data.montant
                    }
                });
            }

            // Sync FactureFournisseur status if linked
            if (factureFournisseurId) {
                // Fetch AGAIN after possible echeance updates
                const facture = await tx.factureFournisseur.findUnique({
                    where: { id: factureFournisseurId },
                    include: { echeances: true }
                });

                if (facture) {
                    const activeEcheances = facture.echeances.filter(e => e.statut !== 'ANNULE');
                    const totalPaidRaw = activeEcheances
                        .filter(e => e.statut === 'ENCAISSE')
                        .reduce((sum, e) => sum + e.montant, 0);

                    const totalPaid = Math.round(totalPaidRaw * 100) / 100;
                    const roundedTotalTTC = Math.round(facture.montantTTC * 100) / 100;

                    let newStatus = 'EN_ATTENTE';
                    if (totalPaid >= roundedTotalTTC && roundedTotalTTC > 0) {
                        newStatus = 'PAYEE';
                    } else if (totalPaid > 0) {
                        newStatus = 'PARTIELLE';
                    } else {
                        const hasScheduled = activeEcheances.some(e => e.type !== 'ESPECES' && e.statut === 'EN_ATTENTE');
                        newStatus = hasScheduled ? 'PARTIELLE' : 'EN_ATTENTE';
                    }

                    await tx.factureFournisseur.update({
                        where: { id: factureFournisseurId },
                        data: { statut: newStatus }
                    });
                }
            }

            // Create the expense
            const expense = await tx.depense.create({
                data: {
                    ...data,
                    reference,
                    dateEcheance: normalizeToUTCNoon(dateEcheance),
                    date: normalizeToUTCNoon(data.date) as Date,
                    echeanceId: finalEcheanceId,
                    fournisseurId: fournisseurId || null,
                    // If linked to echeance, we don't strictly need the direct link which is @unique
                    factureFournisseurId: finalEcheanceId ? null : (factureFournisseurId || null)
                },
            });

            // Handle Cash Register Operation (For all payment modes as requested)
            let targetCaisseTypes: string[] = [];
            if (data.modePaiement === 'ESPECES') {
                targetCaisseTypes = ['DEPENSES', 'PRINCIPALE', 'SECONDAIRE']; // Prefer Depenses
            } else if (data.modePaiement === 'VIREMENT' || data.modePaiement === 'CHEQUE') {
                targetCaisseTypes = ['PRINCIPALE']; // Strictly Main for Bank Ops
            }

            if (targetCaisseTypes.length > 0) {
                // Find the appropriate cash register
                const expenseCaisse = await tx.caisse.findFirst({
                    where: {
                        centreId: data.centreId,
                        type: { in: targetCaisseTypes },
                        statut: 'ACTIVE'
                    },
                    orderBy: { type: 'asc' } // DEPENSES < PRINCIPALE < SECONDAIRE (Alphabetical usually, but effectively prioritizes Depenses if present)
                });

                // For Check/Transfer, we might be lenient if no caisse found, but user asked for it.
                // For Cash, it's critical.

                if (expenseCaisse) {
                    // Find the open session
                    const openSession = await tx.journeeCaisse.findFirst({
                        where: {
                            caisseId: expenseCaisse.id,
                            statut: 'OUVERTE'
                        }
                    });

                    if (openSession) {
                        // Check funds ONLY for Cash
                        let sufficientFunds = true;
                        if (data.modePaiement === 'ESPECES') {
                            const availableCash = openSession.fondInitial + openSession.totalInterne - openSession.totalDepenses;
                            if (availableCash < data.montant) sufficientFunds = false;
                        }

                        if (!sufficientFunds) {
                            // Insufficient funds (Cash only) - create funding request
                            await tx.demandeAlimentation.create({
                                data: {
                                    montant: data.montant,
                                    depenseId: expense.id,
                                    journeeCaisseId: openSession.id,
                                    statut: 'EN_ATTENTE'
                                }
                            });

                            await tx.depense.update({
                                where: { id: expense.id },
                                data: { statut: 'EN_ATTENTE_ALIMENTATION' }
                            });
                        } else {
                            // Sufficient funds or Non-Cash - create operation
                            // For Non-Cash, this won't affect Solde Reel in JourneeCaisseService (verified)
                            await tx.operationCaisse.create({
                                data: {
                                    type: 'DECAISSEMENT',
                                    typeOperation: 'INTERNE', // Or COMPTABLE? Expenses usually INTERNE or COMPTABLE. Let's stick to INTERNE for now or match previous.
                                    // Actually, ExpensesService line 171 used 'INTERNE'.
                                    montant: data.montant,
                                    moyenPaiement: data.modePaiement,
                                    motif: `Dépense: ${data.categorie}`,
                                    reference: expense.id,
                                    utilisateur: data.creePar || 'Système',
                                    journeeCaisseId: openSession.id
                                }
                            });

                            // Update session totals
                            await tx.journeeCaisse.update({
                                where: { id: openSession.id },
                                data: {
                                    totalDepenses: { increment: data.montant }
                                }
                            });
                        }
                    } else if (data.modePaiement === 'ESPECES') {
                        throw new BadRequestException('La caisse doit être ouverte pour enregistrer une dépense en espèces.');
                    }
                } else if (data.modePaiement === 'ESPECES') {
                    throw new BadRequestException('Aucune caisse active trouvée pour ce centre.');
                }
            }

            return expense;
        });
    }

    async findAll(centreId?: string, startDate?: string, endDate?: string) {
        const whereClause: any = {};

        if (centreId) {
            whereClause.centreId = centreId;
        }

        if (startDate && endDate) {
            whereClause.date = {
                gte: new Date(startDate),
                lte: new Date(endDate)
            };
        }

        return this.prisma.depense.findMany({
            where: whereClause,
            include: {
                centre: { select: { nom: true } },
                factureFournisseur: { select: { numeroFacture: true, fournisseur: { select: { nom: true } } } }
            },
            orderBy: { date: 'desc' },
        });
    }

    async findOne(id: string) {
        return this.prisma.depense.findUnique({
            where: { id },
            include: {
                factureFournisseur: true,
                centre: true
            }
        });
    }

    async update(id: string, updateExpenseDto: any) {
        return this.prisma.depense.update({
            where: { id },
            data: updateExpenseDto,
        });
    }

    async remove(id: string) {
        return this.prisma.depense.delete({
            where: { id },
        });
    }
}
