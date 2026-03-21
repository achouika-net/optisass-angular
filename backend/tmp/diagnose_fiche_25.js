const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Searching for Fiche N° 25...');
  const fiche = await prisma.fiche.findFirst({
    where: { numero: 25 },
    include: {
      facture: {
        include: {
          lignes: true
        }
      },
      client: true
    }
  });

  if (!fiche) {
    console.log('Fiche N° 25 not found.');
    return;
  }

  console.log('Fiche found:', {
    id: fiche.id,
    numero: fiche.numero,
    statut: fiche.statut,
    type: fiche.type,
    clientId: fiche.clientId,
    clientNom: fiche.client?.nom + ' ' + fiche.client?.prenom
  });

  if (fiche.facture) {
    console.log('Associated Facture/Devis found:');
    console.log(JSON.stringify({
      id: fiche.facture.id,
      numero: fiche.facture.numero,
      type: fiche.facture.type,
      statut: fiche.facture.statut,
      totalTTC: fiche.facture.totalTTC,
      ficheId: fiche.facture.ficheId,
      createdAt: fiche.facture.createdAt,
      updatedAt: fiche.facture.updatedAt
    }, null, 2));
    
    // Check if lines are valid JSON or objects
    const lines = fiche.facture.lignes;
    console.log('Lignes count:', Array.isArray(lines) ? lines.length : (typeof lines === 'string' ? 'String' : typeof lines));
  } else {
    console.log('No associated Facture/Devis found for this Fiche.');
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
