const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testSave() {
  const fiches = await prisma.fiche.findMany({ take: 1 });
  if (fiches.length === 0) {
    console.log('No fiches found to test.');
    return;
  }
  
  const targetId = fiches[0].id;
  console.log(`Testing with Fiche ID: ${targetId}`);
  
  // Fake what FichesService.update does
  const currentContent = fiches[0].content || {};
  const contentToMerge = {
    suiviCommande: {
      fournisseur: 'Zeiss',
      trackingNumber: 'TEST-1234',
      referenceCommande: 'CMD-9999'
    }
  };
  
  const mergedContent = { ...currentContent, ...contentToMerge };
  
  const updated = await prisma.fiche.update({
    where: { id: targetId },
    data: { content: mergedContent }
  });
  
  console.log('Update result content:', JSON.stringify(updated.content.suiviCommande, null, 2));
}

testSave().catch(console.error).finally(() => prisma.$disconnect());
