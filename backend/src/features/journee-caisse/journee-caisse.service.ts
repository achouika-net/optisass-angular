import {
    Injectable,
    NotFoundException,
    ConflictException,
    BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OuvrirCaisseDto } from './dto/ouvrir-caisse.dto';
import { CloturerCaisseDto } from './dto/cloturer-caisse.dto';

@Injectable()
export class JourneeCaisseService {
    constructor(private prisma: PrismaService) { }

    async ouvrir(ouvrirCaisseDto: OuvrirCaisseDto) {
        // Check if caisse exists
        const caisse = await this.prisma.caisse.findUnique({
            where: { id: ouvrirCaisseDto.caisseId },
        });

        if (!caisse) {
            throw new NotFoundException('Caisse introuvable');
        }

        // Check if there's already an open session for this caisse
        const existingSession = await this.prisma.journeeCaisse.findFirst({
            where: {
                caisseId: ouvrirCaisseDto.caisseId,
                statut: 'OUVERTE',
            },
        });

        if (existingSession) {
            throw new ConflictException(
                'Une journée de caisse est déjà ouverte pour cette caisse',
            );
        }

        // Create new session
        return this.prisma.journeeCaisse.create({
            data: {
                caisseId: ouvrirCaisseDto.caisseId,
                centreId: ouvrirCaisseDto.centreId,
                fondInitial: ouvrirCaisseDto.fondInitial,
                caissier: ouvrirCaisseDto.caissier,
            },
            include: {
                caisse: true,
                centre: true,
            },
        });
    }

    async cloturer(id: string, cloturerCaisseDto: CloturerCaisseDto) {
        // Get the session
        const journee = await this.prisma.journeeCaisse.findUnique({
            where: { id },
            include: {
                operations: true,
            },
        });

        if (!journee) {
            throw new NotFoundException('Journée de caisse introuvable');
        }

        if (journee.statut === 'FERMEE') {
            throw new ConflictException('Cette journée de caisse est déjà fermée');
        }

        // Calculate accurate theoretical balances and counts dynamically
        const stats = {
            grossVentesEspeces: 0,
            grossVentesCarte: 0,
            grossVentesCheque: 0,
            nbVentesCarte: 0,
            nbVentesCheque: 0,
            totalInterneIn: 0,
            totalOutflowsEspeces: 0
        };

        journee.operations.forEach(op => {
            if (op.type === 'ENCAISSEMENT') {
                if (op.typeOperation === 'COMPTABLE' || op.typeOperation === 'INTERNE') {
                    if (op.moyenPaiement === 'ESPECES') {
                        if (op.typeOperation === 'COMPTABLE') stats.grossVentesEspeces += op.montant;
                        else stats.totalInterneIn += op.montant;
                    } else if (op.moyenPaiement === 'CARTE') {
                        stats.grossVentesCarte += op.montant;
                        stats.nbVentesCarte++;
                    } else if (op.moyenPaiement === 'CHEQUE') {
                        stats.grossVentesCheque += op.montant;
                        stats.nbVentesCheque++;
                    }
                }
            } else if (op.type === 'DECAISSEMENT') {
                if (op.moyenPaiement === 'ESPECES') {
                    stats.totalOutflowsEspeces += op.montant;
                }
            }
        });

        const soldeTheoriqueEspeces = (journee.fondInitial || 0) + stats.totalInterneIn + stats.grossVentesEspeces - stats.totalOutflowsEspeces;
        const soldeTheoriqueCarte = stats.grossVentesCarte;
        const soldeTheoriqueCheque = stats.grossVentesCheque;

        // Individual écarts (Value)
        const ecartEspeces = cloturerCaisseDto.soldeReel - soldeTheoriqueEspeces;
        const ecartCarteMontant = cloturerCaisseDto.montantTotalCarte - soldeTheoriqueCarte;
        const ecartChequeMontant = cloturerCaisseDto.montantTotalCheque - soldeTheoriqueCheque;

        // Individual écarts (Count)
        const ecartCarteNombre = cloturerCaisseDto.nbRecuCarte - stats.nbVentesCarte;
        const ecartChequeNombre = cloturerCaisseDto.nbRecuCheque - stats.nbVentesCheque;

        const hasAnyDiscrepancy =
            Math.abs(ecartEspeces) > 0.01 ||
            Math.abs(ecartCarteMontant) > 0.01 ||
            Math.abs(ecartChequeMontant) > 0.01 ||
            ecartCarteNombre !== 0 ||
            ecartChequeNombre !== 0;

        // Validate justification if ANY discrepancy exists
        if (hasAnyDiscrepancy && !cloturerCaisseDto.justificationEcart) {
            throw new BadRequestException(
                'Une justification est requise car un écart a été détecté (montant ou nombre de reçus).',
            );
        }

        // Close the session
        return this.prisma.journeeCaisse.update({
            where: { id },
            data: {
                statut: 'FERMEE',
                dateCloture: new Date(),
                soldeTheorique: soldeTheoriqueEspeces,
                soldeReel: cloturerCaisseDto.soldeReel,
                ecart: ecartEspeces,
                justificationEcart: cloturerCaisseDto.justificationEcart,
                responsableCloture: cloturerCaisseDto.responsableCloture,
                // Audit trails can be expanded here to store detailed ecarts in metadata if needed
            },
            include: {
                caisse: true,
                centre: true,
            },
        });
    }

