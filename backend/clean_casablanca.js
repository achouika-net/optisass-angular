const { PrismaClient } = require('@prisma/client');
const readline = require('readline');

const prisma = new PrismaClient();
const CENTRE_ID = 'cacd3b5c-96c6-49a0-ad5d-70b6560ce419';
const CENTRE_NOM = 'Centre Casablanca';

// Define the deletion steps in the strict dependency order (child tables first)
const STEPS = [
  {
    key: 'PAIEMENTS',
    name: 'Paiements',
    action: async () => {
      const result = await prisma.paiement.deleteMany({ where: { facture: { centreId: CENTRE_ID } } });
      return `Effacé ${result.count} Paiements.`;
    }
  },
  {
    key: 'FACTURES',
    name: 'Factures',
    action: async () => {
      const result = await prisma.facture.deleteMany({ where: { centreId: CENTRE_ID } });
      return `Effacé ${result.count} Factures.`;
    }
  },
  {
    key: 'BONS_LIVRAISON',
    name: 'Bons de Livraison',
    action: async (options = {}) => {
      if (options.nullifyClients) {
        const result = await prisma.bonLivraison.updateMany({
          where: { centreId: CENTRE_ID, clientId: { not: null } },
          data: { clientId: null }
        });
        return `Détaché ${result.count} clients des Bons de Livraison.`;
      } else {
        const result = await prisma.bonLivraison.deleteMany({ where: { centreId: CENTRE_ID } });
        return `Effacé ${result.count} Bons de Livraison.`;
      }
    }
  },
  {
    key: 'FICHES',
    name: 'Fiches clients',
    action: async () => {
      const result = await prisma.fiche.deleteMany({ where: { client: { centreId: CENTRE_ID } } });
      return `Effacé ${result.count} Fiches clients.`;
    }
  },
  {
    key: 'CLIENTS',
    name: 'Clients',
    action: async () => {
      const result = await prisma.client.deleteMany({ where: { centreId: CENTRE_ID } });
      return `Effacé ${result.count} Clients.`;
    }
  },
  {
    key: 'OPERATIONS_CAISSE',
    name: 'Opérations de Caisse',
    action: async () => {
      const result = await prisma.operationCaisse.deleteMany({ where: { journeeCaisse: { centreId: CENTRE_ID } } });
      return `Effacé ${result.count} Opérations de Caisse.`;
    }
  },
  {
    key: 'JOURNEES_CAISSE',
    name: 'Journées de Caisse',
    action: async () => {
      const result = await prisma.journeeCaisse.deleteMany({ where: { centreId: CENTRE_ID } });
      return `Effacé ${result.count} Journées de Caisse.`;
    }
  },
  {
    key: 'CAISSES',
    name: 'Caisses',
    action: async () => {
      const result = await prisma.caisse.deleteMany({ where: { centreId: CENTRE_ID } });
      return `Effacé ${result.count} Caisses.`;
    }
  },
  {
    key: 'DEPENSES',
    name: 'Dépenses',
    action: async () => {
      const result = await prisma.depense.deleteMany({ where: { centreId: CENTRE_ID } });
      return `Effacé ${result.count} Dépenses.`;
    }
  },
  {
    key: 'FACTURES_FOURNISSEURS',
    name: 'Factures Fournisseurs',
    action: async () => {
      const result = await prisma.factureFournisseur.deleteMany({ where: { centreId: CENTRE_ID } });
      return `Effacé ${result.count} Factures Fournisseurs.`;
    }
  },
  {
    key: 'ENTREPOTS',
    name: 'Entrepôts',
    action: async () => {
      const result = await prisma.entrepot.deleteMany({ where: { centreId: CENTRE_ID } });
      return `Effacé ${result.count} Entrepôts.`;
    }
  },
  {
    key: 'EMPLOYEES',
    name: 'Employés (Liens Centre)',
    action: async () => {
      const result = await prisma.employeeCentre.deleteMany({ where: { centreId: CENTRE_ID } });
      return `Effacé ${result.count} Liens Employé-Centre.`;
    }
  },
  {
    key: 'TRYONS',
    name: 'Virtual Try-ons',
    action: async () => {
      const result = await prisma.virtualTryon.deleteMany({ where: { centreId: CENTRE_ID } });
      return `Effacé ${result.count} Virtual Try-ons.`;
    }
  },
  {
    key: 'COMPTES_BANCAIRES',
    name: 'Comptes Bancaires',
    action: async () => {
      const result = await prisma.compteBancaire.deleteMany({ where: { centreId: CENTRE_ID } });
      return `Effacé ${result.count} Comptes Bancaires.`;
    }
  },
  {
    key: 'COMMISSIONS',
    name: 'Règles de Commission',
    action: async () => {
      const result = await prisma.commissionRule.deleteMany({ where: { centreId: CENTRE_ID } });
      return `Effacé ${result.count} Règles de Commission.`;
    }
  }
];

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function getCounts() {
  const counts = {};
  counts['CLIENTS'] = await prisma.client.count({ where: { centreId: CENTRE_ID } });
  counts['FICHES'] = await prisma.fiche.count({ where: { client: { centreId: CENTRE_ID } } });
  counts['ENTREPOTS'] = await prisma.entrepot.count({ where: { centreId: CENTRE_ID } });
  counts['EMPLOYEES'] = await prisma.employeeCentre.count({ where: { centreId: CENTRE_ID } });
  counts['FACTURES'] = await prisma.facture.count({ where: { centreId: CENTRE_ID } });
  counts['PAIEMENTS'] = await prisma.paiement.count({ where: { facture: { centreId: CENTRE_ID } } });
  counts['BONS_LIVRAISON'] = await prisma.bonLivraison.count({ where: { centreId: CENTRE_ID } });
  counts['CAISSES'] = await prisma.caisse.count({ where: { centreId: CENTRE_ID } });
  counts['JOURNEES_CAISSE'] = await prisma.journeeCaisse.count({ where: { centreId: CENTRE_ID } });
  counts['OPERATIONS_CAISSE'] = await prisma.operationCaisse.count({ where: { journeeCaisse: { centreId: CENTRE_ID } } });
  counts['DEPENSES'] = await prisma.depense.count({ where: { centreId: CENTRE_ID } });
  counts['FACTURES_FOURNISSEURS'] = await prisma.factureFournisseur.count({ where: { centreId: CENTRE_ID } });
  counts['TRYONS'] = await prisma.virtualTryon.count({ where: { centreId: CENTRE_ID } });
  counts['COMPTES_BANCAIRES'] = await prisma.compteBancaire.count({ where: { centreId: CENTRE_ID } });
  counts['COMMISSIONS'] = await prisma.commissionRule.count({ where: { centreId: CENTRE_ID } });
  return counts;
}

