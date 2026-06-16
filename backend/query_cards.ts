import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const txs = await prisma.transactionBancaire.findMany({
    where: { typeTransaction: "CARTE" }
  });
  console.log("Total CARTE transactions in DB:", txs.length);
  txs.slice(0, 10).forEach(t => {
    console.log(ID: , Date: , Desc: "", Type: , Montant: );
  });
}
main().catch(console.error);
