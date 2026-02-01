import {
    Injectable,
    NotFoundException,
    ForbiddenException,
    BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateOperationCaisseDto, TypeOperation } from './dto/create-operation-caisse.dto';

@Injectable()
export class OperationCaisseService {
    constructor(private prisma: PrismaService) { }

    async create(
        createOperationDto: CreateOperationCaisseDto,
        userRole?: string,
        userId?: string
    ) {
        // Check if journée exists and is open
        const journee = await this.prisma.journeeCaisse.findUnique({
            where: { id: createOperationDto.journeeCaisseId },
        });

        if (!journee) {
            throw new NotFoundException('Journée de caisse introuvable');
        }

        if (journee.statut === 'FERMEE') {
            throw new ForbiddenException(
                'Impossible d\'ajouter une opération sur une journée fermée',
            );
        }

        // Check authorization for INTERNE operations
        if (
            createOperationDto.typeOperation === TypeOperation.INTERNE &&
            userRole &&
            !['RESPONSABLE', 'DIRECTION', 'ADMIN'].includes(userRole)
        ) {
            throw new ForbiddenException(
                'Vous n\'avez pas l\'autorisation de créer des opérations internes',
            );
        }

        // Validate motif for DECAISSEMENT
        if (
            createOperationDto.type === 'DECAISSEMENT' &&
            !createOperationDto.motif
        ) {
            throw new BadRequestException(
                'Le motif est obligatoire pour les décaissements',
            );
        }

        // Get user name if userId exists
        let userName = createOperationDto.utilisateur || 'System';
        if (userId) {
            const user = await this.prisma.user.findUnique({
                where: { id: userId },
                select: { nom: true, prenom: true }
            });
            if (user) {
                userName = `${user.prenom} ${user.nom}`;
            }
        }

        // Create the operation within a transaction to maintain totals
        return await this.prisma.$transaction(async (tx) => {
            const operation = await tx.operationCaisse.create({
                data: {
                    ...createOperationDto,
                    userId: userId || null,
                    utilisateur: userName
                },
                include: {
                    user: {
                        select: {
                            nom: true,
                            prenom: true
                        }
                    },
                    journeeCaisse: {
                        include: {
                            caisse: true,
                            centre: true,
                        },
                    },
                    facture: {
                        select: {
                            numero: true,
                            client: {
                                select: {
                                    nom: true,
                                    prenom: true,
                                },
                            },
                        },
                    },
                },
            });

            // Update JourneeCaisse totals
            if (operation.type === 'ENCAISSEMENT') {
                if (operation.typeOperation === TypeOperation.COMPTABLE) {
                    await tx.journeeCaisse.update({
                        where: { id: operation.journeeCaisseId },
                        data: {
                            totalComptable: { increment: operation.montant },
                            totalVentesEspeces: operation.moyenPaiement === 'ESPECES' ? { increment: operation.montant } : undefined,
                            totalVentesCarte: operation.moyenPaiement === 'CARTE' ? { increment: operation.montant } : undefined,
                            totalVentesCheque: operation.moyenPaiement === 'CHEQUE' ? { increment: operation.montant } : undefined,
                        }
                    });
                } else if (operation.typeOperation === TypeOperation.INTERNE) {
                    await tx.journeeCaisse.update({
                        where: { id: operation.journeeCaisseId },
                        data: { totalInterne: { increment: operation.montant } }
                    });
                }
            } else if (operation.type === 'DECAISSEMENT') {
                if (operation.typeOperation === TypeOperation.COMPTABLE) {
                    // Refund/Return: Decrement sales
                    await tx.journeeCaisse.update({
                        where: { id: operation.journeeCaisseId },
                        data: {
                            totalComptable: { decrement: operation.montant },
                            totalVentesEspeces: operation.moyenPaiement === 'ESPECES' ? { decrement: operation.montant } : undefined,
                            totalVentesCarte: operation.moyenPaiement === 'CARTE' ? { decrement: operation.montant } : undefined,
                            totalVentesCheque: operation.moyenPaiement === 'CHEQUE' ? { decrement: operation.montant } : undefined,
                        }
                    });
                } else {
                    // General Expense or Internal Outflow: Increment expenses
                    await tx.journeeCaisse.update({
                        where: { id: operation.journeeCaisseId },
                        data: {
                            totalDepenses: { increment: operation.montant },
                            totalTransfertsDepenses: operation.motif === 'ALIMENTATION_CAISSE_DEPENSES' ? { increment: operation.montant } : undefined,
                        }
                    });
                }
            }

            return operation;
        });
    }

