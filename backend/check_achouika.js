const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const clients = await prisma.client.findMany({
    where: {
      OR: [
        { nom: { contains: 'achouika', mode: 'insensitive' } },
        { prenom: { contains: 'achouika', mode: 'insensitive' } }
      ]
    },
    select: {
      id: true,
      nom: true,
      prenom: true,
      pointsFidelite: true
    }
  });
  console.log(JSON.stringify(clients, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
