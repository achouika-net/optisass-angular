const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    const f = await prisma.fiche.findFirst({
      where: { type: 'OPTIQUE' }
    });
    if (f) {
      console.log('--- FICHE CONTENT ---');
      console.log(JSON.stringify(f.content, null, 2));
    } else {
      console.log('No optical fiche found.');
    }
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