    async findByJournee(journeeId: string, startDate?: string, endDate?: string) {
        console.log(`[Caisse-Operation] findByJournee: ID=${journeeId}, start=${startDate}, end=${endDate}`);

        const conditions: any[] = [
            { journeeCaisseId: journeeId }
        ];

        let hasFilter = false;
        const dateFilter: any = {};

        if (startDate && startDate !== 'undefined' && startDate !== 'null') {
            const start = new Date(startDate);
            if (!isNaN(start.getTime())) {
                dateFilter.gte = start;
                hasFilter = true;
            }
        }

        if (endDate && endDate !== 'undefined' && endDate !== 'null') {
            const end = new Date(endDate);
            if (!isNaN(end.getTime())) {
                dateFilter.lte = end;
                hasFilter = true;
            }
        }

        if (hasFilter) {
            conditions.push({ createdAt: dateFilter });
        }

        const where = { AND: conditions };
        console.log('[Caisse-Operation] FINAL PRISMA WHERE:', JSON.stringify(where));

        const result = await this.prisma.operationCaisse.findMany({
            where,
            include: {
                user: {
                    select: {
                        nom: true,
                        prenom: true,
                    },
                },
                facture: {
                    select: {
                        numero: true,
                        client: {
                            select: {
                                nom: true,
                                prenom: true,
                            },
                        },
                    },
                },
            },
            orderBy: {
                createdAt: 'desc',
            },
            take: hasFilter ? undefined : 200,
        });

        console.log(`[Caisse-Operation] Result size: ${result.length}`);
        return result;
    }

    async remove(id: string, userRole?: string) {
        // Get the operation
        const operation = await this.prisma.operationCaisse.findUnique({
            where: { id },
            include: {
                journeeCaisse: true,
            },
        });

        if (!operation) {
            throw new NotFoundException('Opération introuvable');
        }

        // Check if journée is closed
        if (operation.journeeCaisse.statut === 'FERMEE') {
            throw new ForbiddenException(
                'Impossible de supprimer une opération d\'une journée fermée',
            );
        }

        // Check authorization - only RESPONSABLE, DIRECTION, ADMIN can delete
        if (
            userRole &&
            !['RESPONSABLE', 'DIRECTION', 'ADMIN'].includes(userRole)
        ) {
            throw new ForbiddenException(
                'Vous n\'avez pas l\'autorisation de supprimer des opérations',
            );
        }

        return await this.prisma.$transaction(async (tx) => {
            const deletedOp = await tx.operationCaisse.delete({
                where: { id },
            });

            // Update JourneeCaisse totals (decrement)
            if (deletedOp.type === 'ENCAISSEMENT') {
                if (deletedOp.typeOperation === 'COMPTABLE') {
                    await tx.journeeCaisse.update({
                        where: { id: deletedOp.journeeCaisseId },
                        data: {
                            totalComptable: { decrement: deletedOp.montant },
                            totalVentesEspeces: deletedOp.moyenPaiement === 'ESPECES' ? { decrement: deletedOp.montant } : undefined,
                            totalVentesCarte: deletedOp.moyenPaiement === 'CARTE' ? { decrement: deletedOp.montant } : undefined,
                            totalVentesCheque: deletedOp.moyenPaiement === 'CHEQUE' ? { decrement: deletedOp.montant } : undefined,
                        }
                    });
                } else if (deletedOp.typeOperation === 'INTERNE') {
                    await tx.journeeCaisse.update({
                        where: { id: deletedOp.journeeCaisseId },
                        data: { totalInterne: { decrement: deletedOp.montant } }
                    });
                }
            } else if (deletedOp.type === 'DECAISSEMENT') {
                if (deletedOp.typeOperation === 'COMPTABLE') {
                    // Undo refund: Increment sales back
                    await tx.journeeCaisse.update({
                        where: { id: deletedOp.journeeCaisseId },
                        data: {
                            totalComptable: { increment: deletedOp.montant },
                            totalVentesEspeces: deletedOp.moyenPaiement === 'ESPECES' ? { increment: deletedOp.montant } : undefined,
                            totalVentesCarte: deletedOp.moyenPaiement === 'CARTE' ? { increment: deletedOp.montant } : undefined,
                            totalVentesCheque: deletedOp.moyenPaiement === 'CHEQUE' ? { increment: deletedOp.montant } : undefined,
                        }
                    });
                } else {
                    await tx.journeeCaisse.update({
                        where: { id: deletedOp.journeeCaisseId },
                        data: {
                            totalDepenses: { decrement: deletedOp.montant },
                            totalTransfertsDepenses: deletedOp.motif === 'ALIMENTATION_CAISSE_DEPENSES' ? { decrement: deletedOp.montant } : undefined,
                        }
                    });
                }
            }

            return deletedOp;
        });
    }

