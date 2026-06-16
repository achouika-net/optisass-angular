const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
async function main() {
  const count = await prisma.facture.count();
  console.log("Total Factures in DB:", count);
}
main().finally(() => prisma.$disconnect());
