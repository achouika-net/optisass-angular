import { Injectable, Logger } from '@nestjs/common';
import PDFDocument from 'pdfkit';

@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);

  async generatePurchaseOrder(data: {
    bcNumber: string;
    date: Date;
    supplierName: string;
    clientName: string;
    designation: string;
    prescription: {
      od: { sphere: string; cylindre: string; axe: string; addition?: string; ep?: string; diametre?: string; haut?: string; diamUtile?: string };
      og: { sphere: string; cylindre: string; axe: string; addition?: string; ep?: string; diametre?: string; haut?: string; diamUtile?: string };
    };
    ficheNumber?: string;
    lensDetails?: {
      od: string;
      og: string;
      treatments: string;
      indiceOD?: string;
      indiceOG?: string;
      matiereOD?: string;
      matiereOG?: string;
      typeVerre?: string;
    };
    frameDetails?: {
      reference: string;
      marque: string;
      taille: string;
    };
    technicalNote?: {
      mesure: string;
      safety: number;
      intermediate: string;
      ordered: string;
    };
    branding?: {
      companyName: string;
      logoUrl?: string;
      cachetUrl?: string;
    };
    observations?: string;
    }): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            console.log('📄 [PdfService] >>> GENERATING PURCHASE ORDER PDF - VERSION 2.2 (FIXED AXE/DIAM) <<<');
            const doc = new PDFDocument({ margin: 40, size: 'A4' });
            const chunks: Buffer[] = [];

            doc.on('data', (chunk: Buffer) => chunks.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', (err) => reject(err instanceof Error ? err : new Error(String(err))));

            const primaryColor = '#0f172a'; // Dark Navy
            const accentColor = '#3b82f6';  // Blue
            const greyText = '#475569';
            const lightBorder = '#e2e8f0';

            // --- HEADER ---
            const hasLogo = !!data.branding?.logoUrl;
            if (hasLogo && data.branding?.logoUrl) {
                try {
                    const base64Data = data.branding.logoUrl.includes('base64,') 
                        ? data.branding.logoUrl.split('base64,')[1] 
                        : data.branding.logoUrl;
                    doc.image(Buffer.from(base64Data, 'base64'), 40, 40, { height: 60 });
                } catch (e) {
                    this.logger.error(`Failed to embed logo: ${e.message}`);
                }
            }

            const headerX = hasLogo ? 300 : 40;
            doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(24).text(data.branding?.companyName?.toUpperCase() || 'OPTISASS', headerX, 40, { align: hasLogo ? 'right' : 'left' });
            doc.fillColor(accentColor).font('Helvetica-Bold').fontSize(16).text('BON DE COMMANDE VERRES', headerX, 68, { align: hasLogo ? 'right' : 'left' });
            doc.fillColor(greyText).font('Helvetica').fontSize(10).text(`Date: ${data.date.toLocaleDateString('fr-FR')} | Fournisseur: ${data.supplierName}`, headerX, 88, { align: hasLogo ? 'right' : 'left' });

            doc.moveDown(4);
            const startY = 130;

            // --- META INFO CARDS (Exact match with Frontend) ---
            const drawCard = (x: number, y: number, w: number, h: number, label: string, value: string, subText?: string) => {
                doc.rect(x, y, w, h).stroke(lightBorder);
                // doc.fillAndStroke('#fff', lightBorder); // Background white
                doc.fillColor(greyText).font('Helvetica-Bold').fontSize(8.5).text(label.toUpperCase(), x + 15, y + 15);
                doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(13).text(value, x + 15, y + 30);
                if (subText) {
                    doc.fillColor(greyText).font('Helvetica').fontSize(9).text(subText, x + 15, y + 48);
                }
            };

            drawCard(40, startY, 250, 70, 'Client & Dossier', data.clientName, `Fiche N°: ${data.ficheNumber || data.bcNumber.split('-').pop()}`);
            drawCard(305, startY, 250, 70, 'Commande & Date', data.bcNumber, `Date: ${data.date.toLocaleDateString('fr-FR')} | Fournisseur: ${data.supplierName}`);

            const sectionY = startY + 95;

            // --- LENS CHARACTERISTICS (Exact match with Frontend Grid) ---
            doc.fillColor('#94a3b8').font('Helvetica-Bold').fontSize(9).text('CARACTÉRISTIQUES DES VERRES', 40, sectionY);
            doc.moveTo(40, sectionY + 12).lineTo(555, sectionY + 12).stroke('#f1f5f9');

            const gridY = sectionY + 25;
            const drawSpec = (x: number, y: number, label: string, val: string, width: number = 240) => {
                doc.fillColor('#64748b').font('Helvetica-Bold').fontSize(8).text(label.toUpperCase(), x, y);
                doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(10.5).text(val, x, y + 12);
                doc.moveTo(x, y + 28).lineTo(x + width, y + 28).stroke('#f1f5f9');
            };

            drawSpec(40, gridY, 'Type de Verre', data.lensDetails?.typeVerre || '-');
            drawSpec(305, gridY, 'Matière', data.lensDetails?.matiereOD === data.lensDetails?.matiereOG ? (data.lensDetails?.matiereOD || '-') : `OD: ${data.lensDetails?.matiereOD} | OG: ${data.lensDetails?.matiereOG}`);
            
            const formatDiam = (d: any) => (d && d !== '-' ? `${d} mm` : d || '-');
            
            const diamUtileLabel = data.prescription.od.diamUtile === data.prescription.og.diamUtile
                ? formatDiam(data.prescription.od.diamUtile)
                : `OD: ${formatDiam(data.prescription.od.diamUtile)} | OG: ${formatDiam(data.prescription.og.diamUtile)}`;

            drawSpec(40, gridY + 45, 'INDICE', data.lensDetails?.indiceOD === data.lensDetails?.indiceOG ? (data.lensDetails?.indiceOD || '-') : `OD: ${data.lensDetails?.indiceOD} | OG: ${data.lensDetails?.indiceOG}`, 240);
            drawSpec(305, gridY + 45, 'DIAMÈTRE UTILE', diamUtileLabel);
            
            drawSpec(40, gridY + 90, 'TRAITEMENTS', data.lensDetails?.treatments || 'STANDARD', 240);
            // Empty space for layout balance if needed or move things around

            const tableTop = gridY + 145;
            doc.fillColor('#94a3b8').font('Helvetica-Bold').fontSize(9).text('PRESCRIPTION TECHNIQUE', 40, tableTop - 15);

            // --- TECHNICAL TABLE (Exact columns and colors) ---
            const colWidths = [45, 80, 80, 80, 80, 75, 75];
            const headers = ['OEIL', 'SPHÈRE', 'CYLINDRE', 'AXE', 'ADDITION', 'EP', 'HAUT.'];

            doc.moveTo(40, tableTop).lineTo(555, tableTop).stroke('#e2e8f0');
            doc.fillColor('#94a3b8').font('Helvetica-Bold').fontSize(8.5);
            let curX = 40;
            headers.forEach((h, i) => {
                doc.text(h, curX, tableTop + 8, { width: colWidths[i], align: i === 0 ? 'left' : 'center' });
                curX += colWidths[i];
            });
            doc.moveTo(40, tableTop + 25).lineTo(555, tableTop + 25).stroke('#e2e8f0');

            const drawRow = (label: string, p: any, y: number) => {
                doc.fillColor(accentColor).font('Helvetica-Bold').fontSize(11).text(label, 40, y + 10);
                
                const axe = String(p.axe || '0');
                const axeStr = axe.includes('°') ? axe : `${axe}°`;

                doc.fillColor(primaryColor).font('Helvetica').fontSize(11);
                doc.text(p.sphere || '+0.00', 85, y + 10, { width: 80, align: 'center' });
                doc.text(p.cylindre || '0.00', 165, y + 10, { width: 80, align: 'center' });
                doc.text(axeStr, 245, y + 10, { width: 80, align: 'center' });
                doc.text(p.addition || '+0.00', 325, y + 10, { width: 80, align: 'center' });
                doc.text(p.ep || '-', 405, y + 10, { width: 75, align: 'center' });
                doc.text(p.haut || '-', 480, y + 10, { width: 75, align: 'center' });
                
                doc.moveTo(40, y + 30).lineTo(555, y + 30).stroke('#f1f5f9');
            };

            drawRow('OD', data.prescription.od, tableTop + 25);
            drawRow('OG', data.prescription.og, tableTop + 55);

            doc.moveDown(4);

            // --- SIGNATURE AREA ---
            const signY = 650;
            doc.fillColor('#475569').font('Helvetica-Bold').fontSize(10).text('Cachet et Signature', 40, signY, { width: 515, align: 'center' });

            if (data.branding?.cachetUrl) {
                try {
                    const base64Cachet = data.branding.cachetUrl.includes('base64,') 
                        ? data.branding.cachetUrl.split('base64,')[1] 
                        : data.branding.cachetUrl;
                    doc.image(Buffer.from(base64Cachet, 'base64'), 370, signY + 30, { width: 150 });
                } catch (e) {
                    this.logger.error(`Failed to embed cachet: ${e.message}`);
                }
            }

            // --- OBSERVATIONS / NOTES ---
            if (data.observations && data.observations.trim() !== '') {
                const obsY = signY - 80;
                doc.fillColor('#f8fafc').rect(40, obsY, 515, 60).fill();
                doc.rect(40, obsY, 515, 60).stroke(lightBorder);
                doc.fillColor(accentColor).font('Helvetica-Bold').fontSize(9).text('NOTES / REMARQUES', 55, obsY + 12);
                doc.fillColor(primaryColor).font('Helvetica').fontSize(10).text(data.observations, 55, obsY + 28, { width: 485, align: 'left' });
            }

            // --- FOOTER ---
            doc.fontSize(8).fillColor(greyText).text('OptiSaas - Solution de gestion optique', 40, 785);
            doc.text(`Document généré le ${new Date().toLocaleString('fr-FR')}`, 400, 785, { align: 'right' });

            doc.end();
        });
    }

    async generateFicheMontagePdf(data: {
        bcNumber: string,
        date: Date,
        clientName: string,
        magasinName: string,
        prescription: {
            od: { sphere: string, cylindre: string, axe: string, addition: string },
            og: { sphere: string, cylindre: string, axe: string, addition: string },
        },
        centrage: {
            od: { dp: string, ht: string, diamUtile: string },
            og: { dp: string, ht: string, diamUtile: string },
        },
        verres: {
            od: string,
            og: string,
            treatments: string,
        },
        diametreConseille: string,
        imageMontureUrl?: string,
        virtualCenteringUrl?: string,
        preconisationsIA?: {
            od: string,
            og: string,
        },
        technicalNote?: {
            mesure: string;
            safety: number;
            intermediate: string;
            ordered: string;
        },
        branding?: {
            companyName: string,
            logoUrl?: string,
            cachetUrl?: string,
        },
        ficheNumber?: string;
        observations?: string;
    }): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            console.log('📄 [PdfService] >>> GENERATING FICHE MONTAGE PDF - VERSION 2.2 (FIXED AXE/DIAM/IMAGE) <<<');
            const doc = new PDFDocument({ margin: 40, size: 'A4' });
            const chunks: Buffer[] = [];
            doc.on('data', (chunk: Buffer) => chunks.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', (err) => reject(err instanceof Error ? err : new Error(String(err))));

            const primaryColor = '#1e293b';
            const accentColor = '#4f46e5';
            const techColor = '#2563eb';
            const greyText = '#64748b';
            const lightBorder = '#cbd5e1'; // Slightly darker for full table borders like in screenshot

            // --- HEADER (RIGHT ALIGNED) ---
            const hasLogo = !!data.branding?.logoUrl;
            if (hasLogo && data.branding?.logoUrl) {
                try {
                    const base64Data = data.branding.logoUrl.includes('base64,')
                        ? data.branding.logoUrl.split('base64,')[1]
                        : data.branding.logoUrl;
                    doc.image(Buffer.from(base64Data, 'base64'), 30, 30, { height: 40 });
                } catch (e) {
                    this.logger.error(`Failed to embed logo: ${e.message}`);
                }
            }

            const headerX = 300;
            doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(16).text(data.branding?.companyName?.toUpperCase() || 'OPTISAAS', headerX, 25, { align: 'right', width: 265 });
            doc.fillColor(accentColor).font('Helvetica-Bold').fontSize(11).text('FICHE DE MONTAGE TECHNIQUE', headerX, 45, { align: 'right', width: 265 });
            doc.fillColor(greyText).font('Helvetica').fontSize(8).text(`REF: ${data.bcNumber} | LE: ${data.date.toLocaleDateString('fr-FR')}`, headerX, 60, { align: 'right', width: 265 });

            // Horizontal thick dark blue separator
            doc.moveTo(30, 75).lineTo(565, 75).lineWidth(2).stroke(primaryColor);
            doc.lineWidth(1); // reset

            // --- CLIENT INFO BAR ---
            const rowY = 90;
            doc.rect(30, rowY, 535, 25).fill('#f8fafc');
            doc.rect(30, rowY, 535, 25).stroke(lightBorder);
            doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(9).text('CLIENT: ', 45, rowY + 8, { continued: true }).font('Helvetica').text(data.clientName);
            doc.font('Helvetica-Bold').text('MAGASIN: ', 360, rowY + 8, { continued: true }).font('Helvetica').text(data.magasinName || 'OptiSaas');

            // --- TABLES SECTION ---
            const tablesY = 135;

            // Updated Heading Style: Blue dot
            const drawHeading = (x: number, y: number, text: string) => {
                doc.circle(x + 3, y + 4, 2.5).fill(accentColor);
                doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(9).text(text, x + 10, y);
            };

            drawHeading(30, tablesY, 'CORRECTION ORDONNANCE');
            
            const tableWidth = 260;
            const drawTechTable = (x: number, y: number, headers: string[], rows: any[]) => {
                const cw = [35, 55, 55, 55, 60];
                
                let curX = x;
                // Header row
                doc.rect(x, y + 15, tableWidth, 20).stroke(lightBorder);
                headers.forEach((h, i) => {
                    doc.rect(curX, y + 15, cw[i], 20).stroke(lightBorder);
                    doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(7).text(h, curX, y + 22, { width: cw[i], align: 'center' });
                    curX += cw[i];
                });

                // Data rows
                rows.forEach((r, idx) => {
                    const ry = y + 35 + idx * 22;
                    curX = x;
                    
                    doc.rect(x, ry, tableWidth, 22).stroke(lightBorder);
                    
                    const axe = String(r.c3 || '0');
                    const axeStr = axe.includes('°') ? axe : `${axe}°`;

                    // Col 1 (Oeil)
                    doc.rect(curX, ry, cw[0], 22).stroke(lightBorder);
                    doc.fillColor(techColor).font('Helvetica-Bold').fontSize(9).text(r.label, curX, ry + 6, { width: cw[0], align: 'center' });
                    curX += cw[0];

                    // Other Cols
                    const dataCols = [r.c1, r.c2, axeStr, r.c4];
                    dataCols.forEach((colData, ci) => {
                        doc.rect(curX, ry, cw[ci+1], 22).stroke(lightBorder);
                        doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(9).text(colData, curX, ry + 6, { width: cw[ci+1], align: 'center' });
                        curX += cw[ci+1];
                    });
                });
            };

            drawTechTable(30, tablesY, ['OEIL', 'SPHÈRE', 'CYLINDRE', 'AXE', 'ADD'], [
                { label: 'OD', c1: data.prescription.od.sphere, c2: data.prescription.od.cylindre, c3: data.prescription.od.axe, c4: data.prescription.od.addition },
                { label: 'OG', c1: data.prescription.og.sphere, c2: data.prescription.og.cylindre, c3: data.prescription.og.axe, c4: data.prescription.og.addition }
            ]);

            // Centrage Table (Right)
            drawHeading(305, tablesY, 'PARAMÈTRES CENTRAGE');
            const drawCentrageTable = (x: number, y: number, headers: string[], rows: any[]) => {
                const cw = [35, 75, 75, 75];
                
                let curX = x;
                // Header row
                doc.rect(x, y + 15, tableWidth, 20).stroke(lightBorder);
                headers.forEach((h, i) => {
                    doc.rect(curX, y + 15, cw[i], 20).stroke(lightBorder);
                    doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(7).text(h, curX, y + 22, { width: cw[i], align: 'center' });
                    curX += cw[i];
                });

                // Data rows
                rows.forEach((r, idx) => {
                    const ry = y + 35 + (idx * 22);
                    curX = x;

                    doc.rect(x, ry, tableWidth, 22).stroke(lightBorder);
                    
                    // Col 1
                    doc.rect(curX, ry, cw[0], 22).stroke(lightBorder);
                    doc.fillColor(techColor).font('Helvetica-Bold').fontSize(9).text(r.label, curX, ry + 6, { width: cw[0], align: 'center' });
                    curX += cw[0];

                    // Other cols
                    const dataCols = [r.c1, r.c2, r.c3];
                    dataCols.forEach((colData, ci) => {
                        doc.rect(curX, ry, cw[ci+1], 22).stroke(lightBorder);
                        doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(9).text(colData, curX, ry + 6, { width: cw[ci+1], align: 'center' });
                        curX += cw[ci+1];
                    });
                });
            };

            const formatCentrageValue = (v: any) => (v && v !== '-' && !String(v).includes('mm') ? `${v} mm` : v || '-');
            drawCentrageTable(305, tablesY, ['OEIL', 'DP', 'HT (H)', 'DIAM. UTILE'], [
                { 
                    label: 'OD', 
                    c1: formatCentrageValue(data.centrage.od.dp), 
                    c2: formatCentrageValue(data.centrage.od.ht), 
                    c3: formatCentrageValue(data.centrage.od.diamUtile) 
                },
                { 
                    label: 'OG', 
                    c1: formatCentrageValue(data.centrage.og.dp), 
                    c2: formatCentrageValue(data.centrage.og.ht), 
                    c3: formatCentrageValue(data.centrage.og.diamUtile) 
                }
            ]);

            // --- LENS INFO SECTION ---
            const lensY = 230;
            doc.rect(30, lensY, 340, 75).stroke(lightBorder);
            doc.fillColor('#8b5cf6').font('Helvetica-Bold').fontSize(9).text('TYPES DE VERRES SÉLECTIONNÉS', 40, lensY + 10);
            doc.fillColor(primaryColor).fontSize(8).font('Helvetica-Bold').text('OD: ', 40, lensY + 25, { continued: true }).font('Helvetica').text(data.verres.od);
            doc.font('Helvetica-Bold').text('OG: ', 40, lensY + 40, { continued: true }).font('Helvetica').text(data.verres.og);
            doc.fillColor(greyText).fontSize(8).font('Helvetica').text(`TRAITEMENTS: `, 40, lensY + 55, { continued: true }).fillColor(greyText).text(data.verres.treatments || 'Anti-lumière bleue (Blue Cut)');

            doc.rect(380, lensY, 185, 75).stroke(lightBorder);
            doc.fillColor(greyText).font('Helvetica-Bold').fontSize(8).text('DIAMÈTRE À COMMANDER', 390, lensY + 20, { align: 'center', width: 165 });
            doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(26).text(data.diametreConseille || '65/65', 380, lensY + 40, { width: 185, align: 'center' });

            // --- ADVICE BLUE BOX ---
            let currentY = lensY + 85;
            if (data.technicalNote && data.technicalNote.ordered) {
                const isWarning = data.technicalNote.safety < 0;
                const bgColor = isWarning ? '#fef2f2' : '#eff6ff';
                const textColor = isWarning ? '#dc2626' : '#2563eb';
                const strokeColor = isWarning ? '#fca5a5' : '#bfdbfe';

                const adviceText = `Diamètre utile est ${data.technicalNote.mesure} mm. On ajoute 3 mm marge d'erreur ${data.technicalNote.intermediate} mm (+3mm), on commande ${data.technicalNote.ordered} mm`;
                
                doc.rect(30, currentY, 535, 20).fillAndStroke(bgColor, strokeColor);
                doc.fillColor(textColor).font('Helvetica-Bold').fontSize(8.5).text(adviceText, 30, currentY + 6, { width: 535, align: 'center' });
                currentY += 30;
            }

            // --- IMAGES SECTION (Centered Canvas) ---
            doc.rect(30, currentY, 535, 200).stroke(lightBorder);
            doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(9).text('APERÇU CONFIGURATION MONTURE', 40, currentY + 10);
            
            if (data.virtualCenteringUrl) {
                try {
                    const base64Centring = data.virtualCenteringUrl.includes('base64,') ? data.virtualCenteringUrl.split('base64,')[1] : data.virtualCenteringUrl;
                    doc.image(Buffer.from(base64Centring, 'base64'), 132, currentY + 30, { fit: [300, 160], align: 'center', valign: 'center' });
                } catch (e) {
                    doc.fillColor(greyText).fontSize(8).text('Image centrage non disponible', 30, currentY + 100, { width: 535, align: 'center' });
                }
            }
            currentY += 215;

            // --- IA RECOMMENDATIONS ---
            drawHeading(30, currentY, 'PRÉCONISATIONS IA (OPTIMISATION ÉPAISSEUR)');
            
            const drawIABox = (x: number, y: number, side: string, val: string) => {
                doc.rect(x, y + 15, 260, 25).stroke(lightBorder);
                doc.fillColor(greyText).font('Helvetica').fontSize(8).text('Configuration patient: ', x + 10, y + 23, { continued: true }).fillColor(primaryColor).text(val);
                
                // Blue badge on right side of the box
                doc.rect(x + 230, y + 19, 20, 16).fillAndStroke('#eff6ff', '#bfdbfe');
                doc.fillColor(techColor).font('Helvetica-Bold').fontSize(7).text(side, x + 230, y + 24, { width: 20, align: 'center' });
            };

            const boxY = currentY + 5;
            drawIABox(30, boxY, 'OD', data.preconisationsIA?.od || '-');
            drawIABox(305, boxY, 'OG', data.preconisationsIA?.og || '-');

            currentY += 50;

            // --- OBSERVATIONS / NOTES ---
            if (data.observations) {
                const obsY = currentY;
                doc.moveTo(30, obsY).lineTo(565, obsY).stroke(lightBorder);
                doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(9).text('NOTES / REMARQUES:', 30, obsY + 10);
                doc.font('Helvetica').text(data.observations, 30, obsY + 25, { width: 535 });
                currentY += 40;
            }

            // --- FOOTER AND SIGNATURE ---
            const footY = 700;
            doc.moveTo(30, footY).lineTo(260, footY).lineWidth(2).stroke(primaryColor);
            doc.moveTo(305, footY).lineTo(565, footY).lineWidth(2).stroke(primaryColor);
            doc.lineWidth(1); // reset

            doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(8.5).text('TECHNICIEN / MONTEUR', 30, footY + 10, { width: 230, align: 'center' });
            doc.text('CONTRÔLE FINAL', 305, footY + 10, { width: 260, align: 'center' });

            if (data.branding?.cachetUrl) {
                try {
                    const base64Cachet = data.branding.cachetUrl.includes('base64,') ? data.branding.cachetUrl.split('base64,')[1] : data.branding.cachetUrl;
                    doc.image(Buffer.from(base64Cachet, 'base64'), 400, footY + 30, { height: 45 });
                } catch (e) {
                    this.logger.error(`Error drawing Montage cachet: ${e.message}`);
                }
            }

            // FOOTER
            doc.fontSize(7).fillColor(greyText).text('OptiSaas - Solution de gestion optique premium', 30, 790);
            doc.text(`Document généré le ${new Date().toLocaleString('fr-FR')}`, 400, 790, { align: 'right' });

            doc.end();
        });
    }
    async generateLensPurchaseOrder(data: {
        bcNumber: string;
        date: Date;
        supplierName: string;
        clientName: string;
        prescription: {
            od: { sphere: string; cylindre: string; axe: string; addition: string; rayon: string; diametre: string };
            og: { sphere: string; cylindre: string; axe: string; addition: string; rayon: string; diametre: string };
        };
        lensDetails: {
            marque: string;
            modele: string;
            type: string;
        };
        branding?: {
            companyName: string;
            logoUrl?: string;
            cachetUrl?: string;
        };
        ficheNumber?: string;
    }): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            console.log('📄 [PdfService] >>> GENERATING LENS PURCHASE ORDER PDF <<<');
            const doc = new PDFDocument({ margin: 40, size: 'A4' });
            const chunks: Buffer[] = [];

            doc.on('data', (chunk: Buffer) => chunks.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', (err) => reject(err));

            const primaryColor = '#0f172a';
            const accentColor = '#3b82f6';
            const greyText = '#475569';
            const lightBorder = '#e2e8f0';

            // --- HEADER ---
            const hasLogo = !!data.branding?.logoUrl;
            if (hasLogo && data.branding?.logoUrl) {
                try {
                    const base64Data = data.branding.logoUrl.includes('base64,') ? data.branding.logoUrl.split('base64,')[1] : data.branding.logoUrl;
                    doc.image(Buffer.from(base64Data, 'base64'), 40, 40, { height: 60 });
                } catch (e) {
                    this.logger.error(`Failed to embed logo: ${e.message}`);
                }
            }

            const headerX = hasLogo ? 300 : 40;
            doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(22).text(data.branding?.companyName?.toUpperCase() || 'OPTISASS', headerX, 40, { align: hasLogo ? 'right' : 'left' });
            doc.fillColor(accentColor).font('Helvetica-Bold').fontSize(14).text('BON DE COMMANDE LENTILLES', headerX, 68, { align: hasLogo ? 'right' : 'left' });
            doc.fillColor(greyText).font('Helvetica').fontSize(10).text(`Date: ${data.date.toLocaleDateString('fr-FR')}`, headerX, 85, { align: hasLogo ? 'right' : 'left' });

            doc.moveDown(4);
            const startY = 130;

            // --- META INFO CARDS ---
            const drawCard = (x: number, y: number, w: number, h: number, label: string, value: string, subText?: string) => {
                doc.rect(x, y, w, h).stroke(lightBorder);
                doc.fillColor(greyText).font('Helvetica-Bold').fontSize(8.5).text(label.toUpperCase(), x + 15, y + 15);
                doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(13).text(value, x + 15, y + 30);
                if (subText) doc.fillColor(greyText).font('Helvetica').fontSize(9).text(subText, x + 15, y + 48);
            };

            drawCard(40, startY, 250, 70, 'Fournisseur', data.supplierName);
            drawCard(305, startY, 250, 70, 'Référence BC / Date', `${data.bcNumber} — ${data.date.toLocaleDateString('fr-FR')}`);

            const sectionY = startY + 95;

            // --- TABLE ---
            doc.fillColor('#94a3b8').font('Helvetica-Bold').fontSize(9).text('DÉTAILS DE LA COMMANDE', 40, sectionY);
            
            const tableTop = sectionY + 15;
            const colWidths = [60, 160, 65, 80, 80];
            const headers = ['OEIL', 'PRODUIT (MARQUE / MODÈLE)', 'SPHÈRE', 'CYL / AXE', 'RAYON / DIA'];

            doc.rect(40, tableTop, 515, 25).fill('#f8fafc');
            doc.rect(40, tableTop, 515, 25).stroke(lightBorder);
            
            let curX = 40;
            headers.forEach((h, i) => {
                doc.fillColor('#64748b').font('Helvetica-Bold').fontSize(8).text(h, curX, tableTop + 8, { width: colWidths[i], align: i === 1 ? 'left' : 'center' });
                curX += colWidths[i];
            });

            const drawRow = (label: string, p: any, y: number) => {
                doc.rect(40, y, 515, 35).stroke(lightBorder);
                doc.fillColor(accentColor).font('Helvetica-Bold').fontSize(11).text(label, 40, y + 12, { width: colWidths[0], align: 'center' });
                
                doc.fillColor(primaryColor).font('Helvetica').fontSize(10.5);
                doc.text(`${data.lensDetails.marque} ${data.lensDetails.modele}`, 40 + colWidths[0], y + 12, { width: colWidths[1], align: 'left' });
                doc.text(p.sphere || '0.00', 40 + colWidths[0] + colWidths[1], y + 12, { width: colWidths[2], align: 'center' });
                doc.text(`${p.cylindre || '0.00'} / ${p.axe || '0'}°`, 40 + colWidths[0] + colWidths[1] + colWidths[2], y + 12, { width: colWidths[3], align: 'center' });
                doc.text(`${p.rayon || '-'} / ${p.diametre || '-'}`, 40 + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3], y + 12, { width: colWidths[4], align: 'center' });
            };

            drawRow('OD', data.prescription.od, tableTop + 25);
            drawRow('OG', data.prescription.og, tableTop + 60);

            // --- CACHET ---
            const cachetY = 600;
            doc.fillColor(greyText).font('Helvetica-Bold').fontSize(10).text('Cachet du Magasin', 40, cachetY, { width: 515, align: 'center' });
            doc.rect(225, cachetY + 15, 150, 80).dash(5, { space: 5 }).stroke('#cbd5e1');

            if (data.branding?.cachetUrl) {
                try {
                    const base64Cachet = data.branding.cachetUrl.includes('base64,') ? data.branding.cachetUrl.split('base64,')[1] : data.branding.cachetUrl;
                    doc.image(Buffer.from(base64Cachet, 'base64'), 250, cachetY + 20, { width: 100 });
                } catch (e) {
                    this.logger.error(`Failed to embed lens order cachet: ${e.message}`);
                }
            }

            doc.fontSize(8).fillColor(greyText).text('OptiSaas - Solution de gestion optique', 40, 785);
            doc.text(`Document généré le ${new Date().toLocaleString('fr-FR')}`, 400, 785, { align: 'right' });

            doc.end();
        });
    }

    async generateLensTechnicalSheet(data: {
        bcNumber: string;
        date: Date;
        clientName: string;
        prescription: {
            od: { sphere: string; cylindre: string; axe: string; addition: string };
            og: { sphere: string; cylindre: string; axe: string; addition: string };
        };
        lentilles: {
            od: { marque: string; modele: string; rayon: string; diametre: string; mouvement: string; centrage: string };
            og: { marque: string; modele: string; rayon: string; diametre: string; mouvement: string; centrage: string };
            type: string;
            usage: string;
        };
        adaptation: {
            od: { secretionLacrimale: string; but: string };
            og: { secretionLacrimale: string; but: string };
        };
        keratometrie: {
            od: { k1: string; k2: string; axe: string; kMoy: string };
            og: { k1: string; k2: string; axe: string; kMoy: string };
        };
        branding?: {
            companyName: string;
            logoUrl?: string;
            cachetUrl?: string;
        };
        ficheNumber?: string;
    }): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            console.log('📄 [PdfService] >>> GENERATING LENS TECHNICAL SHEET PDF <<<');
            const doc = new PDFDocument({ margin: 40, size: 'A4' });
            const chunks: Buffer[] = [];

            doc.on('data', (chunk: Buffer) => chunks.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', (err) => reject(err));

            const primaryColor = '#0f172a';
            const accentColor = '#3b82f6';
            const greyText = '#64748b';
            const lightBorder = '#f1f5f9';

            // --- HEADER ---
            const hasLogo = !!data.branding?.logoUrl;
            if (hasLogo && data.branding?.logoUrl) {
                try {
                    const base64Data = data.branding.logoUrl.includes('base64,') ? data.branding.logoUrl.split('base64,')[1] : data.branding.logoUrl;
                    doc.image(Buffer.from(base64Data, 'base64'), 40, 40, { height: 60 });
                } catch (e) {
                    this.logger.error(`Failed to embed lens tech sheet logo: ${e.message}`);
                }
            }

            const headerX = hasLogo ? 300 : 40;
            doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(18).text(data.branding?.companyName?.toUpperCase() || 'OPTISASS', headerX, 40, { align: 'right' });
            doc.fillColor(accentColor).font('Helvetica-Bold').fontSize(13).text('FICHE TECHNIQUE LENTILLES', headerX, 64, { align: 'right' });
            doc.fillColor(greyText).font('Helvetica-Bold').fontSize(8).text(`RÉF: ${data.bcNumber} | LE: ${data.date.toLocaleDateString('fr-FR')}`, headerX, 78, { align: 'right' });

            doc.moveTo(40, 105).lineTo(555, 105).lineWidth(2).stroke(primaryColor);
            doc.lineWidth(1);

            // --- CLIENT BOX ---
            const infoY = 120;
            doc.rect(40, infoY, 515, 35).fill('#f8fafc');
            doc.rect(40, infoY, 515, 35).stroke('#e2e8f0');
            doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(10).text('CLIENT: ', 55, infoY + 11, { continued: true }).font('Helvetica').text(data.clientName);
            doc.fillColor(greyText).fontSize(8).text(`Dossier N°: ${data.ficheNumber || data.bcNumber.split('-').pop()}`, 400, infoY + 12, { align: 'right', width: 140 });

            let currentY = 175;

            const drawSectionHeader = (y: number, title: string) => {
                doc.circle(44, y + 4, 3).fill(accentColor);
                doc.fillColor('#94a3b8').font('Helvetica-Bold').fontSize(8.5).text(title.toUpperCase(), 55, y);
                doc.moveTo(40, y + 12).lineTo(555, y + 12).stroke('#f1f5f9');
            };

            // --- SECTION 1: CORRECTION & LENTILLES ---
            drawSectionHeader(currentY, 'Correction & Lentilles');
            currentY += 20;

            const drawTable = (x: number, y: number, headers: string[], rows: any[], colWidths: number[]) => {
                let curX = x;
                doc.rect(x, y, 250, 18).fill('#f8fafc');
                headers.forEach((h, i) => {
                    doc.fillColor('#64748b').font('Helvetica-Bold').fontSize(7.5).text(h, curX, y + 5, { width: colWidths[i], align: i === 0 ? 'left' : 'center' });
                    curX += colWidths[i];
                });
                
                rows.forEach((r, idx) => {
                    const ry = y + 18 + idx * 22;
                    curX = x;
                    doc.fillColor(accentColor).font('Helvetica-Bold').fontSize(9).text(r.label, curX, ry + 6, { width: colWidths[0], align: 'left' });
                    curX += colWidths[0];
                    r.values.forEach((v: string, vi: number) => {
                        doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(9).text(v || '-', curX, ry + 6, { width: colWidths[vi+1], align: 'center' });
                        curX += colWidths[vi+1];
                    });
                    doc.moveTo(x, ry + 20).lineTo(x + 250, ry + 20).stroke('#f1f5f9');
                });
            };

            drawTable(40, currentY, ['', 'SPH', 'CYL', 'AXE', 'ADD'], [
                { label: 'OD', values: [data.prescription.od.sphere, data.prescription.od.cylindre, data.prescription.od.axe, data.prescription.od.addition] },
                { label: 'OG', values: [data.prescription.og.sphere, data.prescription.og.cylindre, data.prescription.og.axe, data.prescription.og.addition] }
            ], [30, 55, 55, 55, 55]);

            drawTable(305, currentY, ['', 'MARQUE', 'MODÈLE', 'RAYON', 'DIA'], [
                { label: 'OD', values: [data.lentilles.od.marque, data.lentilles.od.modele, data.lentilles.od.rayon, data.lentilles.od.diametre] },
                { label: 'OG', values: [data.lentilles.og.marque, data.lentilles.og.modele, data.lentilles.og.rayon, data.lentilles.og.diametre] }
            ], [30, 60, 60, 50, 50]);

            currentY += 80;

            // --- SECTION 2: ADAPTATION & EXAMEN ---
            drawSectionHeader(currentY, 'Adaptation & Examen Clinique');
            currentY += 20;

            const drawInfoBox = (x: number, y: number, w: number, label: string, val: string) => {
                doc.rect(x, y, w, 35).stroke('#e2e8f0');
                doc.fillColor(greyText).font('Helvetica-Bold').fontSize(7.5).text(label.toUpperCase(), x + 10, y + 8);
                doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(9).text(val || '-', x + 10, y + 18);
            };

            const boxW = 515 / 4;
            drawInfoBox(40, currentY, boxW, 'Type', data.lentilles.type);
            drawInfoBox(40 + boxW, currentY, boxW, 'Usage', data.lentilles.usage);
            drawInfoBox(40 + boxW * 2, currentY, boxW, 'Mouvement OD', data.lentilles.od.mouvement);
            drawInfoBox(40 + boxW * 3, currentY, boxW, 'Mouvement OG', data.lentilles.og.mouvement);
            
            currentY += 40;
            drawInfoBox(40, currentY, boxW, 'Centrage OD', data.lentilles.od.centrage);
            drawInfoBox(40 + boxW, currentY, boxW, 'Centrage OG', data.lentilles.og.centrage);
            drawInfoBox(40 + boxW * 2, currentY, boxW, 'Séc. Lacrym (OD/OG)', `${data.adaptation.od.secretionLacrimale || '-'}/${data.adaptation.og.secretionLacrimale || '-'} mm`);
            drawInfoBox(40 + boxW * 3, currentY, boxW, 'B.U.T (OD/OG)', `${data.adaptation.od.but || '-'}/${data.adaptation.og.but || '-'} sec`);

            currentY += 60;

            // --- SECTION 3: KÉRATOMÉTRIE ---
            drawSectionHeader(currentY, 'Kératométrie');
            currentY += 20;

            const kWidth = 515 / 5;
            const drawKRow = (label: string, k: any, y: number) => {
                doc.fillColor(accentColor).font('Helvetica-Bold').fontSize(10).text(label, 40, y + 8, { width: kWidth, align: 'center' });
                doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(10);
                doc.text(k.k1 || '-', 40 + kWidth, y + 8, { width: kWidth, align: 'center' });
                doc.text(k.k2 || '-', 40 + kWidth * 2, y + 8, { width: kWidth, align: 'center' });
                doc.text(`${k.axe || '-'}°`, 40 + kWidth * 3, y + 8, { width: kWidth, align: 'center' });
                doc.text(k.kMoy || '-', 40 + kWidth * 4, y + 8, { width: kWidth, align: 'center' });
                doc.moveTo(40, y + 22).lineTo(555, y + 22).stroke('#f1f5f9');
            };

            doc.fillColor('#64748b').font('Helvetica-Bold').fontSize(8);
            doc.text('', 40, currentY, { width: kWidth, align: 'center' });
            doc.text('K1 (H)', 40 + kWidth, currentY, { width: kWidth, align: 'center' });
            doc.text('K2 (V)', 40 + kWidth * 2, currentY, { width: kWidth, align: 'center' });
            doc.text('AXE', 40 + kWidth * 3, currentY, { width: kWidth, align: 'center' });
            doc.text('K.MOY', 40 + kWidth * 4, currentY, { width: kWidth, align: 'center' });
            doc.moveTo(40, currentY + 12).lineTo(555, currentY + 12).stroke('#e2e8f0');

            drawKRow('OD', data.keratometrie.od, currentY + 15);
            drawKRow('OG', data.keratometrie.og, currentY + 40);

            // --- SIGNATURES ---
            const sigY = 680;
            doc.moveTo(40, sigY).lineTo(250, sigY).lineWidth(1.5).stroke(primaryColor);
            doc.moveTo(345, sigY).lineTo(555, sigY).lineWidth(1.5).stroke(primaryColor);
            doc.lineWidth(1);
            doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(9).text('OPTICIEN / ADAPTATEUR', 40, sigY + 10, { width: 210, align: 'center' });
            doc.text('CACHET ÉTABLISSEMENT', 345, sigY + 10, { width: 210, align: 'center' });

            if (data.branding?.cachetUrl) {
                try {
                    const base64Cachet = data.branding.cachetUrl.includes('base64,') ? data.branding.cachetUrl.split('base64,')[1] : data.branding.cachetUrl;
                    doc.image(Buffer.from(base64Cachet, 'base64'), 380, sigY + 30, { height: 45 });
                } catch (e) {
                    this.logger.error(`Failed to embed lens tech sheet cachet: ${e.message}`);
                }
            }

            doc.fontSize(8).fillColor(greyText).text('OptiSaas - Solution de gestion optique', 40, 785);
            doc.text(`Document généré le ${new Date().toLocaleString('fr-FR')}`, 400, 785, { align: 'right' });

            doc.end();
        });
    }
}
