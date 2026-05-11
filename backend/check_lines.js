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
    const f = await prisma.facture.findFirst({
        where: { numero: 'BC-2026-025' }
    });
    
    if (!f) {
        console.log('Facture not found');
        return;
    }

    console.log(`Facture #${f.numero} - Statut: ${f.statut}`);
    console.log('Lignes (JSON):');
    const lines = typeof f.lignes === 'string' ? JSON.parse(f.lignes) : f.lignes;
    console.log(JSON.stringify(lines, null, 2));

  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
