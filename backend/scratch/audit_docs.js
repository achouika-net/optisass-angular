
const { PrismaClient } = require('@prisma/client');
// Utilisation de localhost car on tourne en dehors du container
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://postgres:mypassword@localhost:5432/optisaas?schema=public"
    }
  }
});

async function findTheGap() {
  try {
    const start = new Date('2026-01-01T00:00:00Z');
    const end = new Date('2026-12-31T23:59:59Z');

    console.log('--- RECHERCHE DU DÉCALAGE (DOCS 2026) ---');
    
    // On récupère tout pour auditer
    const allDocs = await prisma.facture.findMany({
      where: {
        dateEmission: { gte: start, lte: end },
        statut: { notIn: ['ARCHIVE', 'ANNULEE'] },
        type: { in: ['FACTURE', 'BON_COMMANDE', 'BON_COMM', 'AVOIR', 'DEVIS'] }
      },
      orderBy: { dateEmission: 'asc' }
    });

    const facturesWithFicheIds = new Set(
      allDocs.filter(f => f.type === 'FACTURE' && f.ficheId).map(f => f.ficheId)
    );

    let totalHT = 0;
    let totalTTC = 0;
    let count = 0;

    console.log('--- LISTE DES DOCUMENTS COMPTABILISÉS ---');
    allDocs.forEach(d => {
      // On applique la logique EXACTE de StatsService
      const isDevis = d.type === 'DEVIS';
      const isDouble = (d.type === 'BON_COMMANDE' || d.type === 'BON_COMM') && d.ficheId && facturesWithFicheIds.has(d.ficheId);
      
      const skip = isDevis || isDouble;
      
      if (!skip) {
        count++;
        console.log(`${count}. [${d.type}] ${d.numero} | HT: ${d.totalHT.toFixed(2)} | TTC: ${d.totalTTC.toFixed(2)} | Fiche: ${d.ficheId || 'ANONYME'}`);
        const valHT = d.totalHT || 0;
        const valTTC = d.totalTTC || 0;
        
        if (d.type === 'AVOIR') {
          totalHT -= valHT;
          totalTTC -= valTTC;
        } else {
          totalHT += valHT;
          totalTTC += valTTC;
        }
      }
    });

    console.log('---------------------------');
    console.log('RÉSULTAT DE L\'AUDIT :');
    console.log('TOTAL HT :', totalHT.toFixed(2));
    console.log('TOTAL TTC :', totalTTC.toFixed(2));
    console.log('NOMBRE DE DOCS :', count);
  } catch (err) {
    console.error('ERREUR AUDIT:', err);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

findTheGap();
