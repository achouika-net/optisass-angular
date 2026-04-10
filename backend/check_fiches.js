const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const fiches = await prisma.fiche.findMany({
    take: 5,
    select: {
      id: true,
      numero: true,
      dateCreation: true,
      content: true
    }
  });
  console.log('--- FICHES ---');
  fiches.forEach(f => {
    console.log(`ID: ${f.id}, Num: ${f.numero}, Date: ${f.dateCreation} (${typeof f.dateCreation})`);
    if (f.content && f.content.dateCreation) {
        console.log(`  - Content Date: ${f.content.dateCreation} (${typeof f.content.dateCreation})`);
    }
  });
  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
