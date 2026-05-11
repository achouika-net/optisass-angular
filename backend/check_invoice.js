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
    const f = await prisma.factureFournisseur.findFirst({
      where: { numeroFacture: 'Fact1423/2026' },
      include: { echeances: true }
    });
    console.log(JSON.stringify(f, null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
