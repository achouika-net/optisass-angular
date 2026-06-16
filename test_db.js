const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const facture = await prisma.facture.findUnique({
    where: { numero: 'Fact-86/2026' }
  });
  console.log("DB facture totalTTC:", facture.totalTTC);
}
run();
