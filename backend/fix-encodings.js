const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixEncodings() {
  console.log('--- Starting encoding fix script ---');

  const fixText = (text) => {
    if (!text) return text;
    let newText = text;
    // Replace Ch├¿que -> Chèque
    newText = newText.replace(/Ch\S+que/gi, 'Chèque');
    // Replace R├¿glement -> Règlement
    newText = newText.replace(/R\S+glement/g, 'Règlement');
    // Replace Esp├¿ces -> Espèces
    newText = newText.replace(/Esp\S+ces/gi, 'Espèces');
    // Replace D├⌐penses -> Dépenses
    newText = newText.replace(/D\S+penses/gi, 'Dépenses');
    return newText;
  };

  // 1. Depense
  const depenses = await prisma.depense.findMany();
  for (const d of depenses) {
    const newCategorie = fixText(d.categorie);
    const newMode = fixText(d.modePaiement);
    const newDesc = fixText(d.description);
    if (newCategorie !== d.categorie || newMode !== d.modePaiement || newDesc !== d.description) {
      console.log(`Fixing Depense ${d.id}`);
      await prisma.depense.update({
        where: { id: d.id },
        data: { categorie: newCategorie, modePaiement: newMode, description: newDesc }
      });
    }
  }

  // 2. Paiement
  const paiements = await prisma.paiement.findMany();
  for (const p of paiements) {
    const newMode = fixText(p.mode);
    if (newMode !== p.mode) {
      console.log(`Fixing Paiement ${p.id}`);
      await prisma.paiement.update({
        where: { id: p.id },
        data: { mode: newMode }
      });
    }
  }

  // 3. FactureFournisseur
  const facturesF = await prisma.factureFournisseur.findMany();
  for (const f of facturesF) {
    const newType = fixText(f.type);
    if (newType !== f.type) {
      console.log(`Fixing FactureFournisseur ${f.id}`);
      await prisma.factureFournisseur.update({
        where: { id: f.id },
        data: { type: newType }
      });
    }
  }

  // 4. OperationCaisse
  const operations = await prisma.operationCaisse.findMany();
  for (const o of operations) {
    const newMoyen = fixText(o.moyenPaiement);
    if (newMoyen !== o.moyenPaiement) {
      console.log(`Fixing OperationCaisse ${o.id}`);
      await prisma.operationCaisse.update({
        where: { id: o.id },
        data: { moyenPaiement: newMoyen }
      });
    }
  }

  // 5. Facture
  const factures = await prisma.facture.findMany();
  for (const f of factures) {
    const newType = fixText(f.type);
    if (newType !== f.type) {
      console.log(`Fixing Facture ${f.id}`);
      await prisma.facture.update({
        where: { id: f.id },
        data: { type: newType }
      });
    }
  }

  console.log('--- Finished encoding fix script ---');
}

fixEncodings().then(() => prisma.$disconnect()).catch(console.error);
