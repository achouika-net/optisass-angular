import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const clientId = '0d48b2c8-573a-40a2-acd6-f8f68701e6da'; // Arsalane CHOUIKA
  const history = await prisma.pointsHistory.findMany({
    where: { clientId },
    orderBy: { date: 'desc' },
    take: 10
  });

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { pointsFidelite: true, nom: true, prenom: true }
  });

  console.log('💎 [LOYALTY AUDIT]');
  console.log('Client:', JSON.stringify(client, null, 2));
  console.log('History:', JSON.stringify(history, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
