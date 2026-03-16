const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
    console.log('--- Diagnostic: Mixte Caisse ---');
    
    // 1. Find Mixte Caisses
    const mixtes = await prisma.caisse.findMany({
        where: { type: 'MIXTE' },
        include: { centre: true }
    });
    
    console.log(`Found ${mixtes.length} MIXTE caisses.`);
    
    for (const caisse of mixtes) {
        console.log(`\nCaisse: ${caisse.nom} (ID: ${caisse.id}, Centre: ${caisse.centre?.nom})`);
        
        // 2. Find sessions for this caisse
        const journees = await prisma.journeeCaisse.findMany({
            where: { caisseId: caisse.id },
            orderBy: { dateOuverture: 'desc' },
            take: 3,
        });
        
        console.log(`  Found ${journees.length} recent sessions.`);
        for (const j of journees) {
            console.log(`    - Session: ${j.id} | Statut: ${j.statut}`);
            console.log(`      Totaux: Comptable=${j.totalComptable}, Ventes(Esp)=${j.totalVentesEspeces}, Depenses=${j.totalDepenses}`);
            
            // 3. Find some operations
            const ops = await prisma.operationCaisse.findMany({
                where: { journeeCaisseId: j.id },
                take: 10
            });
            console.log(`      Found ${ops.length} operations for this session.`);
            if (ops.length > 0) {
                console.log(`      Operations (Sample):`);
                ops.forEach(op => console.log(`        * ${op.type} | ${op.montant} | ${op.moyenPaiement} | ${op.reference}`));
            }
        }
    }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