const MENU_OPTIONS = [
  { id: 1, label: 'Clients (et Fiches)', keys: ['FICHES', 'CLIENTS'] },
  { id: 2, label: 'Entrepôts (Stocks)', keys: ['ENTREPOTS'] },
  { id: 3, label: 'Employés (Liens Centre)', keys: ['EMPLOYEES'] },
  { id: 4, label: 'Factures et Paiements', keys: ['PAIEMENTS', 'FACTURES'] },
  { id: 5, label: 'Bons de Livraison', keys: ['BONS_LIVRAISON'] },
  { id: 6, label: 'Caisses, Journées et Opérations', keys: ['OPERATIONS_CAISSE', 'JOURNEES_CAISSE', 'CAISSES'] },
  { id: 7, label: 'Dépenses', keys: ['DEPENSES'] },
  { id: 8, label: 'Factures Fournisseurs', keys: ['FACTURES_FOURNISSEURS'] },
  { id: 9, label: 'Virtual Try-ons', keys: ['TRYONS'] },
  { id: 10, label: 'Comptes Bancaires', keys: ['COMPTES_BANCAIRES'] },
  { id: 11, label: 'Règles de Commission', keys: ['COMMISSIONS'] }
];

async function main() {
  console.log(`\n=== Nettoyage de données multi-sélection : ${CENTRE_NOM} (${CENTRE_ID}) ===\n`);
  
  const counts = await getCounts();
  
  console.log('Tables disponibles :');
  MENU_OPTIONS.forEach(opt => {
    let detail = '';
    if (opt.id === 1) detail = `${counts['CLIENTS']} clients, ${counts['FICHES'] || 0} fiches`;
    else if (opt.id === 4) detail = `${counts['FACTURES']} factures, ${counts['PAIEMENTS']} paiements`;
    else if (opt.id === 6) detail = `${counts['CAISSES']} caisses, ${counts['JOURNEES_CAISSE']} journées, ${counts['OPERATIONS_CAISSE']} ops`;
    else detail = `${counts[opt.keys[0]] || 0} lignes`;
    
    console.log(`[${opt.id}] ${opt.label} (${detail})`);
  });
  console.log(`[12] Tout effacer`);
  console.log(`[0] Quitter`);

  const choiceInput = await askQuestion('\nEntrez les numéros de votre choix séparés par des virgules (ex: 1,4,7) : ');
  
  if (choiceInput.trim() === '0') {
    console.log('Opération annulée.');
    rl.close();
    return;
  }

  let selectedKeys = new Set();
  let selectedIds = [];
  
  if (choiceInput.trim() === '12') {
    MENU_OPTIONS.forEach(opt => opt.keys.forEach(k => selectedKeys.add(k)));
    selectedIds = MENU_OPTIONS.map(opt => opt.id);
  } else {
    const parts = choiceInput.split(',').map(p => parseInt(p.trim(), 10));
    parts.forEach(id => {
      const opt = MENU_OPTIONS.find(o => o.id === id);
      if (opt) {
        opt.keys.forEach(k => selectedKeys.add(k));
        selectedIds.push(id);
      }
    });
  }

  if (selectedKeys.size === 0) {
    console.log('Aucun choix valide sélectionné.');
    rl.close();
    return;
  }

  // Dependency validation check
  // If CLIENTS is selected but not FACTURES (and we have factures)
  if (selectedKeys.has('CLIENTS') && !selectedKeys.has('FACTURES') && counts['FACTURES'] > 0) {
    console.log('\n--- ATTENTION ---');
    console.log(`Il y a ${counts['FACTURES']} factures associées à ces clients.`);
    console.log('Pour supprimer les clients, vous devez aussi supprimer leurs factures et paiements.');
    const forceFactures = await askQuestion('Voulez-vous ajouter la suppression des Factures et Paiements à votre sélection ? (oui/non) : ');
    if (forceFactures.toLowerCase() === 'oui' || forceFactures.toLowerCase() === 'o') {
      selectedKeys.add('FACTURES');
      selectedKeys.add('PAIEMENTS');
    } else {
      console.log('Opération interrompue pour éviter une erreur de base de données.');
      rl.close();
      return;
    }
  }

  let nullifyBLs = false;
  if (selectedKeys.has('CLIENTS') && !selectedKeys.has('BONS_LIVRAISON') && counts['BONS_LIVRAISON'] > 0) {
    console.log('\n--- ATTENTION ---');
    console.log(`Il y a ${counts['BONS_LIVRAISON']} Bons de livraison associés à ces clients.`);
    console.log('Options pour les Bons de livraison :');
    console.log('[1] Détacher les clients des BLs (met le lien client à NULL, garde les BLs)');
    console.log('[2] Supprimer aussi tous les Bons de livraison');
    console.log('[Annuler] Tout autre choix arrêtera le script.');
    const blChoice = await askQuestion('Votre choix (1 ou 2) : ');
    if (blChoice.trim() === '1') {
      nullifyBLs = true;
      selectedKeys.add('BONS_LIVRAISON');
    } else if (blChoice.trim() === '2') {
      selectedKeys.add('BONS_LIVRAISON');
    } else {
      console.log('Opération interrompue.');
      rl.close();
      return;
    }
  }

  console.log('\nVous avez sélectionné les actions suivantes :');
  STEPS.forEach(step => {
    if (selectedKeys.has(step.key)) {
      if (step.key === 'BONS_LIVRAISON' && nullifyBLs) {
        console.log(`- Détacher les clients de : ${step.name}`);
      } else {
        console.log(`- Supprimer les données de : ${step.name}`);
      }
    }
  });

  const confirm = await askQuestion(`\nÊtes-vous sûr de vouloir exécuter ces actions pour le ${CENTRE_NOM} ? (oui/non) : `);
  if (confirm.toLowerCase() !== 'oui' && confirm.toLowerCase() !== 'o' && confirm.toLowerCase() !== 'yes' && confirm.toLowerCase() !== 'y') {
    console.log('Opération annulée.');
    rl.close();
    return;
  }

  console.log('\nExécution en cours (dans l\'ordre des dépendances base de données)...');
  
  // Run steps in the predefined safe order
  for (const step of STEPS) {
    if (selectedKeys.has(step.key)) {
      try {
        let result;
        if (step.key === 'BONS_LIVRAISON') {
          result = await step.action({ nullifyClients: nullifyBLs });
        } else {
          result = await step.action();
        }
        console.log(`[SUCCÈS] ${step.name} : ${result}`);
      } catch (err) {
        console.error(`[ERREUR] ${step.name} : ${err.message}`);
      }
    }
  }

  rl.close();
}

main().catch(err => {
  console.error(err);
  rl.close();
}).finally(() => prisma.$disconnect());
