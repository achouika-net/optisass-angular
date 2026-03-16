import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const fiches = await prisma.fiche.findMany({
    take: 5,
    orderBy: { dateCreation: 'desc' }
  });

  for (const fiche of fiches) {
    console.log(`Fiche ID: ${fiche.id}`);
    const content = fiche.content as any;
    if (content) {
      console.log(`  Has Montage: ${!!content.montage}`);
      if (content.montage) {
        console.log(`  Captured Image: ${!!content.montage.capturedImage}`);
        if (content.montage.capturedImage) {
            console.log(`  Image Length: ${content.montage.capturedImage.length}`);
        }
      }
    }
    console.log('---');
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