    async getStatsByJournee(journeeId: string) {
        const operations = await this.findByJournee(journeeId);

        const stats = {
            totalComptable: 0,
            totalInterne: 0,
            totalDepenses: 0,
            countComptable: 0,
            countInterne: 0,
            countDepenses: 0,
            byMoyenPaiement: {} as Record<string, number>,
        };

        operations.forEach((op) => {
            if (op.type === 'ENCAISSEMENT') {
                if (op.typeOperation === 'COMPTABLE') {
                    stats.totalComptable += op.montant;
                    stats.countComptable++;
                } else {
                    stats.totalInterne += op.montant;
                    stats.countInterne++;
                }
            } else {
                stats.totalDepenses += op.montant;
                stats.countDepenses++;
            }

            // Count by payment method
            if (!stats.byMoyenPaiement[op.moyenPaiement]) {
                stats.byMoyenPaiement[op.moyenPaiement] = 0;
            }
            stats.byMoyenPaiement[op.moyenPaiement] += op.montant;
        });

        return stats;
    }

    async transfer(dto: {
        amount: number;
        fromJourneeId: string;
        toJourneeId: string;
        utilisateur: string;
        userId?: string;
    }) {
        const { amount, fromJourneeId, toJourneeId, utilisateur, userId } = dto;

        // Get user name if userId exists
        let userName = utilisateur || 'Responsable';
        if (userId) {
            const user = await this.prisma.user.findUnique({
                where: { id: userId },
                select: { nom: true, prenom: true }
            });
            if (user) {
                userName = `${user.prenom} ${user.nom}`;
            }
        }

        return await this.prisma.$transaction(async (tx) => {
            // 1. Source Operation (Decaissement from Main)
            const sourceOp = await tx.operationCaisse.create({
                data: {
                    type: 'DECAISSEMENT',
                    typeOperation: 'INTERNE',
                    montant: amount,
                    moyenPaiement: 'ESPECES',
                    motif: 'ALIMENTATION_CAISSE_DEPENSES',
                    utilisateur: userName,
                    userId: userId || null,
                    journeeCaisseId: fromJourneeId,
                },
            });

            // 2. Destination Operation (Encaissement to Petty Cash)
            const destOp = await tx.operationCaisse.create({
                data: {
                    type: 'ENCAISSEMENT',
                    typeOperation: 'INTERNE',
                    montant: amount,
                    moyenPaiement: 'ESPECES',
                    motif: 'ALIMENTATION_DEPUIS_CAISSE_PRINCIPALE',
                    utilisateur: userName,
                    userId: userId || null,
                    journeeCaisseId: toJourneeId,
                },
            });

            // Update source total (Interne)
            await tx.journeeCaisse.update({
                where: { id: fromJourneeId },
                data: {
                    totalDepenses: { increment: amount },
                    totalTransfertsDepenses: { increment: amount }
                }
            });

            // Update destination total (Interne)
            await tx.journeeCaisse.update({
                where: { id: toJourneeId },
                data: {
                    totalInterne: { increment: amount }
                }
            });

            return { sourceOp, destOp };
        });
    }
}
