import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const invoices = await prisma.factureFournisseur.findMany({
    include: { echeances: true }
  });
  
  console.log("Checking and updating credit note invoices...");
  let count = 0;
  
  for (const inv of invoices) {
    const isAvoirByName = inv.numeroFacture.startsWith('AV') || inv.numeroFacture.startsWith('av') || inv.numeroFacture.startsWith('CN') || inv.numeroFacture.startsWith('cn') || inv.type?.toUpperCase() === 'AVOIR';
    
    if (!isAvoirByName) {
      const avoirEcheances = inv.echeances.filter(e => e.type === 'AVOIR' && e.statut === 'PAYEE');
      const totalAvoirPaid = avoirEcheances.reduce((sum, e) => sum + e.montant, 0);
      
      if (totalAvoirPaid > 0 && Math.abs(totalAvoirPaid - inv.montantTTC) < 0.01) {
        console.log(`Updating invoice ${inv.numeroFacture} (ID: ${inv.id}) to type 'AVOIR'. Amount: ${inv.montantTTC}`);
        await prisma.factureFournisseur.update({
          where: { id: inv.id },
          data: { type: 'AVOIR' }
        });
        count++;
      }
    }
  }
  
  console.log(`Finished. Updated ${count} invoices.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
