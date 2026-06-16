const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
async function main() {
  const f = await prisma.facture.aggregate({
    _sum: { totalTTC: true },
    _count: { _all: true },
    where: { type: "FACTURE", statut: { notIn: ["ARCHIVE", "ANNULEE"] } }
  });
  const bc = await prisma.facture.aggregate({
    _sum: { totalTTC: true },
    _count: { _all: true },
    where: { type: { in: ["BON_COMMANDE", "BON_COMM"] }, statut: { notIn: ["ARCHIVE", "ANNULEE"] } }
  });
  const devis = await prisma.facture.aggregate({
    _sum: { totalTTC: true },
    _count: { _all: true },
    where: { type: "DEVIS", statut: { notIn: ["ARCHIVE", "ANNULEE"] } }
  });
  console.log("FACTURE:", f);
  console.log("BC:", bc);
  console.log("DEVIS:", devis);
}
main().finally(() => prisma.$disconnect());
