const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
async function main() {
  const txs = await prisma.transactionBancaire.findMany({
    where: { typeTransaction: "CARTE" }
  });
  console.log("Total CARTE transactions in DB:", txs.length);
  txs.forEach(t => {
    console.log(`ID: ${t.id}, Date: ${t.dateTransaction}, Desc: "${t.description}", Type: ${t.type}, Montant: ${t.montant}`);
  });
}
main().catch(console.error).finally(() => prisma.$disconnect());
