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

    async findHistory(centreId: string) {
        console.time('FindHistory');
        const history = await this.prisma.journeeCaisse.findMany({
            where: {
                centreId,
                statut: 'FERMEE'
            },
            orderBy: {
                dateCloture: 'desc'
            },
            take: 100,
            include: {
                caisse: true
            }
        });
        console.timeEnd('FindHistory');
        return history;
    }

    async getResume(id: string) {
        console.time('GetResume-Total');
        console.log('--- START GET RESUME ---');

        console.time('GetResume-Step1-Metadata');
        // 1. Fetch metadata only (STOP fetching all operations)
        const journee = await this.prisma.journeeCaisse.findUnique({
            where: { id },
            include: {
                caisse: true,
                centre: true,
                // operations: true <--- REMOVED to prevent memory overload
            },
        });

        if (!journee) {
            throw new NotFoundException('Journée de caisse introuvable');
        }

        console.timeEnd('GetResume-Step1-Metadata');

        // 2. Aggregate Local Stats (Current Session) - Database side
        console.time('GetResume-Step2-LocalStats');
        const localAggregates = await this.prisma.operationCaisse.groupBy({
            by: ['type', 'typeOperation', 'moyenPaiement'],
            where: { journeeCaisseId: id },
            _sum: { montant: true },
            _count: { id: true }
        });

        // 3. Process Aggregates (Fast)
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
            totalOutflows: 0,
            totalOutflowsCash: 0,
        };

        localAggregates.forEach(agg => {
            const amount = agg._sum.montant || 0;
            const count = agg._count.id || 0;
            const { type, typeOperation, moyenPaiement } = agg;

            if (type === 'ENCAISSEMENT') {
                if (typeOperation === 'COMPTABLE') {
                    if (moyenPaiement === 'ESPECES') {
                        stats.grossVentesEspeces += amount;
                        stats.netVentesEspeces += amount;
                    } else if (moyenPaiement === 'CARTE') {
                        stats.grossVentesCarte += amount;
                        stats.netVentesCarte += amount;
                        stats.nbVentesCarte += count;
                    } else if (moyenPaiement === 'CHEQUE') {
                        stats.grossVentesCheque += amount;
                        stats.netVentesCheque += amount;
                        stats.nbVentesCheque += count;
                    }
                } else if (typeOperation === 'INTERNE' && moyenPaiement === 'ESPECES') {
                    stats.totalInterneIn += amount; // Assuming Interne is mostly Cash/Espèces
                }
            } else if (type === 'DECAISSEMENT') {
                stats.totalOutflows += amount;
                if (moyenPaiement === 'ESPECES') {
                    stats.totalOutflowsCash += amount;
                }

                if (typeOperation === 'COMPTABLE') {
                    // Refund logic: subtract from net sales
                    if (moyenPaiement === 'ESPECES') stats.netVentesEspeces -= amount;
                    else if (moyenPaiement === 'CARTE') stats.netVentesCarte -= amount;
                    else if (moyenPaiement === 'CHEQUE') stats.netVentesCheque -= amount;
                }
            }
        });

        console.timeEnd('GetResume-Step2-LocalStats');

        const isDepenses = (journee.caisse as any).type === 'DEPENSES';

        let centreVentesEspeces = 0;
        let centreVentesCarte = 0;
        let centreVentesCheque = 0;

        // Global Center Stats (Only needed for DEPENSES registers to calculate 'Total Recettes')
        if (isDepenses) {
            console.time('GetResume-Step3-GlobalStats');
            console.time('GetResume-Step3-GlobalStats-Ids');
            // A. Get Open Session IDs first (Fast Index Scan)
            const openJournees = await this.prisma.journeeCaisse.findMany({
                where: {
                    centreId: journee.centreId,
                    statut: 'OUVERTE'
                },
                select: { id: true }
            });
            const openJourneeIds = openJournees.map(j => j.id);
            console.timeEnd('GetResume-Step3-GlobalStats-Ids');

            console.time('GetResume-Step3-GlobalStats-Agg');
            // B. Aggregate using simple IN clause (Avoids expensive JOIN)
            const globalStats = await this.prisma.operationCaisse.groupBy({
                by: ['moyenPaiement'],
                where: {
                    journeeCaisseId: { in: openJourneeIds },
                    typeOperation: 'COMPTABLE',
                    type: 'ENCAISSEMENT'
                },
                _sum: {
                    montant: true
                }
            });
            console.timeEnd('GetResume-Step3-GlobalStats-Agg');
            console.timeEnd('GetResume-Step3-GlobalStats');

            globalStats.forEach(stat => {
                const amount = stat._sum.montant || 0;
                if (stat.moyenPaiement === 'ESPECES') centreVentesEspeces = amount;
                else if (stat.moyenPaiement === 'CARTE') centreVentesCarte = amount;
                else if (stat.moyenPaiement === 'CHEQUE') centreVentesCheque = amount;
            });
        }


        console.timeEnd('GetResume-Total');

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
            // Recettes Card (Center-wide if Petty Cash, Local if Main)
            totalRecettes: isDepenses
                ? (centreVentesEspeces + centreVentesCarte + centreVentesCheque)
                : (stats.netVentesEspeces + stats.netVentesCarte + stats.netVentesCheque),
            recettesDetails: {
                espaces: isDepenses ? centreVentesEspeces : stats.netVentesEspeces,
                carte: isDepenses ? centreVentesCarte : stats.netVentesCarte,
                cheque: isDepenses ? centreVentesCheque : stats.netVentesCheque,
                enCoffre: isDepenses ? centreVentesCheque : stats.netVentesCheque
            },
            // Sales Cards (Gross local session)
            totalVentesEspeces: stats.grossVentesEspeces,
            totalVentesCarte: stats.grossVentesCarte,
            totalVentesCheque: stats.grossVentesCheque,
            nbVentesCarte: stats.nbVentesCarte,
            nbVentesCheque: stats.nbVentesCheque,
            totalInterne: stats.totalInterneIn,
            totalDepenses: stats.totalOutflows,
            // Solde Cards (Physical Cash)
            soldeTheorique: (journee.fondInitial || 0) + stats.totalInterneIn + stats.grossVentesEspeces - stats.totalOutflowsCash,
            soldeReel: (journee.fondInitial || 0) + stats.totalInterneIn + stats.grossVentesEspeces - stats.totalOutflowsCash,
            ecart: journee.ecart || 0,
        };
    }
}
