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
    const center = await prisma.centre.findFirst({
      where: { nom: { contains: 'Rabat' } }
    });
    if (!center) {
      console.log('Center Rabat not found');
      return;
    }
    const openSessions = await prisma.journeeCaisse.findMany({
      where: {
        caisse: { centreId: center.id },
        statut: 'OUVERTE'
      },
      include: { caisse: true }
    });
    console.log('Open Sessions in Rabat:', JSON.stringify(openSessions, null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
