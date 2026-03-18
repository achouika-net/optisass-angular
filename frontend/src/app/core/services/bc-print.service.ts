import { Injectable } from '@angular/core';
import { TypeFiche } from '../../features/client-management/models/fiche-client.model';

@Injectable({
  providedIn: 'root'
})
export class BcPrintService {

  constructor() { }

  printBC(fiche: any, companySettings: any): void {
    if (!fiche) return;

    if (fiche.type === TypeFiche.MONTURE || fiche.type === 'MONTURE') {
      this.printVerresBC(fiche, companySettings);
    } else if (fiche.type === TypeFiche.LENTILLES || fiche.type === 'LENTILLES') {
      this.printLentillesBC(fiche, companySettings);
    } else {
      // Default fallback
      this.printVerresBC(fiche, companySettings);
    }
  }

  private printVerresBC(fiche: any, companySettings: any): void {
    const content = fiche.content || fiche;
    const ord = content.ordonnance || {};
    const verres = content.verres || {};
    const suivi = content.suiviCommande || {};
    const today = new Date().toLocaleDateString('fr-FR');
    const ref = suivi.referenceCommande || 'N/A';
    
    // Client Display Name
    const client = fiche.client || {};
    const clientDisplayName = client.raisonSociale 
        ? client.raisonSociale 
        : `${client.prenom || ''} ${client.nom || ''}`.trim() || 'Client';

    // Ordonnance rows
    const od = ord.od || {};
    const og = ord.og || {};

    // Verres details
    const isDiff = verres.differentODOG;
    const matiere = isDiff 
        ? `OD: ${verres.matiereOD || ''} | OG: ${verres.matiereOG || ''}`
        : (verres.matiere || '');
    const indice = isDiff
        ? `OD: ${verres.indiceOD || ''} | OG: ${verres.indiceOG || ''}`
        : (verres.indice || '');
    const traitements = isDiff
        ? `OD: ${(verres.traitementOD || []).join(', ') || '-'} | OG: ${(verres.traitementOG || []).join(', ') || '-'}`
        : ((verres.traitement || []).join(', ') || '-');
    
    const diametre = this.getDiametreACommander(content);

    // Dynamic Logo and Company Name
    const logoUrl = companySettings?.logoUrl || '/assets/images/logo.png';
    const companyName = companySettings?.name || 'OPTISASS';

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="fr">
        <head>
            <meta charset="UTF-8">
            <title>Bon de Commande Verres - ${ref}</title>
            <style>
                @page { size: A4 portrait; margin: 0 !important; }
                body { font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; padding: 15mm; line-height: 1.5; font-size: 10pt; background: #fff; }
                .header { display: flex; justify-content: space-between; align-items: start; border-bottom: 2px solid #0f172a; padding-bottom: 20px; margin-bottom: 30px; }
                .logo-box { display: flex; align-items: center; gap: 15px; }
                .logo-img { height: 75px; width: auto; object-fit: contain; }
                .company-info { text-align: right; }
                .company-info h1 { margin: 0; font-size: 22pt; font-weight: 950; color: #0f172a; text-transform: uppercase; letter-spacing: -0.5px; }
                .doc-title { margin-top: 5px; font-size: 16pt; color: #3b82f6; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; }
                .meta-info { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 35px; }
                .info-card { background: #fff; border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 18px 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.02); }
                .info-card label { display: block; font-size: 8.5pt; color: #64748b; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
                .info-card p { margin: 0; font-size: 13pt; font-weight: 800; color: #1e293b; }
                .section { margin-bottom: 35px; }
                .section-label { color: #94a3b8; font-size: 9pt; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 15px; border-bottom: 1px solid #f1f5f9; padding-bottom: 8px; }
                .lens-specs { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; column-gap: 40px; }
                .spec-item { padding: 12px 0; border-bottom: 1px solid #f1f5f9; }
                .spec-item label { display: block; font-size: 8pt; color: #64748b; font-weight: 700; text-transform: uppercase; margin-bottom: 4px; }
                .spec-item span { font-size: 10.5pt; font-weight: 600; color: #0f172a; }
                table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                th { text-align: left; font-size: 8.5pt; text-transform: uppercase; color: #94a3b8; padding: 12px 10px; font-weight: 800; border-bottom: 2px solid #e2e8f0; }
                td { padding: 15px 10px; border-bottom: 1px solid #f1f5f9; font-size: 11pt; font-weight: 500; }
                .eye-row { font-weight: 900; color: #3b82f6; width: 60px; }
                .val-cell { text-align: center; }
                .footer { text-align: center; margin-top: 60px; }
                .cachet-label { font-weight: 800; color: #475569; font-size: 10pt; margin-bottom: 15px; }
                .cachet-box { display: inline-block; width: 240px; height: 110px; border: 2px dashed #cbd5e1; border-radius: 16px; display: flex; align-items: center; justify-content: center; color: #cbd5e1; font-size: 8pt; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; }
                @media print { body { padding: 10mm 15mm; } }
            </style>
        </head>
        <body>
            <div class="header">
                <div class="logo-box"><img src="${logoUrl}" class="logo-img" alt="Logo"></div>
                <div class="company-info">
                    <h1>${companyName}</h1>
                    <div class="doc-title">Bon de Commande Verres</div>
                </div>
            </div>
            <div class="meta-info">
                <div class="info-card"><label>Fournisseur</label><p>${suivi.fournisseur || '-'}</p></div>
                <div class="info-card"><label>Référence BC / Date</label><p>${ref} — ${today}</p></div>
            </div>
            <div class="section">
                <div class="section-label">Caractéristiques des Verres</div>
                <div class="lens-specs">
                    <div class="spec-item"><label>Type de Verre</label><span>${verres.type || '-'}</span></div>
                    <div class="spec-item"><label>Matière</label><span>${matiere}</span></div>
                    <div class="spec-item"><label>Indice</label><span>${indice}</span></div>
                    <div class="spec-item"><label>Diamètre Utile</label><span>${diametre} mm</span></div>
                    <div class="spec-item" style="grid-column: span 2; border-bottom: none;"><label>Traitements</label><span>${traitements}</span></div>
                </div>
            </div>
            <div class="section">
                <div class="section-label">Prescription Technique</div>
                <table>
                    <thead>
                        <tr><th style="width: 80px;">Oeil</th><th class="val-cell">Sphère</th><th class="val-cell">Cylindre</th><th class="val-cell">Axe</th><th class="val-cell">Addition</th><th class="val-cell">Diamètre</th></tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td class="eye-row">OD</td>
                            <td class="val-cell">${od.sphere || '0.00'}</td>
                            <td class="val-cell">${od.cylindre || '0.00'}</td>
                            <td class="val-cell">${od.axe || '0'}°</td>
                            <td class="val-cell">${od.addition || '0.00'}</td>
                            <td class="val-cell">${diametre.split('/')?.[0] || diametre}</td>
                        </tr>
                        <tr>
                            <td class="eye-row">OG</td>
                            <td class="val-cell">${og.sphere || '0.00'}</td>
                            <td class="val-cell">${og.cylindre || '0.00'}</td>
                            <td class="val-cell">${og.axe || '0'}°</td>
                            <td class="val-cell">${og.addition || '0.00'}</td>
                            <td class="val-cell">${diametre.includes('/') ? diametre.split('/')?.[1] : diametre}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <div class="footer">
                <p class="cachet-label">Cachet du Magasin</p>
                <div style="display: flex; justify-content: center;"><div class="cachet-box">Emplacement Cachet</div></div>
            </div>
            <script>window.onload = function() { window.print(); setTimeout(() => window.close(), 1000); }<\/script>
        </body>
        </html>
    `);
    printWindow.document.close();
  }

  private printLentillesBC(fiche: any, companySettings: any): void {
    const content = fiche.content || fiche;
    const ord = content.prescription || content.ordonnance || {};
    const lentilles = content.lentilles || {};
    const suivi = content.suiviCommande || {};
    const today = new Date().toLocaleDateString('fr-FR');
    const ref = suivi.referenceCommande || 'N/A';
    
    const od = ord.od || {};
    const og = ord.og || {};
    const lOD = lentilles.od || {};
    const lOG = lentilles.og || {};

    const logoUrl = companySettings?.logoUrl || '/assets/images/logo.png';
    const companyName = companySettings?.name || 'OPTISASS';

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="fr">
        <head>
            <meta charset="UTF-8">
            <title>Bon de Commande Lentilles - ${ref}</title>
            <style>
                @page { size: A4 portrait; margin: 0 !important; }
                body { font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; padding: 15mm; line-height: 1.5; font-size: 10pt; background: #fff; }
                .header { display: flex; justify-content: space-between; align-items: start; border-bottom: 2px solid #0f172a; padding-bottom: 20px; margin-bottom: 30px; }
                .logo-box { display: flex; align-items: center; gap: 15px; }
                .logo-img { height: 75px; width: auto; object-fit: contain; }
                .company-info { text-align: right; }
                .company-info h1 { margin: 0; font-size: 22pt; font-weight: 950; color: #0f172a; text-transform: uppercase; letter-spacing: -0.5px; }
                .doc-title { margin-top: 5px; font-size: 16pt; color: #3b82f6; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; }
                .meta-info { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 35px; }
                .info-card { background: #fff; border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 18px 20px; }
                .info-card label { display: block; font-size: 8.5pt; color: #64748b; font-weight: 800; text-transform: uppercase; margin-bottom: 6px; }
                .info-card p { margin: 0; font-size: 13pt; font-weight: 800; color: #1e293b; }
                .section-label { color: #94a3b8; font-size: 9pt; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 15px; border-bottom: 1px solid #f1f5f9; padding-bottom: 8px; }
                table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                th { text-align: left; font-size: 8.5pt; text-transform: uppercase; color: #94a3b8; padding: 12px 10px; font-weight: 800; border-bottom: 2px solid #e2e8f0; }
                td { padding: 15px 10px; border-bottom: 1px solid #f1f5f9; font-size: 11pt; font-weight: 500; }
                .eye-row { font-weight: 900; color: #3b82f6; width: 60px; }
                .footer { text-align: center; margin-top: 60px; }
                .cachet-box { display: inline-block; width: 240px; height: 110px; border: 2px dashed #cbd5e1; border-radius: 16px; margin-top: 10px; }
            </style>
        </head>
        <body>
            <div class="header">
                <div class="logo-box"><img src="${logoUrl}" class="logo-img"></div>
                <div class="company-info">
                    <h1>${companyName}</h1>
                    <div class="doc-title">Bon de Commande Lentilles</div>
                </div>
            </div>
            <div class="meta-info">
                <div class="info-card"><label>Fournisseur</label><p>${suivi.fournisseur || '-'}</p></div>
                <div class="info-card"><label>Référence BC / Date</label><p>${ref} — ${today}</p></div>
            </div>
            <div class="section-label">Détails de la Commande (Lentilles)</div>
            <table>
                <thead><tr><th>Oeil</th><th>Produit (Marque / Modèle)</th><th>Sphère</th><th>Cyl / Axe</th><th>Rayon / Dia</th></tr></thead>
                <tbody>
                    <tr>
                        <td class="eye-row">OD</td>
                        <td>${lOD.marque || ''} ${lOD.modele || ''}</td>
                        <td>${od.sphere || '0.00'}</td>
                        <td>${od.cylindre || '0.00'} / ${od.axe || '0'}°</td>
                        <td>${lOD.rayon || '-'} / ${lOD.diametre || '-'}</td>
                    </tr>
                    <tr>
                        <td class="eye-row">OG</td>
                        <td>${(lentilles.diffLentilles ? lOG.marque : lOD.marque) || ''} ${(lentilles.diffLentilles ? lOG.modele : lOD.modele) || ''}</td>
                        <td>${og.sphere || '0.00'}</td>
                        <td>${og.cylindre || '0.00'} / ${og.axe || '0'}°</td>
                        <td>${(lentilles.diffLentilles ? lOG.rayon : lOD.rayon) || '-'} / ${(lentilles.diffLentilles ? lOG.diametre : lOD.diametre) || '-'}</td>
                    </tr>
                </tbody>
            </table>
            <div class="footer">
                <p style="font-weight: 800; color: #475569;">Cachet du Magasin</p>
                <div class="cachet-box"></div>
            </div>
            <script>window.onload = function() { window.print(); setTimeout(() => window.close(), 1000); }<\/script>
        </body>
        </html>
    `);
    printWindow.document.close();
  }

  private getDiametreACommander(content: any): string {
    const val = content.montage?.diametreEffectif;
    if (!val) return '-';

    const getStd = (d: number) => {
        const standards = [55, 60, 65, 70, 75, 80, 85];
        for (const s of standards) {
            if (s >= d) return s;
        }
        return 85;
    };

    if (typeof val === 'string' && val.includes('/')) {
        const parts = val.split('/');
        const od = parseFloat(parts[0]);
        const og = parseFloat(parts[1]);
        if (!isNaN(od) && !isNaN(og)) {
            return `${getStd(od + 2)}/${getStd(og + 2)}`;
        }
    }

    const num = parseFloat(val);
    if (!isNaN(num)) {
        return `${getStd(num + 2)}`;
    }

    return '-';
  }
}
