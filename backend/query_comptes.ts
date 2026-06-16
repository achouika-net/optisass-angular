import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const comptes = await prisma.compteBancaire.findMany();
  console.log(`Found ${comptes.length} accounts:`);
  for (const c of comptes) {
    console.log(`- ID: ${c.id}, Nom: ${c.nom}, Banque: ${c.banque}, NumCompte: ${c.numeroCompte}, SoldeInitial: ${c.soldeInitial}, SoldeActuel: ${c.soldeActuel}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
