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
    // 1. Identifier les factures à supprimer
    // Type "BL" et date de Mai 2026
    const invoicesToDelete = await prisma.factureFournisseur.findMany({
      where: {
        type: 'BL',
        dateEmission: { gte: new Date('2026-05-01'), lte: new Date('2026-05-31') },
        echeances: { none: {} } // Uniquement si pas de paiement attaché
      }
    });

    console.log(`Nombre de factures "BL" trouvées sans paiement: ${invoicesToDelete.length}`);
    
    if (invoicesToDelete.length > 0) {
        const ids = invoicesToDelete.map(f => f.id);
        
        // Avant de supprimer les factures, on doit détacher les BL qui y sont liés
        await prisma.bonLivraison.updateMany({
            where: { factureFournisseurId: { in: ids } },
            data: { factureFournisseurId: null }
        });

        const deleted = await prisma.factureFournisseur.deleteMany({
            where: { id: { in: ids } }
        });
        
        console.log(`Succès: ${deleted.count} factures fantômes supprimées.`);
    }

  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
