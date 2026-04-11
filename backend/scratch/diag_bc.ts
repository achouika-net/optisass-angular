import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const totalBCs = await prisma.facture.count({
    where: { type: { in: ['BON_COMMANDE', 'BON_COMM'] }, statut: { notIn: ['ARCHIVE', 'ANNULEE'] } }
  });
  const bcWithFiche = await prisma.facture.count({
    where: { type: { in: ['BON_COMMANDE', 'BON_COMM'] }, statut: { notIn: ['ARCHIVE', 'ANNULEE'] }, ficheId: { not: null } }
  });
  const bcWithNote = await prisma.facture.count({
    where: { type: { in: ['BON_COMMANDE', 'BON_COMM'] }, statut: { notIn: ['ARCHIVE', 'ANNULEE'] }, notes: { contains: 'Remplacée par' } }
  });
  const factWithFiche = await prisma.facture.count({
    where: { type: 'FACTURE', statut: { notIn: ['ARCHIVE'] }, ficheId: { not: null } }
  });
  const factNoFiche = await prisma.facture.count({
    where: { type: 'FACTURE', statut: { notIn: ['ARCHIVE'] }, ficheId: null }
  });

  const factureFicheIds = await prisma.facture.findMany({
    where: { type: 'FACTURE', ficheId: { not: null }, statut: { notIn: ['ARCHIVE', 'ANNULEE'] } },
    select: { ficheId: true }
  });
  const ficheIdList = [...new Set(factureFicheIds.map(f => f.ficheId).filter(Boolean))] as string[];

  const bcsDedupedViaFiche = ficheIdList.length > 0 ? await prisma.facture.count({
    where: { type: { in: ['BON_COMMANDE', 'BON_COMM'] }, statut: { notIn: ['ARCHIVE', 'ANNULEE'] }, ficheId: { in: ficheIdList } }
  }) : 0;

  const bcNotDeduped = await prisma.facture.count({
    where: {
      type: { in: ['BON_COMMANDE', 'BON_COMM'] },
      statut: { notIn: ['ARCHIVE', 'ANNULEE'] },
      ficheId: null,
      NOT: { notes: { contains: 'Remplacée par' } }
    }
  });

  const bcNotDedupedAgg = await prisma.facture.aggregate({
    where: {
      type: { in: ['BON_COMMANDE', 'BON_COMM'] },
      statut: { notIn: ['ARCHIVE', 'ANNULEE'] },
      ficheId: null,
      NOT: { notes: { contains: 'Remplacée par' } }
    },
    _sum: { totalTTC: true }
  });

  // Sample of those BCs: check if there's a FACTURE with same client + same amount
  const sampleBCs = await prisma.facture.findMany({
    where: {
      type: { in: ['BON_COMMANDE', 'BON_COMM'] },
      statut: { notIn: ['ARCHIVE', 'ANNULEE'] },
      ficheId: null,
      NOT: { notes: { contains: 'Remplacée par' } }
    },
    select: { id: true, numero: true, clientId: true, totalTTC: true, dateEmission: true, notes: true },
    take: 10,
    orderBy: { totalTTC: 'desc' }
  });

  console.log(JSON.stringify({
    totalBCs,
    bcWithFiche,
    bcWithNote,
    bcsDedupedViaFiche,
    bcNotDeduped,
    factWithFiche,
    factNoFiche,
    ficheIdList_count: ficheIdList.length,
    montantBCsNonDedupes: bcNotDedupedAgg._sum.totalTTC,
    sampleBCsNonDedupes: sampleBCs
  }, null, 2));

  await prisma.$disconnect();
}
main().catch(console.error);
