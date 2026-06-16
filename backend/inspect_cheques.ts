import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const cheques = await prisma.paiement.findMany({
    where: {
      OR: [
        { mode: { contains: 'CHE' } },
        { mode: { contains: 'CH' } },
      ]
    },
    include: {
      facture: {
        select: {
          centreId: true,
          numero: true
        }
      }
    }
  });

  console.log(`Total cheques in DB: ${cheques.length}`);
  const modesMap = new Map<string, number>();
  const centersMap = new Map<string, number>();
  const statusMap = new Map<string, number>();

  for (const c of cheques) {
    const mode = c.mode || 'null';
    modesMap.set(mode, (modesMap.get(mode) || 0) + 1);

    const centreId = c.facture?.centreId || 'null';
    centersMap.set(centreId, (centersMap.get(centreId) || 0) + 1);
    
    const status = c.statut || 'null';
    statusMap.set(status, (statusMap.get(status) || 0) + 1);
  }

  console.log('=== Cheque Modes ===');
  for (const [mode, count] of modesMap.entries()) {
    console.log(`Mode "${mode}" (Length: ${mode.length}): ${count}`);
    // Print character codes of mode
    const codes = Array.from(mode).map(char => char.charCodeAt(0));
    console.log(`  Char codes: ${codes.join(', ')}`);
  }

  console.log('=== Cheque Centers ===');
  for (const [cid, count] of centersMap.entries()) {
    console.log(`Center ${cid}: ${count}`);
  }

  console.log('=== Cheque Statuses ===');
  for (const [status, count] of statusMap.entries()) {
    console.log(`Status ${status}: ${count}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
