const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const bc = await prisma.facture.findFirst({
    where: { numero: 'BC-2026-017' },
    include: { paiements: true }
  });

  if (!bc) {
    console.log('❌ Document BC-2026-017 non trouvé');
    return;
  }

  console.log('--- AUDIT BC-2026-017 ---');
  console.log('ID:', bc.id);
  console.log('Statut:', bc.statut);
  console.log('Type:', bc.type);
  console.log('Total HT:', bc.totalHT);
  console.log('Total TTC:', bc.totalTTC);
  console.log('Reste à Payer:', bc.resteAPayer);
  console.log('Notes:', bc.notes);
  console.log('Lignes (Count):', Array.isArray(bc.lignes) ? bc.lignes.length : 'Not array');
  console.log('Lignes (Content):', JSON.stringify(bc.lignes, null, 2));
  console.log('Paiements (Count):', bc.paiements.length);
  console.log('Paiements (Total):', bc.paiements.reduce((s, p) => s + Number(p.montant), 0));
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
