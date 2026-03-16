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
      od: { sphere: string; cylindre: string; axe: string };
      og: { sphere: string; cylindre: string; axe: string };
    };
  }): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));

      // Header
      doc.fontSize(20).text('BON DE COMMANDE', { align: 'center' });
      doc.moveDown();

      // BC Info
      doc.fontSize(12).text(`N° Commande: ${data.bcNumber}`);
      doc.text(`Date: ${data.date.toLocaleDateString()}`);
      doc.text(`Fournisseur: ${data.supplierName}`);
      doc.moveDown();

      // Client Info
      doc.text(`Client: ${data.clientName}`);
      doc.moveDown();

      // Table Header
      const tableTop = 250;
      doc.font('Helvetica-Bold');
      doc.text('Désignation', 50, tableTop);
      doc.text('Prescription', 300, tableTop);
      doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

      // Table Content
      doc.font('Helvetica');
      const contentTop = tableTop + 25;
      doc.text(data.designation, 50, contentTop, { width: 230 });
      
      const odText = `OD: ${data.prescription.od.sphere} (${data.prescription.od.cylindre}) ${data.prescription.od.axe}`;
      const ogText = `OG: ${data.prescription.og.sphere} (${data.prescription.og.cylindre}) ${data.prescription.og.axe}`;
      doc.text(odText, 300, contentTop);
      doc.text(ogText, 300, contentTop + 15);

      // Footer
      const footerTop = 500;
      doc.moveTo(50, footerTop).lineTo(550, footerTop).stroke();
      doc.moveDown();
      doc.text("Cachet et Signature de l'établissement", { align: 'right' });

      doc.end();
    });
  }
}
