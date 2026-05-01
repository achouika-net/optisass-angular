const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const res = await prisma.bonLivraison.findFirst({where: {numeroBL: '654/2026'}});
  console.log(JSON.stringify(res, null, 2));
  await prisma.$disconnect();
}
run();
