import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const factureId = '6b07734a-6e7d-49cc-9fea-781c2f65a0a2'; // Devis-2026-001
  const incomingPoints = 1000;

  console.log(`🧪 [SIMULATION] Updating Facture ${factureId} with pointsUtilises=${incomingPoints}`);

  const existingFacture = await prisma.facture.findUnique({
    where: { id: factureId }
  });

  if (!existingFacture) {
    console.error('Facture not found');
    return;
  }

  const existingProps = (existingFacture.proprietes as any) || {};
  const newProps = { pointsUtilises: incomingPoints };

  console.log('📦 Existing Props:', JSON.stringify(existingProps, null, 2));
  console.log('📥 New Props:', JSON.stringify(newProps, null, 2));

  const mergedProps = {
    ...existingProps,
    ...newProps,
    pointsSpent: true // Simulate the spends flag
  };

  console.log('🔄 Merged Props:', JSON.stringify(mergedProps, null, 2));

  const updated = await prisma.facture.update({
    where: { id: factureId },
    data: {
      proprietes: mergedProps,
      totalTTC: 2450 // Simulate the discount
    }
  });

  console.log('✅ Updated Record in DB:', JSON.stringify(updated.proprietes, null, 2));
  console.log('✅ Final TotalTTC:', updated.totalTTC);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
