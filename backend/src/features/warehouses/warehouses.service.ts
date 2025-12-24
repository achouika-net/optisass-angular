import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateEntrepotDto } from './dto/create-entrepot.dto';
import { UpdateEntrepotDto } from './dto/update-entrepot.dto';

@Injectable()
export class WarehousesService {
    constructor(private prisma: PrismaService) { }

    async create(createEntrepotDto: CreateEntrepotDto) {
        return this.prisma.entrepot.create({
            data: createEntrepotDto,
            include: {
                centre: {
                    include: {
                        groupe: true,
                    },
                },
            },
        });
    }

    async findAll(centreId?: string) {
        return this.prisma.entrepot.findMany({
            where: centreId ? { centreId } : undefined,
            include: {
                centre: {
                    include: {
                        groupe: true,
                    },
                },
                _count: {
                    select: {
                        produits: true,
                    },
                },
            },
        });
    }

    async findOne(id: string) {
        const entrepot = await this.prisma.entrepot.findUnique({
            where: { id },
            include: {
                centre: {
                    include: {
                        groupe: true,
                    },
                },
                produits: true,
                _count: {
                    select: {
                        produits: true,
                    },
                },
            },
        });

        if (!entrepot) {
            throw new NotFoundException(`Entrepot with ID ${id} not found`);
        }

        // Fetch valid incoming transfers via JSON path
        // Note: Prisma JSON searching syntax depends on provider. Assuming Postgres or similar capability.
        // If strict JSON filtering is erratic, we might need raw query or fetch all RESERVED and filter in JS if dataset is small.
        // Let's try standard Prisma filtering (supported in recent versions for Json).
        const incomingProducts = await this.prisma.product.findMany({
            where: {
                statut: 'RESERVE',
                specificData: {
                    path: ['pendingIncoming', 'targetWarehouseId'],
                    equals: id
                }
            }
        });

        // Merge incoming products into the main products list
        // We can add a flag to them if needed, but existing frontend logic
        // checks specificData.pendingTransfer?.targetWarehouseId so it will auto-detect them as 'incoming'
        // if we just add them to the list.
        const allProducts = [...entrepot.produits, ...incomingProducts];

        return {
            ...entrepot,
            produits: allProducts
        };
    }

    async getStockSummary(id: string) {
        const entrepot = await this.findOne(id);

        const stockStats = await this.prisma.product.aggregate({
            where: { entrepotId: id },
            _sum: {
                quantiteActuelle: true,
                prixVenteHT: true,
            },
            _count: true,
        });

        return {
            entrepot: {
                id: entrepot.id,
                nom: entrepot.nom,
                type: entrepot.type,
            },
            totalProducts: stockStats._count,
            totalQuantity: stockStats._sum.quantiteActuelle || 0,
            totalValue: stockStats._sum.prixVenteHT || 0,
        };
    }

    async update(id: string, updateEntrepotDto: UpdateEntrepotDto) {
        try {
            return await this.prisma.entrepot.update({
                where: { id },
                data: updateEntrepotDto,
                include: {
                    centre: {
                        include: {
                            groupe: true,
                        },
                    },
                },
            });
        } catch (error) {
            throw new NotFoundException(`Entrepot with ID ${id} not found`);
        }
    }

    async remove(id: string) {
        try {
            await this.prisma.entrepot.delete({
                where: { id },
            });
            return { message: `Entrepot with ID ${id} deleted successfully` };
        } catch (error) {
            throw new NotFoundException(`Entrepot with ID ${id} not found`);
        }
    }
}
