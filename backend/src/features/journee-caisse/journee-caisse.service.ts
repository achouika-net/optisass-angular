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

        // Calculate theoretical balance using cached fields
        const soldeTheorique =
            journee.fondInitial +
            (journee as any).totalComptable +
            (journee as any).totalInterne -
            (journee as any).totalDepenses;

        // Calculate écart
        const ecart = cloturerCaisseDto.soldeReel - soldeTheorique;

        // Validate justification if écart exists
        if (Math.abs(ecart) > 0.01 && !cloturerCaisseDto.justificationEcart) {
            throw new BadRequestException(
                'Une justification est requise en cas d\'écart',
            );
        }

        // Close the session
        return this.prisma.journeeCaisse.update({
            where: { id },
            data: {
                statut: 'FERMEE',
                dateCloture: new Date(),
                soldeTheorique,
                soldeReel: cloturerCaisseDto.soldeReel,
                ecart,
                justificationEcart: cloturerCaisseDto.justificationEcart,
                responsableCloture: cloturerCaisseDto.responsableCloture,
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
            },
        });

        if (!journee) {
            throw new NotFoundException('Journée de caisse introuvable');
        }

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
            totalComptable: (journee as any).totalComptable || 0,
            totalVentesEspeces: (journee as any).totalVentesEspeces || 0,
            totalVentesCarte: (journee as any).totalVentesCarte || 0,
            totalVentesCheque: (journee as any).totalVentesCheque || 0,
            totalInterne: (journee as any).totalInterne || 0,
            totalDepenses: (journee as any).totalDepenses || 0,
            totalTransfertsDepenses: (journee as any).totalTransfertsDepenses || 0,
            soldeTheorique:
                (journee.fondInitial || 0) +
                ((journee as any).totalComptable || 0) +
                ((journee as any).totalInterne || 0) -
                ((journee as any).totalDepenses || 0),
            soldeReel: journee.soldeReel || 0,
            ecart: journee.ecart || 0,
        };
    }
}
