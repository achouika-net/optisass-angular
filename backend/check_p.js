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
    const p = await prisma.product.findUnique({
        where: { id: 'e5bf9882-9184-4671-80c4-18babb4bd03c' }
    });
    console.log('Product details:', JSON.stringify(p, null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
