const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres:mypassword@localhost:5435/optisaas?schema=public'
    }
  }
});

async function main() {
  try {
    const start = new Date('2026-05-01');
    const end = new Date('2026-05-31T23:59:59Z');

    // 1. Trouver les factures fantômes
    const ghosts = await prisma.factureFournisseur.findMany({
      where: {
        type: 'BL',
        dateEmission: { gte: start, lte: end }
      }
    });

    console.log(`Suppression de ${ghosts.length} factures fantômes...`);

    if (ghosts.length > 0) {
      const ids = ghosts.map(g => g.id);

      // Supprimer les échéances liées d'abord
      const delEp = await prisma.echeancePaiement.deleteMany({
        where: { factureFournisseurId: { in: ids } }
      });
      console.log(`${delEp.count} échéances supprimées.`);

      // Détacher les BL
      await prisma.bonLivraison.updateMany({
        where: { factureFournisseurId: { in: ids } },
        data: { factureFournisseurId: null }
      });

      // Supprimer les factures
      const delF = await prisma.factureFournisseur.deleteMany({
        where: { id: { in: ids } }
      });
      console.log(`${delF.count} factures supprimées.`);
    }

  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
