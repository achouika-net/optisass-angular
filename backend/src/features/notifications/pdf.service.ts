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
            const lightBorder = '#e2e8f0';

            // --- HEADER (RIGHT ALIGNED) ---
            const hasLogo = !!data.branding?.logoUrl;
            if (hasLogo && data.branding?.logoUrl) {
                try {
                    const base64Data = data.branding.logoUrl.includes('base64,')
                        ? data.branding.logoUrl.split('base64,')[1]
                        : data.branding.logoUrl;
                    doc.image(Buffer.from(base64Data, 'base64'), 30, 30, { height: 50 });
                } catch (e) {
                    this.logger.error(`Failed to embed logo: ${e.message}`);
                }
            }

            const headerX = 300;
            doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(18).text(data.branding?.companyName?.toUpperCase() || 'OPTISAAS', headerX, 25, { align: 'right', width: 265 });
            doc.fillColor(accentColor).font('Helvetica-Bold').fontSize(12).text('FICHE DE MONTAGE TECHNIQUE', headerX, 48, { align: 'right', width: 265 });
            doc.fillColor(greyText).font('Helvetica').fontSize(9).text(`Réf: ${data.bcNumber} | Fiche N°: ${data.ficheNumber || '-'} | Date: ${data.date.toLocaleDateString('fr-FR')}`, headerX, 64, { align: 'right', width: 265 });

            // Horizontal separator
            doc.moveTo(30, 85).lineTo(565, 85).stroke(lightBorder);

            // --- CLIENT INFO BAR ---
            const rowY = 95;
            doc.rect(30, rowY, 535, 25).fill('#f8fafc');
            doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(10).text('CLIENT: ', 45, rowY + 8).font('Helvetica').text(data.clientName, 95, rowY + 8);
            doc.font('Helvetica-Bold').text('MAGASIN: ', 360, rowY + 8).font('Helvetica').text(data.magasinName || 'OptiSaas', 425, rowY + 8);

            // --- TABLES SECTION ---
            const tablesY = 135;

            // Correction Table (Left)
            const drawHeading = (x: number, y: number, text: string) => {
                doc.fillColor(accentColor).rect(x, y, 3, 12).fill();
                doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(10).text(text, x + 10, y + 1);
            };

            drawHeading(30, tablesY, 'CORRECTION ORDONNANCE');
            
            const tableWidth = 260;
            const drawTechTable = (x: number, y: number, headers: string[], rows: any[]) => {
                const cw = [35, 55, 55, 55, 60];
                doc.fillColor('#f8fafc').rect(x, y + 20, tableWidth, 20).fill();
                doc.rect(x, y + 20, tableWidth, 20).stroke(lightBorder);

                let curX = x;
                headers.forEach((h, i) => {
                    doc.fillColor(greyText).font('Helvetica-Bold').fontSize(8).text(h, curX, y + 26, { width: cw[i], align: 'center' });
                    curX += cw[i];
                });

                rows.forEach((r, idx) => {
                    const ry = y + 40 + idx * 25;
                    doc.fillColor('#f8fafc').rect(x, ry, tableWidth, 25).fill();
                    doc.rect(x, ry, tableWidth, 25).stroke(lightBorder);
                    
                    const axe = String(r.c3 || '0');
                    const axeStr = axe.includes('°') ? axe : `${axe}°`;

                    doc.fillColor(techColor).font('Helvetica-Bold').fontSize(10);
                    doc.text(r.label, x + 5, ry + 8, { width: 35 });
                    doc.font('Helvetica').fontSize(10);
                    doc.fillColor('#1e293b').font('Helvetica').fontSize(10);
                    doc.text(r.c1, x + 45, ry + 8, { width: 45, align: 'center' });
                    doc.text(r.c2, x + 95, ry + 8, { width: 45, align: 'center' });
                    doc.text(axeStr, x + 145, ry + 8, { width: 55, align: 'center' });
                    doc.text(r.c4, x + 205, ry + 8, { width: 45, align: 'center' });
                });
            };

            drawTechTable(30, tablesY, ['OEIL', 'SPHÈRE', 'CYL.', 'AXE', 'ADD.'], [
                { label: 'OD', c1: data.prescription.od.sphere, c2: data.prescription.od.cylindre, c3: data.prescription.od.axe, c4: data.prescription.od.addition },
                { label: 'OG', c1: data.prescription.og.sphere, c2: data.prescription.og.cylindre, c3: data.prescription.og.axe, c4: data.prescription.og.addition }
            ]);

            // Centrage Table (Right)
            drawHeading(305, tablesY, 'PARAMÈTRES CENTRAGE');
            const drawCentrageTable = (x: number, y: number, headers: string[], rows: any[]) => {
                const cw = [35, 75, 75, 75];
                doc.fillColor('#f8fafc').rect(x, y + 20, tableWidth, 20).fill();
                doc.rect(x, y + 20, tableWidth, 20).stroke(lightBorder);

                let curX = x;
                headers.forEach((h, i) => {
                    doc.fillColor(greyText).font('Helvetica-Bold').fontSize(8).text(h, curX, y + 26, { width: cw[i], align: 'center' });
                    curX += cw[i];
                });

                rows.forEach((r, idx) => {
                    const ry = y + 40 + (idx * 25);
                    doc.rect(x, ry, tableWidth, 25).stroke(lightBorder);
                    doc.fillColor(techColor).font('Helvetica-Bold').fontSize(10).text(r.label, x, ry + 8, { width: 35, align: 'center' });
                    
                    doc.fillColor('#1e293b').font('Helvetica').fontSize(10);
                    doc.text(r.c1, x + 35, ry + 8, { width: 75, align: 'center' });
                    doc.text(r.c2, x + 110, ry + 8, { width: 75, align: 'center' });
                    doc.text(r.c3, x + 185, ry + 8, { width: 75, align: 'center' });
                });
            };

            const formatCentrageValue = (v: any) => (v && v !== '-' ? `${v} mm` : v || '-');
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
            const lensY = 245;
            doc.rect(30, lensY, 340, 75).stroke(lightBorder);
            doc.fillColor(accentColor).font('Helvetica-Bold').fontSize(9).text('VERRES SÉLECTIONNÉS', 40, lensY + 10);
            doc.fillColor(primaryColor).fontSize(8).font('Helvetica-Bold').text('OD: ', 40, lensY + 25).font('Helvetica').text(data.verres.od, 65, lensY + 25);
            doc.font('Helvetica-Bold').text('OG: ', 40, lensY + 42).font('Helvetica').text(data.verres.og, 65, lensY + 42);
            doc.fillColor(techColor).fontSize(8.5).font('Helvetica-BoldOblique').text(`Traitements: ${data.verres.treatments || 'STANDARD'}`, 40, lensY + 60);

            doc.rect(380, lensY, 185, 75).stroke(lightBorder);
            doc.fillColor(greyText).font('Helvetica-Bold').fontSize(8).text('DIAMÈTRE UTILE', 390, lensY + 12);
            doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(24).text(data.diametreConseille || '70/75', 380, lensY + 32, { width: 185, align: 'center' });

            // (Blue Technical Note Box removed per user request)

            // --- IA RECOMMENDATIONS (Moved above Images per user request) ---
            const iaY = 325;
            drawHeading(30, iaY, 'CONSEILS TECHNIQUES & PRÉCONISATIONS IA');
            
            const drawIABox = (x: number, y: number, side: string, val: string) => {
                doc.rect(x, y + 15, 260, 35).stroke(lightBorder);
                doc.fillColor('#eff6ff').rect(x, y + 15, 30, 35).fill();
                doc.fillColor(techColor).font('Helvetica-Bold').fontSize(10).text(side, x, y + 27, { width: 30, align: 'center' });
                doc.fillColor('#64748b').font('Helvetica').fontSize(9).text('Configuration patient: ', x + 40, y + 27, { width: 100, continued: true })
                   .fillColor(primaryColor).text(val);
            };

            const boxY = iaY + 25;
            drawIABox(30, boxY, 'OD', data.preconisationsIA?.od || '-');
            drawIABox(305, boxY, 'OG', data.preconisationsIA?.og || '-');

            // --- IMAGES SECTION (Rendered after IA Recommendations) ---
            const imgSectionY = boxY + 60;
            const hasMonture = !!data.imageMontureUrl;
            const hasCentering = !!data.virtualCenteringUrl;

            drawHeading(30, imgSectionY, 'VISUELS DE CONFIGURATION & CENTRAGE');
            
            if (hasMonture && hasCentering) {
                // Side by Side
                const imgWidth = 260;
                
                // Frame
                doc.rect(30, imgSectionY + 20, imgWidth, 240).stroke(lightBorder);
                try {
                    const base64Img = data.imageMontureUrl!.includes('base64,') ? data.imageMontureUrl!.split('base64,')[1] : data.imageMontureUrl;
                    doc.image(Buffer.from(base64Img!, 'base64'), 35, imgSectionY + 25, { fit: [250, 230], align: 'center', valign: 'center' });
                } catch (e) {
                    doc.fillColor(greyText).fontSize(8).text('Visuel monture non disponible', 30, imgSectionY + 130, { width: 260, align: 'center' });
                }

                // Centering
                doc.rect(305, imgSectionY + 20, 260, 240).stroke(lightBorder).fill('#f8fafc');
                try {
                    const base64Centring = data.virtualCenteringUrl!.includes('base64,') ? data.virtualCenteringUrl!.split('base64,')[1] : data.virtualCenteringUrl;
                    doc.image(Buffer.from(base64Centring!, 'base64'), 310, imgSectionY + 25, { fit: [250, 230], align: 'center', valign: 'center' });
                } catch (e) {
                    doc.fillColor(greyText).fontSize(8).text('Image centrage non disponible', 305, imgSectionY + 130, { width: 260, align: 'center' });
                }
            } else if (hasMonture || hasCentering) {
                // One Image -> Centered (Width 380)
                const boxWidth = 380;
                const boxX = (doc.page.width - boxWidth) / 2;
                const isCentering = hasCentering;
                const imgUrl = isCentering ? data.virtualCenteringUrl : data.imageMontureUrl;
                const boxColor = isCentering ? '#f8fafc' : 'white';

                doc.rect(boxX, imgSectionY + 20, boxWidth, 240).stroke(lightBorder);
                if (isCentering) doc.fill(boxColor); else doc.stroke();
                
                try {
                    const base64Img = imgUrl!.includes('base64,') ? imgUrl!.split('base64,')[1] : imgUrl;
                    doc.image(Buffer.from(base64Img!, 'base64'), boxX + 5, imgSectionY + 25, { fit: [boxWidth - 10, 230], align: 'center', valign: 'center' });
                } catch (e) {
                    doc.fillColor(greyText).fontSize(8).text(isCentering ? 'Image centrage non disponible' : 'Visuel monture non disponible', boxX, imgSectionY + 130, { width: boxWidth, align: 'center' });
                }
            } else {
                // No images provided -> Centered Empty Box Placeholder
                const boxWidth = 380;
                const boxX = (doc.page.width - boxWidth) / 2;
                doc.rect(boxX, imgSectionY + 20, boxWidth, 240).stroke(lightBorder).fill('#f8fafc');
                doc.fillColor(greyText).fontSize(9).font('Helvetica-Oblique').text('Aucun visuel de configuration capturé pour cette fiche.', boxX, imgSectionY + 130, { width: boxWidth, align: 'center' });
            }


            // --- OBSERVATIONS / NOTES ---
            if (data.observations) {
                const obsY = imgSectionY + 275;
                doc.fillColor('#fbfcfd').rect(30, obsY, 535, 30).fill();
                doc.moveTo(30, obsY).lineTo(30, obsY + 30).lineWidth(3).stroke('#cbd5e1');
                doc.fillColor(greyText).font('Helvetica-Bold').fontSize(8.5).text('NOTES / REMARQUES:', 40, obsY + 8);
                doc.fillColor(primaryColor).font('Helvetica').fontSize(8.5).text(data.observations, 140, obsY + 8, { width: 415 });
            }

            // --- FOOTER AND SIGNATURE ---
            const footY = 700;
            doc.moveTo(30, footY).lineTo(565, footY).stroke(lightBorder);
            
            doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(8.5).text('TECHNICIEN / MONTEUR', 30, footY + 10, { width: 170, align: 'center' });
            doc.text('CONTRÔLE QUALITÉ FINAL', 200, footY + 10, { width: 170, align: 'center' });
            doc.text('CACHET ET SIGNATURE', 380, footY + 10, { width: 185, align: 'center' });

            if (data.branding?.cachetUrl) {
                try {
                    const base64Cachet = data.branding.cachetUrl.includes('base64,') ? data.branding.cachetUrl.split('base64,')[1] : data.branding.cachetUrl;
                    doc.image(Buffer.from(base64Cachet, 'base64'), 400, footY + 25, { height: 45 });
                } catch (e) {
                    console.error('Error drawing Montage cachet:', e);
                }
            }

            // FOOTER
            doc.fontSize(7).fillColor(greyText).text('OptiSaas - Solution de gestion optique premium', 30, 785);
            doc.text(`Document généré le ${new Date().toLocaleString('fr-FR')}`, 400, 785, { align: 'right' });

            doc.end();
        });
    }
}
