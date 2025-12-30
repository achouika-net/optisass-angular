import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateExpenseDto } from './dto/create-expense.dto';

@Injectable()
export class ExpensesService {
    constructor(private prisma: PrismaService) { }

    async create(createExpenseDto: CreateExpenseDto) {
        const { reference, dateEcheance, fournisseurId, banque, ...data } = createExpenseDto;

        return this.prisma.$transaction(async (tx) => {
            let echeanceId: string | undefined = undefined;

            if ((data.modePaiement === 'CHEQUE' || data.modePaiement === 'LCN') && dateEcheance) {
                const echeance = await tx.echeancePaiement.create({
                    data: {
                        type: data.modePaiement,
                        reference: reference,
                        dateEcheance: new Date(dateEcheance),
                        montant: data.montant,
                        statut: 'EN_ATTENTE',
                        banque: banque,
                    }
                });
                echeanceId = echeance.id;
            }

            // Create the expense
            const expense = await tx.depense.create({
                data: {
                    ...data,
                    reference,
                    dateEcheance: dateEcheance ? new Date(dateEcheance) : null,
                    echeanceId: echeanceId,
                    fournisseurId: fournisseurId || null
                },
            });

            // If payment is in cash (ESPECES), handle expense register deduction
            if (data.modePaiement === 'ESPECES') {
                // Find the expense register (Caisse Dépenses) for this center
                const expenseCaisse = await tx.caisse.findFirst({
                    where: {
                        centreId: data.centreId,
                        type: 'DEPENSES',
                        statut: 'ACTIVE'
                    }
                });

                if (!expenseCaisse) {
                    throw new Error('Aucune caisse dépenses active trouvée pour ce centre');
                }

                // Find the open session for this expense register
                const openSession = await tx.journeeCaisse.findFirst({
                    where: {
                        caisseId: expenseCaisse.id,
                        statut: 'OUVERTE'
                    }
                });

                if (!openSession) {
                    throw new Error('La caisse dépenses doit être ouverte pour enregistrer une dépense en espèces');
                }

                // Calculate available cash in expense register
                const availableCash = openSession.fondInitial + openSession.totalInterne - openSession.totalDepenses;

                if (availableCash < data.montant) {
                    // Insufficient funds - create funding request
                    await tx.demandeAlimentation.create({
                        data: {
                            montant: data.montant,
                            depenseId: expense.id,
                            journeeCaisseId: openSession.id,
                            statut: 'EN_ATTENTE'
                        }
                    });

                    // Update expense status to indicate it's waiting for funding
                    await tx.depense.update({
                        where: { id: expense.id },
                        data: { statut: 'EN_ATTENTE_ALIMENTATION' }
                    });
                } else {
                    // Sufficient funds - create automatic deduction operation
                    await tx.operationCaisse.create({
                        data: {
                            type: 'DECAISSEMENT',
                            typeOperation: 'COMPTABLE',
                            montant: data.montant,
                            moyenPaiement: 'ESPECES',
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
