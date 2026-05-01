const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixWarehouses() {
  await prisma.entrepot.update({ where: { id: '4806625b-ce95-476d-889c-a6b9a7f901b9' }, data: { nom: 'Entrepôt de Vente' }});
  const final = await prisma.entrepot.findMany();
  for (const w of final) {
    console.log(`- ID: ${w.id}, Name: ${w.nom}`);
  }
}

fixWarehouses().then(() => prisma.$disconnect());
