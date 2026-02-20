import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCaisseDto } from './dto/create-caisse.dto';
import { UpdateCaisseDto } from './dto/update-caisse.dto';

@Injectable()
export class CaisseService {
    constructor(private prisma: PrismaService) { }

    async create(createCaisseDto: CreateCaisseDto) {
        console.log('[DEBUG Caisse] Creating with:', JSON.stringify(createCaisseDto, null, 2));
        try {
            // Check if caisse with same name exists in the same centre
            const existing = await this.prisma.caisse.findFirst({
                where: {
                    nom: createCaisseDto.nom,
                    centreId: createCaisseDto.centreId,
                },
            });

            if (existing) {
                console.log('[DEBUG Caisse] Conflict found:', existing.id);
                throw new ConflictException(
                    `Une caisse avec le nom "${createCaisseDto.nom}" existe déjà dans ce centre`,
                );
            }

            const result = await this.prisma.caisse.create({
                data: createCaisseDto,
                include: {
                    centre: true,
                },
            });
            console.log('[DEBUG Caisse] Success:', result.id);
            return result;
        } catch (err) {
            console.error('[DEBUG Caisse] Fatal Error:', err);
            throw err;
        }
    }

    async findAll() {
        return this.prisma.caisse.findMany({
            include: {
                centre: true,
                journees: {
                    where: {
                        statut: 'OUVERTE',
                    },
                    take: 1,
                    orderBy: {
                        dateOuverture: 'desc',
                    },
                },
            },
            orderBy: {
                createdAt: 'desc',
            },
        });
    }

    async findOne(id: string) {
        const caisse = await this.prisma.caisse.findUnique({
            where: { id },
            include: {
                centre: true,
                journees: {
                    orderBy: {
                        dateOuverture: 'desc',
                    },
                    take: 10,
                },
            },
        });

        if (!caisse) {
            throw new NotFoundException(`Caisse avec l'ID ${id} introuvable`);
        }

        return caisse;
    }

    async findByCentre(centreId: string) {
        return this.prisma.caisse.findMany({
            where: { centreId },
            include: {
                centre: true,
                journees: {
                    where: {
                        statut: 'OUVERTE',
                    },
                    take: 1,
                    orderBy: {
                        dateOuverture: 'desc',
                    },
                },
            },
            orderBy: {
                nom: 'asc',
            },
        });
    }

    async update(id: string, updateCaisseDto: UpdateCaisseDto) {
        // Check if caisse exists
        const caisse = await this.findOne(id);

        // If updating name, check for conflicts
        if (updateCaisseDto.nom) {
            const existing = await this.prisma.caisse.findFirst({
                where: {
                    nom: updateCaisseDto.nom,
                    centreId: caisse.centreId,
                    id: { not: id },
                },
            });

            if (existing) {
                throw new ConflictException(
                    `Une caisse avec le nom "${updateCaisseDto.nom}" existe déjà dans ce centre`,
                );
            }
        }

        return this.prisma.caisse.update({
            where: { id },
            data: updateCaisseDto,
            include: {
                centre: true,
            },
        });
    }

    async remove(id: string) {
        // Check if caisse exists
        await this.findOne(id);

        // Check if there are any journées
        const journeesCount = await this.prisma.journeeCaisse.count({
            where: { caisseId: id },
        });

        if (journeesCount > 0) {
            throw new ConflictException(
                'Impossible de supprimer une caisse avec des journées enregistrées',
            );
        }

        return this.prisma.caisse.delete({
            where: { id },
        });
    }
}
