import { Controller, Get, Query, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Controller('cleanup-emergency')
export class CleanupController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('duplicates')
  async cleanup(@Query('secret') secret: string) {
    if (secret !== 'force-cleanup-2026') throw new UnauthorizedException();

    const today = new Date('2026-05-10');
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const movements = await this.prisma.mouvementStock.findMany({
      where: {
        type: 'SORTIE_VENTE',
        dateMovement: { gte: today, lt: tomorrow },
      },
      orderBy: { dateMovement: 'asc' },
    });

    const seen = new Set<string>();
    const toDelete: string[] = [];
    const restored: string[] = [];

    for (const m of movements) {
      const ficheMatch = m.motif.match(/Fiche (?:n° )?(\d+)/);
      const ficheNum = ficheMatch ? ficheMatch[1] : 'Unknown';
      const key = `${ficheNum}-${m.produitId || 'NoProd'}-${m.glassIndexId || 'NoIdx'}-${m.glassTreatmentId || 'NoTreat'}`;

      if (seen.has(key)) {
        toDelete.push(m.id);
        if (m.produitId) {
          await this.prisma.product.update({
            where: { id: m.produitId },
            data: { quantiteActuelle: { increment: Math.abs(m.quantite) } },
          });
          restored.push(m.produitId);
        }
      } else {
        seen.add(key);
      }
    }

    if (toDelete.length > 0) {
      await this.prisma.mouvementStock.deleteMany({
        where: { id: { in: toDelete } },
      });
    }

    return {
      deleted: toDelete.length,
      restoredProducts: restored.length,
      status: 'success',
    };
  }
}
