import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class StockMovementsService {
    constructor(private prisma: PrismaService) { }

    async findAllByProduct(productId: string) {
        return this.prisma.mouvementStock.findMany({
            where: { produitId: productId },
            orderBy: { dateMovement: 'desc' },
            include: {
                entrepotSource: true,
                entrepotDestination: true,
                // Include facture to get fiche information
                facture: {
                    include: {
                        fiche: true,
                        client: true
                    }
                }
            }
        });
    }
}