    async findOne(id: string) {
        const journee = await this.prisma.journeeCaisse.findUnique({
            where: { id },
            include: {
                caisse: true,
                centre: true,
            },
        });

        if (!journee) {
            throw new NotFoundException('Journée de caisse introuvable');
        }

        return journee;
    }

    async findOneWithOperations(id: string) {
        const journee = await this.prisma.journeeCaisse.findUnique({
            where: { id },
            include: {
                caisse: true,
                centre: true,
                operations: {
                    orderBy: {
                        createdAt: 'desc',
                    },
                    include: {
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
                },
            },
        });

        if (!journee) {
            throw new NotFoundException('Journée de caisse introuvable');
        }

        return journee;
    }

    async getActiveByCaisse(caisseId: string) {
        const journee = await this.prisma.journeeCaisse.findFirst({
            where: {
                caisseId,
                statut: 'OUVERTE',
            },
            include: {
                caisse: true,
                centre: true,
                operations: {
                    orderBy: {
                        createdAt: 'desc',
                    },
                },
            },
        });

        if (!journee) {
            throw new NotFoundException('Aucune journée de caisse ouverte pour cette caisse');
        }

        return journee;
    }

    async findByCentre(centreId: string, limit = 50) {
        return this.prisma.journeeCaisse.findMany({
            where: { centreId },
            include: {
                caisse: true,
            },
            orderBy: {
                dateOuverture: 'desc',
            },
            take: limit,
        });
    }

    async getResume(id: string) {
        const journee = await this.prisma.journeeCaisse.findUnique({
            where: { id },
            include: {
                caisse: true,
                centre: true,
                operations: true
            },
        });

        if (!journee) {
            throw new NotFoundException('Journée de caisse introuvable');
        }

        // Aggregate current session directly from operations for 100% accuracy
        const stats = {
            grossVentesEspeces: 0,
            grossVentesCarte: 0,
            grossVentesCheque: 0,
            netVentesEspeces: 0,
            netVentesCarte: 0,
            netVentesCheque: 0,
            nbVentesCarte: 0,
            nbVentesCheque: 0,
            totalInterneIn: 0,
            totalOutflows: 0, // All cash outflows (Expenses + Transfers Out + Refunds)
            chequesEnAttente: 0, // Cheques received but not yet cashed/deposited
        };

        journee.operations.forEach(op => {
            if (op.type === 'ENCAISSEMENT') {
                if (op.typeOperation === 'COMPTABLE') {
                    if (op.moyenPaiement === 'ESPECES') {
                        stats.grossVentesEspeces += op.montant;
                        stats.netVentesEspeces += op.montant;
                    } else if (op.moyenPaiement === 'CARTE') {
                        stats.grossVentesCarte += op.montant;
                        stats.netVentesCarte += op.montant;
                        stats.nbVentesCarte++;
                    } else if (op.moyenPaiement === 'CHEQUE') {
                        stats.grossVentesCheque += op.montant;
                        stats.netVentesCheque += op.montant;
                        stats.nbVentesCheque++;
                        // For cheques, we assume they are "en coffre" if they are purely comptable in the jornada
                    }
                } else if (op.typeOperation === 'INTERNE') {
                    stats.totalInterneIn += op.montant;
                }
            } else if (op.type === 'DECAISSEMENT') {
                if (op.typeOperation === 'COMPTABLE') {
                    // Refund: subtract from net sales
                    if (op.moyenPaiement === 'ESPECES') stats.netVentesEspeces -= op.montant;
                    else if (op.moyenPaiement === 'CARTE') stats.netVentesCarte -= op.montant;
                    else if (op.moyenPaiement === 'CHEQUE') stats.netVentesCheque -= op.montant;

                    if (op.moyenPaiement === 'ESPECES') stats.totalOutflows += op.montant;
                } else {
                    // Expense or Transfer Out
                    if (op.moyenPaiement === 'ESPECES') stats.totalOutflows += op.montant;
                }
            }
        });

        // Global Center Stats (For Cards 4 & 5) - Optimized with aggregation
        const centreStats = await this.prisma.operationCaisse.aggregate({
            where: {
                journeeCaisse: {
                    centreId: journee.centreId,
                    statut: 'OUVERTE'
                },
                typeOperation: 'COMPTABLE',
                type: 'ENCAISSEMENT'
            },
            _sum: {
                montant: true
            }
        });

        const centreVentesEspeces = (await this.prisma.operationCaisse.aggregate({
            where: {
                journeeCaisse: { centreId: journee.centreId, statut: 'OUVERTE' },
                typeOperation: 'COMPTABLE',
                type: 'ENCAISSEMENT',
                moyenPaiement: 'ESPECES'
            },
            _sum: { montant: true }
        }))._sum.montant || 0;

        const centreVentesBancaires = (centreStats._sum.montant || 0) - centreVentesEspeces;

        return {
            journee: {
                id: journee.id,
                dateOuverture: journee.dateOuverture,
                dateCloture: journee.dateCloture,
                statut: journee.statut,
                caissier: journee.caissier,
                caisse: (journee as any).caisse,
                centre: (journee as any).centre,
            },
            fondInitial: journee.fondInitial || 0,
            // Recettes Card (Session Local Net)
            totalRecettes: stats.netVentesEspeces + stats.netVentesCarte + stats.netVentesCheque,
            recettesDetails: {
                espaces: stats.netVentesEspeces,
                carte: stats.netVentesCarte,
                cheque: stats.netVentesCheque,
                enCoffre: stats.netVentesCheque
            },
            // Sales Cards (Gross local session)
            totalVentesEspeces: stats.grossVentesEspeces,
            totalVentesCarte: stats.grossVentesCarte,
            totalVentesCheque: stats.grossVentesCheque,
            nbVentesCarte: stats.nbVentesCarte,
            nbVentesCheque: stats.nbVentesCheque,
            centreVentesEspeces,
            centreVentesBancaires,
            totalInterne: stats.totalInterneIn,
            totalDepenses: stats.totalOutflows,
            // Solde Cards (Physical Cash)
            soldeTheorique: (journee.fondInitial || 0) + stats.totalInterneIn + stats.grossVentesEspeces - stats.totalOutflows,
            soldeReel: (journee.fondInitial || 0) + stats.totalInterneIn + stats.grossVentesEspeces - stats.totalOutflows,
            ecart: journee.ecart || 0,
        };
    }
}
