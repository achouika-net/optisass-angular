
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkInvoice() {
  const invoice = await prisma.facture.findFirst({
    where: { numero: 'BC-2026-013' },
    include: {
      client: {
        select: {
          id: true,
          nom: true,
          prenom: true,
          pointsFidelite: true
        }
      },
      paiements: true
    }
  });

  if (!invoice) {
    console.log('Invoice BC-2026-013 not found');
    return;
  }

  console.log('Document:', {
    id: invoice.id,
    numero: invoice.numero,
    type: invoice.type,
    statut: invoice.statut,
    totalTTC: invoice.totalTTC,
    resteAPayer: invoice.resteAPayer,
    proprietes: invoice.proprietes
  });

  console.log('Client:', invoice.client);

  const history = await prisma.pointsHistory.findMany({
    where: { factureId: invoice.id }
  });

  console.log('Points History:', history);
}

checkInvoice()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
