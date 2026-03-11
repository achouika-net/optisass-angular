const fs = require('fs');
const { execSync } = require('child_process');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Extracting original invoice numbers from dump.sql...');
  
  // Create a fast parser to find all INSERT INTO "factures" or "Facture" in dump.sql
  // Since dump.sql is pg_dump, it usually uses COPY public."Facture" (id, ...) FROM stdin;
  // Let's just find the COPY block for Facture.
  
  const dump = fs.readFileSync('../dump.sql', 'utf8');
  const lines = dump.split('\n');
  
  let inFactureCopy = false;
  let idIndex = -1;
  let numeroIndex = -1;
  
  const restoreMap = {};
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (line.startsWith('COPY public."Facture"')) {
      inFactureCopy = true;
      // COPY public."Facture" (id, numero, ...) FROM stdin;
      const colMatch = line.match(/\((.*?)\)/);
      if (colMatch) {
        const cols = colMatch[1].split(',').map(c => c.trim().replace(/"/g, ''));
        idIndex = cols.indexOf('id');
        numeroIndex = cols.indexOf('numero');
      }
      continue;
    }
    
    if (inFactureCopy) {
      if (line === '\\.') {
        inFactureCopy = false;
        break; // End of COPY block
      }
      
      const parts = line.split('\t');
      if (parts.length > Math.max(idIndex, numeroIndex)) {
        const id = parts[idIndex];
        const numero = parts[numeroIndex];
        restoreMap[id] = numero;
      }
    }
  }
  
  const restoreCount = Object.keys(restoreMap).length;
  console.log(`Found ${restoreCount} invoices in dump.sql.`);
  
  if (restoreCount === 0) {
    console.log('Could not find COPY block, the dump might be using INSERTs. Let\'s try parsing INSERTs.');
    // Let's assume it has INSERT INTO public."Facture" (id, numero, ...) VALUES ('...', '...', ...);
    const regex = /INSERT INTO public\."Facture"\s*\((.*?)\)\s*VALUES\s*\((.*?)\);/g;
    let match;
    while ((match = regex.exec(dump)) !== null) {
        // very simplified parsing
    }
  }

  // Now let's fetch current invoices that start with TEMP-RENUMBER or Fact-2026- or BC-2026-
  const currentInvoices = await prisma.facture.findMany({
    select: { id: true, numero: true }
  });
  
  let restoredCount = 0;
  const updates = [];
  
  for (const inv of currentInvoices) {
    const originalNum = restoreMap[inv.id];
    if (originalNum && inv.numero !== originalNum) {
      // It was changed!
      updates.push(prisma.facture.update({
        where: { id: inv.id },
        data: { numero: originalNum }
      }));
      restoredCount++;
    }
  }
  
  console.log(`Preparing to restore ${restoredCount} invoice numbers to their original dump values...`);

  // Execute in batches to avoid max call stack / transaction limits
  const BATCH_SIZE = 1000;
  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const batch = updates.slice(i, i + BATCH_SIZE);
    await prisma.$transaction(batch);
    console.log(`Restored batch ${Math.floor(i/BATCH_SIZE) + 1}...`);
  }
  
  console.log('Restoration complete!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
