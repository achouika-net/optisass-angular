const fs = require('fs');
const filePath = 'backend/src/features/imports/imports.service.ts';
let content = fs.readFileSync(filePath, 'utf8');

const searchStr = `        if (existingFacture) {
          const activeFacture = existingFacture as any;
          const totalPaye = (activeFacture.paiements || []).reduce((sum, p) => sum + p.montant, 0);
          const resteAPayer = Math.max(0, totalTTC - totalPaye);
          let finalStatut = activeFacture.statut;
          if (activeFacture.type === 'FACTURE' && resteAPayer <= 0) {
            finalStatut = 'PAYEE';
          } else if (activeFacture.type === 'FACTURE' && resteAPayer > 0 && activeFacture.statut === 'PAYEE') {
            finalStatut = 'VALIDE';
          }

          if (newFacturesMap.has(activeFacture.numero)) {
            // It's a newly created facture in this batch, update its values directly
            activeFacture.numero = invoiceNumero;
            activeFacture.type = 'FACTURE';
            if (dateEmission) activeFacture.dateEmission = dateEmission;
            activeFacture.totalTTC = totalTTC;
            activeFacture.totalHT = totalHT;
            activeFacture.totalTVA = totalTVA;
            activeFacture.resteAPayer = resteAPayer;
            activeFacture.statut = finalStatut;
          } else {
            const updateData: any = {
              numero: invoiceNumero,
              type: 'FACTURE',
              totalTTC,
              totalHT,
              totalTVA,
              resteAPayer,
              statut: finalStatut,
            };`;

const replaceStr = `        if (existingFacture) {
          const activeFacture = existingFacture as any;
          
          // PRESERVE existing amounts if they are already defined and > 0
          const finalTotalTTC = activeFacture.totalTTC > 0 ? Number(activeFacture.totalTTC) : totalTTC;
          const finalTotalHT = activeFacture.totalHT > 0 ? Number(activeFacture.totalHT) : totalHT;
          const finalTotalTVA = activeFacture.totalTVA > 0 ? Number(activeFacture.totalTVA) : totalTVA;

          const totalPaye = (activeFacture.paiements || []).reduce((sum, p) => sum + p.montant, 0);
          const resteAPayer = Math.max(0, finalTotalTTC - totalPaye);
          let finalStatut = activeFacture.statut;
          if (activeFacture.type === 'FACTURE' && resteAPayer <= 0) {
            finalStatut = 'PAYEE';
          } else if (activeFacture.type === 'FACTURE' && resteAPayer > 0 && activeFacture.statut === 'PAYEE') {
            finalStatut = 'VALIDE';
          }

          if (newFacturesMap.has(activeFacture.numero)) {
            // It's a newly created facture in this batch, update its values directly
            activeFacture.numero = invoiceNumero;
            activeFacture.type = 'FACTURE';
            if (dateEmission) activeFacture.dateEmission = dateEmission;
            activeFacture.totalTTC = finalTotalTTC;
            activeFacture.totalHT = finalTotalHT;
            activeFacture.totalTVA = finalTotalTVA;
            activeFacture.resteAPayer = resteAPayer;
            activeFacture.statut = finalStatut;
          } else {
            const updateData: any = {
              numero: invoiceNumero,
              type: 'FACTURE',
              totalTTC: finalTotalTTC,
              totalHT: finalTotalHT,
              totalTVA: finalTotalTVA,
              resteAPayer,
              statut: finalStatut,
            };`;

if(content.includes(searchStr)){
  content = content.replace(searchStr, replaceStr);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log("Successfully patched imports.service.ts");
} else {
  console.log("Could not find the target string to replace");
}
