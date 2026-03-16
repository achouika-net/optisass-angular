const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixFacturesStatut() {
  console.log('🔍 Recherche des factures VALIDE/VALIDEE avec resteAPayer = 0...\n');

  // Trouver les factures bloquées (VALIDE ou VALIDEE, entièrement payées)
  const facturesBloquees = await prisma.facture.findMany({
    where: {
      OR: [
        { statut: 'VALIDE' },
        { statut: 'VALIDEE' },
      ],
      resteAPayer: 0,
      totalTTC: { gt: 0 }, // Exclure les factures à 0 DH (avoirs, etc.)
    },
    select: {
      id: true,
      numero: true,
      statut: true,
      totalTTC: true,
      resteAPayer: true,
      client: { select: { nom: true, prenom: true } },
    },
  });

  if (facturesBloquees.length === 0) {
    console.log('✅ Aucune facture bloquée trouvée. Tout est en ordre !');
    return;
  }

  console.log(`⚠️  ${facturesBloquees.length} facture(s) trouvée(s) à corriger:\n`);
  facturesBloquees.forEach(f => {
    const client = f.client ? `${f.client.prenom || ''} ${f.client.nom || ''}`.trim() : 'N/A';
    console.log(`   - ${f.numero} | ${client} | TTC: ${f.totalTTC} DH | Statut: ${f.statut}`);
  });

  // Confirmer la mise à jour
  console.log('\n🚀 Mise à jour du statut vers PAYEE...');
  const ids = facturesBloquees.map(f => f.id);

  const result = await prisma.facture.updateMany({
    where: { id: { in: ids } },
    data: { statut: 'PAYEE' },
  });

  console.log(`\n✅ ${result.count} facture(s) mises à jour avec succès → PAYEE`);
}

fixFacturesStatut()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
