import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Sync the invoice 454564
  const invoice = await prisma.factureFournisseur.findFirst({
    where: { numeroFacture: '454564' },
    include: { echeances: true }
  });
  if (invoice) {
    const total = invoice.echeances.length;
    const paid = invoice.echeances.filter(e => e.statut === 'ENCAISSE').length;
    console.log(`Invoice ${invoice.numeroFacture}: total=${total}, paid=${paid}`);
    if (total === paid && total > 0) {
      await prisma.factureFournisseur.update({
        where: { id: invoice.id },
        data: { statut: 'PAYEE' }
      });
      console.log('Updated invoice status to PAYEE.');
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
