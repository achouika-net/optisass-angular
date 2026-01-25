import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class StockAvailabilityService {
    constructor(private prisma: PrismaService) { }

    async checkAvailability(id: string) {
        const facture = await this.prisma.facture.findUnique({
            where: { id },
            include: { client: true }
        });

        if (!facture) {
            throw new NotFoundException(`Document ${id} non trouvé`);
        }

        const lines = (facture.lignes as any[]) || [];
        const conflicts: any[] = [];
        const localCentreId = facture.centreId || (facture as any).client?.centreId;

        for (const line of lines) {
            const pid = line.productId;
            if (!pid) continue;

            const requestedQty = Number(line.qte) || 1;

            // 1. Check local stock
            let localProduct = await this.prisma.product.findFirst({
                where: {
                    OR: [
                        { id: pid },
                        {
                            AND: [
                                { designation: (line.designation || line.description || '').trim() },
                                { entrepot: { centreId: localCentreId } }
                            ]
                        }
                    ]
                },
                include: { entrepot: { include: { centre: true } } }
            });

            const isAvailableLocally = localProduct && localProduct.quantiteActuelle >= requestedQty;

            if (!isAvailableLocally) {
                // 2. Search in other centers
                const otherCentersStock = await this.prisma.product.findMany({
                    where: {
                        designation: (line.designation || line.description || '').trim(),
                        entrepot: { centreId: { not: localCentreId } },
                        quantiteActuelle: { gt: 0 }
                    },
                    include: {
                        entrepot: {
                            include: {
                                centre: true
                            }
                        }
                    }
                });

                conflicts.push({
                    productId: pid,
                    designation: line.description || line.designation,
                    requestedQty,
                    localAvailableQty: localProduct?.quantiteActuelle || 0,
                    localCentreId,
                    alternatives: otherCentersStock.map(p => ({
                        productId: p.id,
                        centreId: p.entrepot?.centreId,
                        centreNom: (p.entrepot as any)?.centre?.nom || 'Autre Centre',
                        availableQty: p.quantiteActuelle,
                        entrepotNom: p.entrepot?.nom
                    }))
                });
            }
        }

        return {
            hasConflicts: conflicts.length > 0,
            conflicts
        };
    }
}
