import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- WAREHOUSES ---');
  const warehouses = await prisma.entrepot.findMany({
    select: { id: true, nom: true }
  });
  console.log(JSON.stringify(warehouses, null, 2));

  console.log('\n--- RECENT MOVEMENTS WITH INCONNU OR NULL ---');
  const movements = await prisma.mouvementStock.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' },
    include: {
        entrepotDestination: true,
        entrepotSource: true
    }
  });
  
  movements.forEach(m => {
      console.log(`ID: ${m.id}, Dest: ${m.entrepotDestination?.nom}, Source: ${m.entrepotSource?.nom}, Qty: ${m.quantite}`);
  });
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
