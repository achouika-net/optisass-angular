import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

function isReferenceMatch(desc: string, ref: string): boolean {
  if (!ref || !desc) return false;
  const cleanDesc = desc.replace(/[\s\-_]/g, '').toLowerCase();
  const cleanRef = ref.replace(/[\s\-_]/g, '').toLowerCase();
  if (cleanDesc.includes(cleanRef) || cleanRef.includes(cleanDesc)) return true;
  const refNoZeros = cleanRef.replace(/^0+/, '');
  if (refNoZeros.length >= 4 && cleanDesc.includes(refNoZeros)) return true;
  return false;
}

async function main() {
  const transactions = await prisma.transactionBancaire.findMany({
    where: { statutRapprochement: 'NON_RAPPROCHE' }
  });

  console.log(`Found ${transactions.length} non-reconciled transactions.`);

  const payments = await prisma.paiement.findMany({
    where: { statut: { in: ['REMIS_EN_BANQUE', 'EN_ATTENTE'] } }
  });

  const echeances = await prisma.echeancePaiement.findMany({
    where: { statut: { in: ['REMIS_EN_BANQUE', 'EN_ATTENTE', 'VALIDEE'] } }
  });

  const depenses = await prisma.depense.findMany({
    where: {
      statut: { in: ['REMIS_EN_BANQUE', 'EN_ATTENTE', 'VALIDEE'] },
      transactionBancaireId: null
    }
  });

  console.log(`Pool: ${payments.length} payments, ${echeances.length} echeances, ${depenses.length} depenses.`);

  for (const t of transactions) {
    if (t.type === 'CREDIT') {
      // Look for payments
      const matches = payments.filter(p => {
        const amtMatch = Math.abs(p.montant - t.montant) < 0.1;
        const refMatch = p.reference ? isReferenceMatch(t.description, p.reference) : false;
        return amtMatch && refMatch;
      });

      if (matches.length > 0) {
        console.log(`[CREDIT MATCH] Transaction: "${t.description}" (${t.montant} MAD) matched with Payment Ref: "${matches[0].reference}" (${matches[0].montant} MAD)`);
      } else {
        // Fallback: exact amount match when only 1 candidate exists
        const amtMatches = payments.filter(p => Math.abs(p.montant - t.montant) < 0.1);
        if (amtMatches.length === 1) {
          console.log(`[CREDIT AMOUNT-ONLY MATCH] Transaction: "${t.description}" (${t.montant} MAD) matched with Payment Ref: "${amtMatches[0].reference}" (${amtMatches[0].montant} MAD)`);
        }
      }
    } else if (t.type === 'DEBIT') {
      // Look for echeances
      const echMatches = echeances.filter(e => {
        const amtMatch = Math.abs(e.montant - t.montant) < 0.1;
        const refMatch = e.reference ? isReferenceMatch(t.description, e.reference) : false;
        return amtMatch && refMatch;
      });

      // Look for depenses
      const depMatches = depenses.filter(d => {
        const amtMatch = Math.abs(d.montant - t.montant) < 0.1;
        const refMatch = d.reference ? isReferenceMatch(t.description, d.reference) : false;
        return amtMatch && refMatch;
      });

      if (echMatches.length > 0) {
        console.log(`[DEBIT ECHEANCE MATCH] Transaction: "${t.description}" (${t.montant} MAD) matched with Echeance Ref: "${echMatches[0].reference}" (${echMatches[0].montant} MAD)`);
      } else if (depMatches.length > 0) {
        console.log(`[DEBIT DEPENSE MATCH] Transaction: "${t.description}" (${t.montant} MAD) matched with Depense Ref: "${depMatches[0].reference}" (${depMatches[0].montant} MAD)`);
      } else {
        // Fallback: exact amount matches
        const amtEchMatches = echeances.filter(e => Math.abs(e.montant - t.montant) < 0.1);
        const amtDepMatches = depenses.filter(d => Math.abs(d.montant - t.montant) < 0.1);
        if (amtEchMatches.length === 1 && amtDepMatches.length === 0) {
          console.log(`[DEBIT ECHEANCE AMOUNT-ONLY MATCH] Transaction: "${t.description}" (${t.montant} MAD) matched with Echeance Ref: "${amtEchMatches[0].reference}" (${amtEchMatches[0].montant} MAD)`);
        } else if (amtDepMatches.length === 1 && amtEchMatches.length === 0) {
          console.log(`[DEBIT DEPENSE AMOUNT-ONLY MATCH] Transaction: "${t.description}" (${t.montant} MAD) matched with Depense Ref: "${amtDepMatches[0].reference}" (${amtDepMatches[0].montant} MAD)`);
        }
      }
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
