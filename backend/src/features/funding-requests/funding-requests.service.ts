import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class FundingRequestsService {
    constructor(private prisma: PrismaService) { }

    async findAll(centreId?: string) {
        return (this.prisma as any).demandeAlimentation.findMany({
            where: {
                ...(centreId ? { journeeCaisse: { centreId } } : {}),
            },
            include: {
                depense: {
                    include: { centre: true }
                },
                paiement: {
                    include: {
                        facture: {
                            include: { centre: true }
                        }
                    }
                },
                journeeCaisse: {
                    include: { caisse: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
    }

    async countPending(centreId?: string): Promise<number> {
        return (this.prisma as any).demandeAlimentation.count({
            where: {
                statut: 'EN_ATTENTE',
                ...(centreId ? { journeeCaisse: { centreId } } : {}),
            }
        });
    }


    async approve(id: string, validatorId: string) {
        return this.prisma.$transaction(async (tx) => {
            // 1. Get the request
            const request = await (tx as any).demandeAlimentation.findUnique({
                where: { id },
                include: {
                    depense: true,
                    paiement: {
                        include: { facture: true }
                    },
                    journeeCaisse: {
                        include: { caisse: true }
                    }
                }
            }) as any;

            if (!request) {
                throw new NotFoundException('Demande d\'alimentation introuvable');
            }

            if (request.statut !== 'EN_ATTENTE') {
                throw new BadRequestException('Cette demande a déjà été traitée');
            }

            // 2. Find the Main Register (PRINCIPALE) for this center
            const mainCaisse = await tx.caisse.findFirst({
                where: {
                    centreId: request.journeeCaisse.centreId,
                    type: 'PRINCIPALE',
                    statut: 'ACTIVE'
                }
            });

            if (!mainCaisse) {
                throw new BadRequestException('Aucune caisse principale active trouvée pour ce centre');
            }

            // 3. Find the Open Session for the Main Register
            const mainSession = await tx.journeeCaisse.findFirst({
                where: {
                    caisseId: mainCaisse.id,
                    statut: 'OUVERTE'
                }
            });

            if (!mainSession) {
                throw new BadRequestException('La caisse principale doit être ouverte pour approuver une alimentation');
            }

            const amount = request.montant;
            const utilisateur = validatorId || 'Système';

            // 4. Create Operations (Mimic Transfer logic but within this transaction)

            // Decaissement from Main
            const motifMain = request.depenseId
                ? `ALIMENTATION_CAISSE_DEPENSES: ${request.depense.categorie}`
                : `ALIMENTATION_REGULARISATION_AVOIR: FAC ${request.paiement.facture.numero}`;

            await tx.operationCaisse.create({
                data: {
                    type: 'DECAISSEMENT',
                    typeOperation: 'INTERNE',
                    montant: amount,
                    moyenPaiement: 'ESPECES',
                    motif: motifMain,
                    utilisateur,
                    journeeCaisseId: mainSession.id,
                },
            });

            // Encaissement to Petty Cash
            await tx.operationCaisse.create({
                data: {
                    type: 'ENCAISSEMENT',
                    typeOperation: 'INTERNE',
                    montant: amount,
                    moyenPaiement: 'ESPECES',
                    motif: 'ALIMENTATION_DEPUIS_CAISSE_PRINCIPALE',
                    utilisateur,
                    journeeCaisseId: request.journeeCaisseId,
                },
            });

            // 5. Update Totals for both sessions
            await tx.journeeCaisse.update({
                where: { id: mainSession.id },
                data: {
                    totalDepenses: { increment: amount },
                    totalTransfertsDepenses: { increment: amount }
                }
            });

            await tx.journeeCaisse.update({
                where: { id: request.journeeCaisseId },
                data: {
                    totalInterne: { increment: amount }
                }
            });

            // 6. NOW EXECUTE THE ORIGINAL EXPENSE/REFUND (Decaissement from Petty Cash)
            const motifPetty = request.depenseId
                ? `Dépense (Alimentée): ${request.depense.categorie}`
                : `Régularisation Avoir`;

            const opDepense = await tx.operationCaisse.create({
                data: {
                    type: 'DECAISSEMENT',
                    typeOperation: 'COMPTABLE',
                    montant: amount,
                    moyenPaiement: 'ESPECES',
                    motif: motifPetty,
                    reference: request.depenseId || request.paiement.facture.numero,
                    utilisateur: (request.depense?.creePar || request.paiement?.createPar || utilisateur),
                    journeeCaisseId: request.journeeCaisseId,
                    factureId: request.paiement?.factureId || request.depense?.factureFournisseurId // Optional
                }
            });

            await tx.journeeCaisse.update({
                where: { id: request.journeeCaisseId },
                data: {
                    totalDepenses: { increment: amount }
                }
            });

            // 7. Final status updates
            if (request.depenseId) {
                await tx.depense.update({
                    where: { id: request.depenseId },
                    data: { statut: 'PAYE' }
                });
            } else if (request.paiementId) {
                await tx.paiement.update({
                    where: { id: request.paiementId },
                    data: {
                        statut: 'DECAISSEMENT',
                        operationCaisseId: opDepense.id
                    }
                });
            }

            return await tx.demandeAlimentation.update({
                where: { id },
                data: {
                    statut: 'VALIDEE',
                    validatedAt: new Date(),
                    validatedBy: validatorId
                }
            });
        });
    }

    async reject(id: string, validatorId: string, remarque?: string) {
        return this.prisma.$transaction(async (tx) => {
            const request = await (tx as any).demandeAlimentation.findUnique({
                where: { id }
            });

            if (!request) {
                throw new NotFoundException('Demande d\'alimentation introuvable');
            }

            if (request.statut !== 'EN_ATTENTE') {
                throw new BadRequestException('Cette demande a déjà été traitée');
            }

            // Update Expense status back to something like 'ANNULE' or 'REJETTE'
            if (request.depenseId) {
                await tx.depense.update({
                    where: { id: request.depenseId },
                    data: { statut: 'REJETTE_ALIMENTATION' }
                });
            } else if ((request as any).paiementId) {
                await tx.paiement.update({
                    where: { id: (request as any).paiementId },
                    data: { statut: 'REJETTE_ALIMENTATION' }
                });
            }

            return await (tx as any).demandeAlimentation.update({
                where: { id },
                data: {
                    statut: 'REJETEE',
                    validatedAt: new Date(),
                    validatedBy: validatorId,
                    remarque
                }
            });
        });
    }
}
