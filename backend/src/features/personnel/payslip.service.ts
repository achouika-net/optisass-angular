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

    async generate(employee: any, payroll: any, commissions: any[]) {
        const doc = new PDFDocument({ margin: 50 });
        const fileName = `payslip-${employee.id}-${payroll.mois}-${payroll.annee}.pdf`;
        const filePath = path.join(this.uploadDir, fileName);
        const stream = fs.createWriteStream(filePath);

        doc.pipe(stream);

        // Header
        doc.fontSize(20).text('BULLETIN DE PAIE', { align: 'center' });
        doc.moveDown();
        doc.fontSize(10).text(`Période : ${payroll.mois}/${payroll.annee}`, { align: 'right' });
        doc.moveDown();

        // Employee Info
        doc.fontSize(12).text(`Employé : ${employee.nom} ${employee.prenom}`);
        doc.text(`Matricule : ${employee.matricule || 'N/A'}`);
        doc.text(`Poste : ${employee.poste}`);
        doc.text(`Type de contrat : ${employee.contrat}`);
        doc.moveDown();

        // Horizontal Line
        doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
        doc.moveDown();

        // Details Table
        const startY = doc.y;
        doc.text('Désignation', 50, startY);
        doc.text('Montant (MAD)', 450, startY, { align: 'right' });
        doc.moveDown(0.5);
        doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
        doc.moveDown();

        doc.text('Salaire de Base', 50, doc.y);
        doc.text(`${payroll.salaireBase.toFixed(2)}`, 450, doc.y, { align: 'right' });
        doc.moveDown();

        if (payroll.commissions > 0) {
            doc.text('Commissions Ventes', 50, doc.y);
            doc.text(`${payroll.commissions.toFixed(2)}`, 450, doc.y, { align: 'right' });
            doc.moveDown();

            // Sub-details for commissions
            doc.fontSize(8);
            for (const c of commissions) {
                const currentY = doc.y;
                doc.text(`- ${c.type} (FAC: ${c.facture?.numero || 'N/A'})`, 70, currentY);
                doc.text(`${c.montant.toFixed(2)}`, 450, currentY, { align: 'right' });
                doc.moveDown();
            }
            doc.fontSize(12);
        }

        if (payroll.heuresSup > 0) {
            doc.text('Heures Supplémentaires', 50, doc.y);
            doc.text(`${payroll.heuresSup.toFixed(2)}`, 450, doc.y, { align: 'right' });
            doc.moveDown();
        }

        if (payroll.retenues > 0) {
            doc.text('Retenues (Absences/Avances)', 50, doc.y);
            doc.text(`-${payroll.retenues.toFixed(2)}`, 450, doc.y, { align: 'right' });
            doc.moveDown();
        }

        doc.moveDown();
        doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
        doc.moveDown();

        // Total
        doc.fontSize(14).text('NET À PAYER', 50, doc.y);
        doc.text(`${payroll.netAPayer.toFixed(2)} MAD`, 450, doc.y, { align: 'right' });

        // Footer
        doc.fontSize(10).text('Fait à ...................., le ' + new Date().toLocaleDateString(), 50, 700);
        doc.text('Signature de l\'employeur', 400, 700);

        doc.end();

        return new Promise((resolve, reject) => {
            stream.on('finish', () => resolve(`/uploads/payslips/${fileName}`));
            stream.on('error', reject);
        });
    }
}
