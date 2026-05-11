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
    const ep = await prisma.echeancePaiement.findUnique({
      where: { id: '14bb9d76-9fa5-447e-a12a-1c82acefedaf' }
    });
    console.log(JSON.stringify(ep, null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
