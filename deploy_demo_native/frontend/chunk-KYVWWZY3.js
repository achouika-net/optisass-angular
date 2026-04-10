import{la as x}from"./chunk-TSC6O4DD.js";var S=(()=>{class a{constructor(){}printBonCommande(e,n,g,f,h){let c=window.open("","_blank");if(!c)return;let v=n?.logoUrl||`${window.location.origin}/assets/images/logo.png`,b=n?.name||"OPTISASS",u=new Date().toLocaleDateString("fr-FR"),$=e.clientDisplayName||e.clientName||"Client",C=e.client?.telephone||"",y=e.clientFicheNumero||"N/A",p="";if(e.type==="MONTURE"||e.verres||e.monture){let r=e.ordonnance||{},o=r.od||{},i=r.og||{},t=e.verres||{},d=e.monture||{},l=e.montage||{},s=t.differentODOG,w=s?t.matiereOD||"":t.matiere||"",D=s?t.matiereOG||"":t.matiere||"",N=s?t.indiceOD||"":t.indice||"",q=s?t.indiceOG||"":t.indice||"",G=s?t.marqueOD||"":t.marque||"",z=s?t.marqueOG||"":t.marque||"",m=s?t.traitementOD||[]:t.traitement||[];p=`
        <div class="section-title">D\xE9tails des Verres</div>
        <table class="details-table">
            <thead>
                <tr>
                    <th>Oeil</th>
                    <th>Sph\xE8re</th>
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
                    <td>${o.sphere||"0.00"}</td>
                    <td>${o.cylindre||"-"}</td>
                    <td>${o.axe?o.axe+"\xB0":"-"}</td>
                    <td>${o.addition||"-"}</td>
                    <td>${l.ecartPupillaireOD||o.ep||"-"}</td>
                    <td>${l.hauteurOD||"-"}</td>
                </tr>
                <tr>
                    <td class="eye-cell">OG</td>
                    <td>${i.sphere||"0.00"}</td>
                    <td>${i.cylindre||"-"}</td>
                    <td>${i.axe?i.axe+"\xB0":"-"}</td>
                    <td>${i.addition||"-"}</td>
                    <td>${l.ecartPupillaireOG||i.ep||"-"}</td>
                    <td>${l.hauteurOG||"-"}</td>
                </tr>
            </tbody>
        </table>

        <div class="specs-box">
            <div class="specs-item"><strong>Type Verre OD:</strong> ${w} ${N} (${G})</div>
            <div class="specs-item"><strong>Type Verre OG:</strong> ${D} ${q} (${z})</div>
            <div class="specs-item"><strong>Traitements:</strong> ${Array.isArray(m)?m.join(", "):m||"Standards"}</div>
        </div>

        <div class="section-title" style="margin-top: 20px;">D\xE9tails Monture</div>
        <div class="specs-box">
            <div class="specs-item"><strong>R\xE9f\xE9rence:</strong> ${d.reference||"N/A"}</div>
            <div class="specs-item"><strong>Marque/Couleur:</strong> ${d.marque||""} ${d.couleur||""}</div>
            <div class="specs-item"><strong>Taille/Cerclage:</strong> ${d.taille||""} (${d.cerclage||""})</div>
        </div>
      `}else if(e.type==="LENTILLES"||e.lentilles){let r=e.ordonnance||{},o=r.od||{},i=r.og||{},t=e.lentilles||{},d=t.diffLentilles;p=`
        <div class="section-title">D\xE9tails des Lentilles</div>
        <table class="details-table">
            <thead>
                <tr>
                    <th>Oeil</th>
                    <th>Sph\xE8re</th>
                    <th>Cylindre</th>
                    <th>Axe</th>
                    <th>Add</th>
                    <th>Rayon</th>
                    <th>Diam\xE8tre</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td class="eye-cell">OD</td>
                    <td>${o.sphere||"0.00"}</td>
                    <td>${o.cylindre||"-"}</td>
                    <td>${o.axe?o.axe+"\xB0":"-"}</td>
                    <td>${o.addition||"-"}</td>
                    <td>${t.od?.rayon||"-"}</td>
                    <td>${t.od?.diametre||"-"}</td>
                </tr>
                <tr>
                    <td class="eye-cell">OG</td>
                    <td>${i.sphere||"0.00"}</td>
                    <td>${i.cylindre||"-"}</td>
                    <td>${i.axe?i.axe+"\xB0":"-"}</td>
                    <td>${i.addition||"-"}</td>
                    <td>${(d?t.og?.rayon:t.od?.rayon)||"-"}</td>
                    <td>${(d?t.og?.diametre:t.od?.diametre)||"-"}</td>
                </tr>
            </tbody>
        </table>
        <div class="specs-box">
            <div class="specs-item"><strong>Marque/Mod\xE8le OD:</strong> ${t.od?.marque||""} ${t.od?.modele||""}</div>
            <div class="specs-item"><strong>Marque/Mod\xE8le OG:</strong> ${(d?t.og?.marque:t.od?.marque)||""} ${(d?t.og?.modele:t.od?.modele)||""}</div>
        </div>
      `}let O=`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Bon de Commande - ${f}</title>
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
            <img src="${v}" class="logo-img" alt="Logo">
          </div>
          <div class="company-info">
            <h1>${b}</h1>
            <div class="doc-title">BON DE COMMANDE</div>
            <div style="font-size: 8pt; color: #64748b; margin-top: 4px;">Date: ${u} | REF: ${f}</div>
          </div>
        </div>

        <div class="info-grid">
          <div class="info-card">
            <label>Fournisseur</label>
            <p>${h}</p>
          </div>
          <div class="info-card">
            <label>Client</label>
            <p>${$}</p>
            <div style="font-size: 8pt; color: #64748b; margin-top: 5px;">N\xB0 Fiche: ${y}</div>
          </div>
        </div>

        <div class="content">
          ${p}
        </div>

        <div class="signature-box">
            <div class="signature-line">Cachet & Signature</div>
        </div>

        <div class="footer">
          <div>Edit\xE9 par: ${g?.displayName||g?.fullName||"Magasin"}</div>
          <div>${b} - Logiciel de gestion optique</div>
        </div>

        <script>
          window.onload = () => {
            window.print();
            setTimeout(() => { window.close(); }, 1000);
          };
        <\/script>
      </body>
      </html>
    `;c.document.write(O),c.document.close()}static{this.\u0275fac=function(n){return new(n||a)}}static{this.\u0275prov=x({token:a,factory:a.\u0275fac,providedIn:"root"})}}return a})();export{S as a};
