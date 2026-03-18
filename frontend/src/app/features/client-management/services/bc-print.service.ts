import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { CompanySettings } from '../../../shared/interfaces/company-settings.interface';

@Injectable({
  providedIn: 'root'
})
export class BcPrintService {
  constructor() {}

  printBonCommande(fiche: any, companySettings: CompanySettings | null, currentUser: any, referenceCommande: string, fournisseurName: string): void {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const logoUrl = companySettings?.logoUrl || `${window.location.origin}/assets/images/logo.png`;
    const companyName = companySettings?.name || 'OPTISASS';
    const now = new Date();
    const dateStr = now.toLocaleDateString('fr-FR');

    // Extract client info
    const clientName = (fiche as any).clientDisplayName || (fiche as any).clientName || 'Client';
    const clientPhone = (fiche as any).client?.telephone || '';
    const ficheNumero = (fiche as any).clientFicheNumero || 'N/A';

    // Determine content based on fiche type
    let orderDetailsHtml = '';
    
    if (fiche.type === 'MONTURE' || fiche.verres || fiche.monture) {
      // Monture/Verres Structure
      const ord = fiche.ordonnance || {};
      const od = ord.od || {};
      const og = ord.og || {};
      const verres = fiche.verres || {};
      const monture = fiche.monture || {};
      const montage = fiche.montage || {};

      const isDiff = verres.differentODOG;
      const matiereOD = isDiff ? (verres.matiereOD || '') : (verres.matiere || '');
      const matiereOG = isDiff ? (verres.matiereOG || '') : (verres.matiere || '');
      const indiceOD = isDiff ? (verres.indiceOD || '') : (verres.indice || '');
      const indiceOG = isDiff ? (verres.indiceOG || '') : (verres.indice || '');
      const marqueOD = isDiff ? (verres.marqueOD || '') : (verres.marque || '');
      const marqueOG = isDiff ? (verres.marqueOG || '') : (verres.marque || '');
      const traits = isDiff ? (verres.traitementOD || []) : (verres.traitement || []);

      orderDetailsHtml = `
        <div class="section-title">Détails des Verres</div>
        <table class="details-table">
            <thead>
                <tr>
                    <th>Oeil</th>
                    <th>Sphère</th>
                    <th>Cylindre</th>
                    <th>Axe</th>
                    <th>Add</th>
                    <th>EP</th>
                    <th>Haut.</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td class="eye-cell">OD</td>
                    <td>${od.sphere || '0.00'}</td>
                    <td>${od.cylindre || '-'}</td>
                    <td>${od.axe ? od.axe + '°' : '-'}</td>
                    <td>${od.addition || '-'}</td>
                    <td>${montage.ecartPupillaireOD || od.ep || '-'}</td>
                    <td>${montage.hauteurOD || '-'}</td>
                </tr>
                <tr>
                    <td class="eye-cell">OG</td>
                    <td>${og.sphere || '0.00'}</td>
                    <td>${og.cylindre || '-'}</td>
                    <td>${og.axe ? og.axe + '°' : '-'}</td>
                    <td>${og.addition || '-'}</td>
                    <td>${montage.ecartPupillaireOG || og.ep || '-'}</td>
                    <td>${montage.hauteurOG || '-'}</td>
                </tr>
            </tbody>
        </table>

        <div class="specs-box">
            <div class="specs-item"><strong>Type Verre OD:</strong> ${matiereOD} ${indiceOD} (${marqueOD})</div>
            <div class="specs-item"><strong>Type Verre OG:</strong> ${matiereOG} ${indiceOG} (${marqueOG})</div>
            <div class="specs-item"><strong>Traitements:</strong> ${Array.isArray(traits) ? traits.join(', ') : (traits || 'Standards')}</div>
        </div>

        <div class="section-title" style="margin-top: 20px;">Détails Monture</div>
        <div class="specs-box">
            <div class="specs-item"><strong>Référence:</strong> ${monture.reference || 'N/A'}</div>
            <div class="specs-item"><strong>Marque/Couleur:</strong> ${monture.marque || ''} ${monture.couleur || ''}</div>
            <div class="specs-item"><strong>Taille/Cerclage:</strong> ${monture.taille || ''} (${monture.cerclage || ''})</div>
        </div>
      `;
    } else if (fiche.type === 'LENTILLES' || fiche.lentilles) {
      // Lentilles Structure
      const ord = fiche.ordonnance || {};
      const od = ord.od || {};
      const og = ord.og || {};
      const lentilles = fiche.lentilles || {};
      const isDiff = lentilles.diffLentilles;

      orderDetailsHtml = `
        <div class="section-title">Détails des Lentilles</div>
        <table class="details-table">
            <thead>
                <tr>
                    <th>Oeil</th>
                    <th>Sphère</th>
                    <th>Cylindre</th>
                    <th>Axe</th>
                    <th>Add</th>
                    <th>Rayon</th>
                    <th>Diamètre</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td class="eye-cell">OD</td>
                    <td>${od.sphere || '0.00'}</td>
                    <td>${od.cylindre || '-'}</td>
                    <td>${od.axe ? od.axe + '°' : '-'}</td>
                    <td>${od.addition || '-'}</td>
                    <td>${lentilles.od?.rayon || '-'}</td>
                    <td>${lentilles.od?.diametre || '-'}</td>
                </tr>
                <tr>
                    <td class="eye-cell">OG</td>
                    <td>${og.sphere || '0.00'}</td>
                    <td>${og.cylindre || '-'}</td>
                    <td>${og.axe ? og.axe + '°' : '-'}</td>
                    <td>${og.addition || '-'}</td>
                    <td>${(isDiff ? lentilles.og?.rayon : lentilles.od?.rayon) || '-'}</td>
                    <td>${(isDiff ? lentilles.og?.diametre : lentilles.od?.diametre) || '-'}</td>
                </tr>
            </tbody>
        </table>
        <div class="specs-box">
            <div class="specs-item"><strong>Marque/Modèle OD:</strong> ${lentilles.od?.marque || ''} ${lentilles.od?.modele || ''}</div>
            <div class="specs-item"><strong>Marque/Modèle OG:</strong> ${(isDiff ? lentilles.og?.marque : lentilles.od?.marque) || ''} ${(isDiff ? lentilles.og?.modele : lentilles.od?.modele) || ''}</div>
        </div>
      `;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Bon de Commande - ${referenceCommande}</title>
        <style>
          @page { size: A4 portrait; margin: 0 !important; }
          body { 
              font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; 
              color: #1e293b; 
              padding: 15mm; 
              line-height: 1.4; 
              font-size: 10pt;
              margin: 0;
              -webkit-print-color-adjust: exact;
          }
          .header { 
              display: flex; 
              justify-content: space-between; 
              align-items: start; 
              border-bottom: 2px solid #0f172a; 
              padding-bottom: 15px; 
              margin-bottom: 20px; 
          }
          .logo-img { height: 60px; width: auto; }
          .company-info { text-align: right; }
          .company-info h1 { margin: 0; font-size: 18pt; font-weight: 900; color: #0f172a; text-transform: uppercase; }
          .doc-title { margin-top: 4px; font-size: 14pt; color: #3b82f6; font-weight: 800; letter-spacing: 1px; }
          
          .info-grid { display: grid; grid-template-columns: 1.2fr 1fr; gap: 20px; margin-bottom: 25px; }
          .info-card { background: #f8fafc; padding: 12px; border-radius: 6px; border: 1px solid #e2e8f0; }
          .info-card label { display: block; font-size: 8pt; color: #64748b; font-weight: 800; text-transform: uppercase; margin-bottom: 4px; }
          .info-card p { margin: 0; font-size: 11pt; font-weight: 700; }

          .section-title { 
              font-size: 9pt; 
              font-weight: 800; 
              margin-bottom: 10px; 
              color: #1e293b; 
              text-transform: uppercase; 
              border-bottom: 1px solid #e2e8f0;
              padding-bottom: 5px;
          }
          
          .details-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
          .details-table th { background: #f1f5f9; padding: 8px; font-size: 8pt; text-transform: uppercase; border: 1px solid #cbd5e1; }
          .details-table td { padding: 10px; border: 1px solid #cbd5e1; text-align: center; font-weight: 600; }
          .eye-cell { background: #eff6ff; color: #1d4ed8; width: 40px; font-weight: 800; }

          .specs-box { display: flex; flex-direction: column; gap: 6px; background: #fff; padding: 10px; border-radius: 4px; border: 1px dashed #cbd5e1; }
          .specs-item { font-size: 9.5pt; }

          .footer { 
              position: fixed; bottom: 15mm; left: 15mm; right: 15mm;
              display: flex; justify-content: space-between; border-top: 1px solid #e2e8f0; padding-top: 10px;
              color: #64748b; font-size: 8pt;
          }
          .signature-box { margin-top: 40px; text-align: right; }
          .signature-line { display: inline-block; width: 200px; border-top: 1px solid #0f172a; margin-top: 50px; padding-top: 5px; text-align: center; font-weight: 700; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo-box">
            <img src="${logoUrl}" class="logo-img" alt="Logo">
          </div>
          <div class="company-info">
            <h1>${companyName}</h1>
            <div class="doc-title">BON DE COMMANDE</div>
            <div style="font-size: 8pt; color: #64748b; margin-top: 4px;">Date: ${dateStr} | REF: ${referenceCommande}</div>
          </div>
        </div>

        <div class="info-grid">
          <div class="info-card">
            <label>Fournisseur</label>
            <p>${fournisseurName}</p>
          </div>
          <div class="info-card">
            <label>Client</label>
            <p>${clientName}</p>
            <div style="font-size: 8pt; color: #64748b; margin-top: 5px;">N° Fiche: ${ficheNumero}</div>
          </div>
        </div>

        <div class="content">
          ${orderDetailsHtml}
        </div>

        <div class="signature-box">
            <div class="signature-line">Cachet & Signature</div>
        </div>

        <div class="footer">
          <div>Edité par: ${currentUser?.displayName || currentUser?.fullName || 'Magasin'}</div>
          <div>${companyName} - Logiciel de gestion optique</div>
        </div>

        <script>
          window.onload = () => {
            window.print();
            setTimeout(() => { window.close(); }, 1000);
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  }

}
