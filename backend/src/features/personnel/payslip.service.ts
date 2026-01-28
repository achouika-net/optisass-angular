import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class PayslipService {
    private readonly uploadDir = path.join(process.cwd(), 'uploads', 'payslips');

    constructor() {
        if (!fs.existsSync(this.uploadDir)) {
            fs.mkdirSync(this.uploadDir, { recursive: true });
        }
    }

    async generate(employee: any, payroll: any, commissions: any[], config?: any) {
        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        const fileName = `payslip-${employee.id}-${payroll.mois}-${payroll.annee}.pdf`;
        const filePath = path.join(this.uploadDir, fileName);
        const stream = fs.createWriteStream(filePath);

        doc.pipe(stream);

        // Header - Professional look
        doc.fontSize(22).font('Helvetica-Bold').text('BULLETIN DE PAIE', { align: 'center' });
        doc.moveDown(0.5);
        doc.fontSize(10).font('Helvetica').text(`Période : ${payroll.mois}/${payroll.annee}`, { align: 'right' });
        doc.moveDown();

        // Employee Info Box
        const infoY = doc.y;
        doc.fontSize(10).font('Helvetica-Bold').text('INFORMATIONS EMPLOYÉ', 50, infoY);
        doc.font('Helvetica');
        doc.text(`Nom : ${employee.nom.toUpperCase()} ${employee.prenom}`, 50, infoY + 15);
        doc.text(`Matricule : ${employee.matricule || 'N/A'}`, 50, infoY + 30);
        doc.text(`Poste : ${employee.poste}`, 50, infoY + 45);
        doc.text(`CIN : ${employee.cin || 'N/A'}`, 50, infoY + 60);

        doc.text(`Date Embauche : ${new Date(employee.dateEmbauche).toLocaleDateString()}`, 300, infoY + 15);
        doc.text(`Type contrat : ${employee.contrat}`, 300, infoY + 30);
        doc.text(`Mode Paiement : ${employee.paymentMode || 'VIREMENT'}`, 300, infoY + 45);
        doc.moveDown(3);

        // Grid Headers
        const gridY = doc.y;
        doc.rect(50, gridY - 5, 500, 20).fill('#f3f4f6');
        doc.fillColor('#000').font('Helvetica-Bold').fontSize(10);
        doc.text('DÉSIGNATION', 60, gridY);
        doc.text('GAINS', 350, gridY, { width: 80, align: 'right' });
        doc.text('RETENUES', 460, gridY, { width: 80, align: 'right' });
        doc.moveDown(1.5);

        doc.font('Helvetica').fontSize(10);

        // 1. Salaire de Base
        let currentY = doc.y;
        doc.text('Salaire de Base', 60, currentY);
        doc.text(`${payroll.salaireBase.toFixed(2)}`, 350, currentY, { width: 80, align: 'right' });
        doc.moveDown();

        // 2. Indemnités & Primes
        if (payroll.primes > 0) {
            currentY = doc.y;
            doc.text('Primes & Indemnités', 60, currentY);
            doc.text(`${payroll.primes.toFixed(2)}`, 350, currentY, { width: 80, align: 'right' });
            doc.moveDown();
        }

        // 3. Commissions (Total Only)
        if (payroll.commissions > 0) {
            currentY = doc.y;
            doc.text('Commissions sur Ventes (Total)', 60, currentY);
            doc.text(`${payroll.commissions.toFixed(2)}`, 350, currentY, { width: 80, align: 'right' });
            doc.moveDown();
        }

        // 4. Heures Supplémentaires
        if (payroll.heuresSup > 0) {
            currentY = doc.y;
            doc.text('Heures Supplémentaires', 60, currentY);
            doc.text(`${payroll.heuresSup.toFixed(2)}`, 350, currentY, { width: 80, align: 'right' });
            doc.moveDown();
        }

        // 5. Total Brut
        doc.moveDown(0.5);
        doc.font('Helvetica-Bold');
        currentY = doc.y;
        doc.rect(50, currentY - 5, 500, 20).fill('#f9fafb');
        doc.fillColor('#000').text('SALAIRE BRUT GLOBAL', 60, currentY);
        doc.text(`${payroll.grossSalary.toFixed(2)}`, 350, currentY, { width: 80, align: 'right' });
        doc.font('Helvetica').moveDown(1.5);

        // 6. Retenues Sociales
        if (payroll.socialSecurityDeduction > 0) {
            currentY = doc.y;
            const rate = config ? ` (${config.socialSecurityRate_S}%)` : '';
            doc.text(`CNSS (Sécurité Sociale)${rate}`, 60, currentY);
            doc.text(`${payroll.socialSecurityDeduction.toFixed(2)}`, 460, currentY, { width: 80, align: 'right' });
            doc.moveDown();
        }

        if (payroll.healthInsuranceDeduction > 0) {
            currentY = doc.y;
            const rate = config ? ` (${config.healthInsuranceRate_S}%)` : '';
            doc.text(`AMO (Assurance Maladie)${rate}`, 60, currentY);
            doc.text(`${payroll.healthInsuranceDeduction.toFixed(2)}`, 460, currentY, { width: 80, align: 'right' });
            doc.moveDown();
        }

        // 7. Impôt sur le Revenu (IR)
        if (payroll.incomeTaxDeduction > 0) {
            currentY = doc.y;
            doc.text('IR (Impôt sur le Revenu)', 60, currentY);
            doc.text(`${payroll.incomeTaxDeduction.toFixed(2)}`, 460, currentY, { width: 80, align: 'right' });
            doc.moveDown();
        }

        // 8. Avances
        if (payroll.avances > 0) {
            currentY = doc.y;
            doc.text('Avances sur salaire (Acomptes)', 60, currentY);
            doc.text(`${payroll.avances.toFixed(2)}`, 460, currentY, { width: 80, align: 'right' });
            doc.moveDown();
        }

        // 9. Autres retenues (Abscences, etc.)
        if (payroll.retenues > 0) {
            currentY = doc.y;
            doc.text('Autres retenues (Absences, etc.)', 60, currentY);
            doc.text(`${payroll.retenues.toFixed(2)}`, 460, currentY, { width: 80, align: 'right' });
            doc.moveDown();
        }

        // Calculations detail (Net Imposable) - Professional touch
        doc.moveDown();
        doc.fontSize(8).fillColor('#666');
        doc.text(`Base de calcul Net Imposable : ${(payroll.taxableNet || 0).toFixed(2)} MAD`, 50, doc.y);
        doc.fillColor('#000').fontSize(10);

        doc.moveDown(2);
        doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
        doc.moveDown(0.5);

        // Net à payer big and bold
        doc.fontSize(16).font('Helvetica-Bold').text('NET À PAYER', 50, doc.y);
        // Fix formatting to avoid locale-specific symbols that might render incorrectly (like slashes or special spaces)
        const formattedNet = (payroll.netAPayer || 0).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
        doc.text(`${formattedNet} MAD`, 350, doc.y, { width: 200, align: 'right' });

        // Footer
        doc.fontSize(9).font('Helvetica').text('Fait à ...................., le ' + new Date().toLocaleDateString('fr-FR'), 50, 720);
        doc.text('Signature de l\'employeur', 400, 720);
        doc.text('Signature de l\'employé (précedée de lu et approuvé)', 50, 750);

        doc.end();

        return new Promise((resolve, reject) => {
            stream.on('finish', () => resolve(`/uploads/payslips/${fileName}`));
            stream.on('error', reject);
        });
    }
}
