import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const latest = await prisma.facture.findFirst({
    where: { type: 'DEVIS' },
    orderBy: { createdAt: 'desc' },
    include: { client: true }
  });

  console.log('📄 [DEVIS AUDIT]');
  if (latest) {
    console.log('ID:', latest.id);
    console.log('Numero:', latest.numero);
    console.log('Statut:', latest.statut);
    console.log('Proprietes:', JSON.stringify(latest.proprietes, null, 2));
    console.log('Client Balance:', latest.client?.pointsFidelite);
  } else {
    console.log('No devis found.');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
