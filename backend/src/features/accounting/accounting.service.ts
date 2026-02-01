import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ExportSageDto } from './dto/export-sage.dto';

// Use require for pdfkit to avoid constructor issues in mixed ESM/CJS environments
const PDFDocument = require('pdfkit');

@Injectable()
export class AccountingService {
    private readonly logger = new Logger(AccountingService.name);

    constructor(private prisma: PrismaService) { }

    // Default Mapping (Plan Comptable Marocain)
    private readonly CONFIG = {
        RECEIVABLE_ACCOUNT: '3421', // Clients
        SALES_REVENUE_ACCOUNT: '7111', // Ventes
        SALES_TAX_ACCOUNT: '4455', // TVA Collectée
        CASH_ACCOUNT: '5161', // Caisse
        PAYABLE_ACCOUNT: '4411', // Fournisseurs
        EXPENSE_ACCOUNT: '6111', // Achats
        INPUT_TAX_ACCOUNT: '3455', // TVA Déductible
    };

    private formatDateDDMMYY(date: Date | string): string {
        try {
            const d = new Date(date);
            if (isNaN(d.getTime())) return '010126';
            const day = d.getDate().toString().padStart(2, '0');
            const month = (d.getMonth() + 1).toString().padStart(2, '0');
            const year = d.getFullYear().toString().slice(-2);
            return `${day}${month}${year}`;
        } catch {
            return '010126';
        }
    }

    private formatDateDisplay(date: Date | string): string {
        try {
            const d = new Date(date);
            if (isNaN(d.getTime())) return '01/01/2026';
            const day = d.getDate().toString().padStart(2, '0');
            const month = (d.getMonth() + 1).toString().padStart(2, '0');
            const year = d.getFullYear();
            return `${day}/${month}/${year}`;
        } catch {
            return '01/01/2026';
        }
    }

    async generateSageExport(dto: ExportSageDto): Promise<string> {
        this.logger.log(`Starting Sage export: ${JSON.stringify(dto)}`);
        const { startDate, endDate, centreId } = dto;
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        const cid =
            centreId && centreId !== 'ALL' && centreId !== '' ? centreId : undefined;

        const [invoices, payments, expenses] = await Promise.all([
            this.prisma.facture.findMany({
                where: {
                    dateEmission: { gte: start, lte: end },
                    statut: { in: ['VALIDE', 'VALIDEE', 'PAYEE', 'SOLDEE', 'ENCAISSE'] },
                    centreId: cid,
                    exportComptable: true,
                },
                include: { client: true },
                orderBy: { dateEmission: 'asc' },
            }),
            this.prisma.paiement.findMany({
                where: {
                    date: { gte: start, lte: end },
                    statut: 'ENCAISSE',
                    facture: cid ? { centreId: cid } : undefined,
                },
                include: { facture: { include: { client: true } } },
                orderBy: { date: 'asc' },
            }),
            this.prisma.depense.findMany({
                where: {
                    date: { gte: start, lte: end },
                    statut: { in: ['VALIDEE', 'VALIDÉ', 'PAYEE', 'PAYE'] },
                    centreId: cid,
                },
                include: { fournisseur: true },
                orderBy: { date: 'asc' },
            }),
        ]);

        const lines: string[] = [];
        let lineNumber = 1;

        invoices.forEach((inv) => {
            const dateStr = this.formatDateDDMMYY(inv.dateEmission);
            const ref = inv.numero || inv.id.substring(0, 10);
            const clientName = inv.client?.nom || 'Client Divers';
            const ht = inv.totalHT || 0;
            const tva = inv.totalTVA || 0;
            const ttc = inv.totalTTC || 0;

            lines.push(
                `${lineNumber++}\t${dateStr}\t${this.CONFIG.RECEIVABLE_ACCOUNT}\t${ref}\t${clientName}\tD\t${ttc.toFixed(2)}`,
            );
            lines.push(
                `${lineNumber++}\t${dateStr}\t${this.CONFIG.SALES_REVENUE_ACCOUNT}\t${ref}\tVente ${ref}\tC\t${ht.toFixed(2)}`,
            );
            if (tva > 0) {
                lines.push(
                    `${lineNumber++}\t${dateStr}\t${this.CONFIG.SALES_TAX_ACCOUNT}\t${ref}\tTVA Collectée\tC\t${tva.toFixed(2)}`,
                );
            }
        });

        payments.forEach((p) => {
            const dateStr = this.formatDateDDMMYY(p.date);
            const ref = p.facture?.numero || p.id.substring(0, 10);
            const clientName = p.facture?.client?.nom || 'Client Divers';
            const amount = p.montant || 0;

            lines.push(
                `${lineNumber++}\t${dateStr}\t${this.CONFIG.CASH_ACCOUNT}\t${ref}\tEncaissement ${ref}\tD\t${amount.toFixed(2)}`,
            );
            lines.push(
                `${lineNumber++}\t${dateStr}\t${this.CONFIG.RECEIVABLE_ACCOUNT}\t${ref}\t${clientName}\tC\t${amount.toFixed(2)}`,
            );
        });

        expenses.forEach((exp) => {
            const dateStr = this.formatDateDDMMYY(exp.date);
            const ref = exp.reference || exp.id.substring(0, 10);
            const supplierName = exp.fournisseur?.nom || 'Fournisseur Divers';
            const amount = exp.montant || 0;
            const ht = amount / 1.2;
            const tva = amount - ht;

            lines.push(
                `${lineNumber++}\t${dateStr}\t${this.CONFIG.EXPENSE_ACCOUNT}\t${ref}\t${exp.description || 'Achat'}\tD\t${ht.toFixed(2)}`,
            );
            if (tva > 0) {
                lines.push(
                    `${lineNumber++}\t${dateStr}\t${this.CONFIG.INPUT_TAX_ACCOUNT}\t${ref}\tTVA Déductible\tD\t${tva.toFixed(2)}`,
                );
            }
            lines.push(
                `${lineNumber++}\t${dateStr}\t${this.CONFIG.PAYABLE_ACCOUNT}\t${ref}\t${supplierName}\tC\t${amount.toFixed(2)}`,
            );
        });

        return lines.join('\n');
    }

    async generateBalance(dto: ExportSageDto) {
        this.logger.log(`Generating Balance: ${JSON.stringify(dto)}`);
        const { startDate, endDate, centreId } = dto;
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        const cid =
            centreId && centreId !== 'ALL' && centreId !== '' ? centreId : undefined;

        try {
            const [invoices, payments, expenses, stock] = await Promise.all([
                this.prisma.facture.findMany({
                    where: {
                        dateEmission: { lte: end },
                        centreId: cid,
                        statut: { notIn: ['ARCHIVE', 'ANNULEE'] },
                    },
                    select: { totalHT: true, totalTVA: true, totalTTC: true, resteAPayer: true },
                }),
                this.prisma.paiement.findMany({
                    where: {
                        date: { lte: end },
                        statut: 'ENCAISSE',
                        facture: cid ? { centreId: cid } : undefined,
                    },
                    select: { montant: true },
                }),
                this.prisma.depense.findMany({
                    where: {
                        date: { lte: end },
                        statut: { in: ['VALIDEE', 'VALIDÉ', 'PAYEE', 'PAYE'] },
                        centreId: cid,
                    },
                    select: { montant: true },
                }),
                this.prisma.product.findMany({
                    where: {
                        entrepot: cid ? { centreId: cid } : undefined,
                    },
                    select: { quantiteActuelle: true, prixAchatHT: true },
                }),
            ]);

            const totalCA = invoices.reduce((sum, inv) => sum + (inv.totalTTC || 0), 0);
            const totalCreances = invoices.reduce((sum, inv) => sum + (inv.resteAPayer || 0), 0);
            const totalEncaissements = payments.reduce((sum, p) => sum + (p.montant || 0), 0);
            const totalDepenses = expenses.reduce((sum, exp) => sum + (exp.montant || 0), 0);
            const stockValue = stock.reduce((sum, p) => sum + (p.quantiteActuelle * p.prixAchatHT), 0);

            const tvaCollectee = invoices.reduce((sum, inv) => sum + (inv.totalTVA || 0), 0);
            const tvaDeductible = expenses.reduce((sum, exp) => {
                const m = exp.montant || 0;
                const ht = m / 1.2;
                const tva = m - ht;
                return sum + tva;
            }, 0);

            return {
                actif: {
                    immobilisations: 0,
                    stock: stockValue,
                    creances: totalCreances,
                    tresorerie: totalEncaissements - totalDepenses,
                    total: stockValue + totalCreances + (totalEncaissements - totalDepenses),
                },
                passif: {
                    capitaux: 0,
                    dettes: 0,
                    resultat: totalCA - totalDepenses,
                    total: totalCA - totalDepenses,
                },
                exploitation: {
                    chiffreAffaires: totalCA,
                    achats: totalDepenses,
                    resultat: totalCA - totalDepenses,
                },
                tva: {
                    collectee: tvaCollectee,
                    deductible: tvaDeductible,
                    aPayer: tvaCollectee - tvaDeductible,
                },
            };
        } catch (e) {
            this.logger.error('Error generating balance:', e);
            throw e;
        }
    }

    /**
     * Generates Landscape PDF Journal with TVA rate sorting
     */
    async generateJournalPdf(dto: ExportSageDto) {
        return this.generateJournalPdfLandscape(dto);
    }

    /**
     * Generates Professional Accounting Balance Sheet (Bilan Comptable) - Sage Style
     */
    async generateBilanComptable(dto: ExportSageDto) {
        this.logger.log(`Generating Bilan Comptable: ${JSON.stringify(dto)}`);
        const { startDate, endDate, centreId } = dto;
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        const cid = centreId && centreId !== 'ALL' && centreId !== '' ? centreId : undefined;

        const balance = await this.generateBalance(dto);

        const doc = new PDFDocument({ margin: 40, size: 'A4', bufferPages: true });

        const formatMoney = (amount: number) => amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

        try {
            // Header
            doc.fontSize(20).font('Helvetica-Bold').fillColor('#1e3a8a').text('BILAN COMPTABLE', { align: 'center' });
            doc.moveDown(0.5);
            doc.fontSize(10).font('Helvetica').fillColor('#666').text(`Période : ${this.formatDateDisplay(start)} au ${this.formatDateDisplay(end)}`, { align: 'center' });
            doc.moveDown(2);

            // Layout Constants
            const pageWidth = 595.28; // A4 width at 72dpi
            const margin = 40;
            const contentWidth = pageWidth - 2 * margin;
            const colWidth = contentWidth / 2 - 10; // 10px gap
            const colGap = 20;

            const startX_Actif = margin;
            const startX_Passif = margin + colWidth + colGap;
            const startY = doc.y;

            // Draw Header Backgrounds (Blue Headers)
            doc.roundedRect(startX_Actif, startY, colWidth, 30, 5).fill('#1e3a8a');
            doc.roundedRect(startX_Passif, startY, colWidth, 30, 5).fill('#1e3a8a');

            // Draw Headers Text
            doc.fontSize(14).font('Helvetica-Bold').fillColor('#fff');
            doc.text('ACTIF', startX_Actif, startY + 8, { width: colWidth, align: 'center' });
            doc.text('PASSIF', startX_Passif, startY + 8, { width: colWidth, align: 'center' });

            let currentY_Actif = startY + 40;
            let currentY_Passif = startY + 40;

            // --- ACTIF CONTENT ---
            const actifItems = [
                { label: 'ACTIF IMMOBILISÉ', value: balance.actif.immobilisations, bold: true, bg: '#f1f5f9' },
                { label: '  Immobilisations corporelles', value: 0, indent: true },
                { label: '  Immobilisations incorporelles', value: 0, indent: true },
                { label: '', value: null, spacer: true },
                { label: 'ACTIF CIRCULANT', value: null, bold: true, bg: '#f1f5f9' },
                { label: '  Stocks et en-cours', value: balance.actif.stock, indent: true },
                { label: '  Créances clients', value: balance.actif.creances, indent: true },
                { label: '  Autres créances', value: 0, indent: true },
                { label: '', value: null, spacer: true },
                { label: 'TRÉSORERIE - ACTIF', value: balance.actif.tresorerie, bold: true, bg: '#f1f5f9' },
                { label: '  Banques', value: balance.actif.tresorerie * 0.7, indent: true },
                { label: '  Caisses', value: balance.actif.tresorerie * 0.3, indent: true },
            ];

            actifItems.forEach((item) => {
                if (item.spacer) {
                    currentY_Actif += 15;
                    return;
                }

                if (item.bg) {
                    doc.rect(startX_Actif, currentY_Actif - 4, colWidth, 20).fill(item.bg);
                }

                const font = item.bold ? 'Helvetica-Bold' : 'Helvetica';
                const size = item.bold ? 10 : 9;
                const color = item.bold ? '#1e293b' : '#334155';

                doc.fontSize(size).font(font).fillColor(color);
                doc.text(item.label, startX_Actif + 5, currentY_Actif, { width: colWidth - 70, continued: false });

                if (item.value !== null) {
                    doc.text(`${formatMoney(item.value)} DH`, startX_Actif + colWidth - 85, currentY_Actif, { width: 80, align: 'right' });
                }

                currentY_Actif += 20;
            });


            // --- PASSIF CONTENT ---
            const passifItems = [
                { label: 'CAPITAUX PROPRES', value: null, bold: true, bg: '#f1f5f9' },
                { label: '  Capital social', value: balance.passif.capitaux, indent: true },
                { label: '  Réserves', value: 0, indent: true },
                { label: '  Résultat de l\'exercice', value: balance.passif.resultat, indent: true },
                { label: '', value: null, spacer: true },
                { label: 'DETTES', value: null, bold: true, bg: '#f1f5f9' },
                { label: '  Dettes fournisseurs', value: balance.passif.dettes, indent: true },
                { label: '  Dettes fiscales et sociales', value: balance.tva.aPayer, indent: true },
                { label: '  Autres dettes', value: 0, indent: true },
                { label: '', value: null, spacer: true },
                { label: 'TRÉSORERIE - PASSIF', value: 0, bold: true, bg: '#f1f5f9' },
                { label: '  Découverts bancaires', value: 0, indent: true },
            ];

            passifItems.forEach((item) => {
                if (item.spacer) {
                    currentY_Passif += 15;
                    return;
                }

                if (item.bg) {
                    doc.rect(startX_Passif, currentY_Passif - 4, colWidth, 20).fill(item.bg);
                }

                const font = item.bold ? 'Helvetica-Bold' : 'Helvetica';
                const size = item.bold ? 10 : 9;
                const color = item.bold ? '#1e293b' : '#334155';

                doc.fontSize(size).font(font).fillColor(color);
                doc.text(item.label, startX_Passif + 5, currentY_Passif, { width: colWidth - 70, continued: false });

                if (item.value !== null) {
                    doc.text(`${formatMoney(item.value)} DH`, startX_Passif + colWidth - 85, currentY_Passif, { width: 80, align: 'right' });
                }

                currentY_Passif += 20;
            });

            // --- SEPARATOR LINE ---
            const finalY = Math.max(currentY_Actif, currentY_Passif) + 20;

            // Vertical line
            doc.lineWidth(1).strokeColor('#e2e8f0');
            doc.moveTo(pageWidth / 2, startY).lineTo(pageWidth / 2, finalY).stroke();


            // --- TOTALS ROW (Aligned) ---
            const totalY = finalY;

            // Total Actif Box
            doc.rect(startX_Actif, totalY, colWidth, 30).fill('#1e3a8a');
            doc.fontSize(12).font('Helvetica-Bold').fillColor('#fff');
            doc.text('TOTAL ACTIF', startX_Actif + 10, totalY + 8);
            doc.text(`${formatMoney(balance.actif.total)} DH`, startX_Actif + colWidth - 110, totalY + 8, { width: 100, align: 'right' });

            // Total Passif Box
            doc.rect(startX_Passif, totalY, colWidth, 30).fill('#1e3a8a');
            doc.text('TOTAL PASSIF', startX_Passif + 10, totalY + 8);
            doc.text(`${formatMoney(balance.passif.total)} DH`, startX_Passif + colWidth - 110, totalY + 8, { width: 100, align: 'right' });


            // Footer
            doc.fontSize(8).fillColor('#94a3b8').text(`Généré le ${new Date().toLocaleDateString('fr-FR')}`, margin, 780, { align: 'center' });

            doc.end();
            return doc;
        } catch (e) {
            this.logger.error('Error generating Bilan:', e);
            throw new Error(`Bilan Error: ${e.message}`);
        }
    }

    /**
     * Generates a CSV Trial Balance (Balance des Comptes)
     * Format: Compte;Intitulé;Débit;Crédit;Solde
     */
    async generateTrialBalanceCsv(dto: ExportSageDto): Promise<string> {
        this.logger.log(`Generating Trial Balance CSV: ${JSON.stringify(dto)}`);
        const { startDate, endDate, centreId } = dto;
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        const cid = centreId && centreId !== 'ALL' && centreId !== '' ? centreId : undefined;

        // 1. Get Totals per Category
        const [invoices, payments, expenses] = await Promise.all([
            this.prisma.facture.findMany({
                where: {
                    dateEmission: { lte: end },
                    statut: { notIn: ['ARCHIVE', 'ANNULEE'] },
                    centreId: cid,
                },
                select: { totalHT: true, totalTVA: true, totalTTC: true },
            }),
            this.prisma.paiement.findMany({
                where: {
                    date: { lte: end },
                    statut: 'ENCAISSE',
                    facture: cid ? { centreId: cid } : undefined,
                },
                select: { montant: true },
            }),
            this.prisma.depense.findMany({
                where: {
                    date: { lte: end },
                    statut: { in: ['VALIDEE', 'VALIDÉ', 'PAYEE', 'PAYE'] },
                    centreId: cid,
                },
                select: { montant: true },
            }),
        ]);

        // 2. Calculate Account Totals
        const totalHTVentes = invoices.reduce((sum, i) => sum + (i.totalHT || 0), 0);
        const totalTVAVentes = invoices.reduce((sum, i) => sum + (i.totalTVA || 0), 0);
        const totalTTCVentes = invoices.reduce((sum, i) => sum + (i.totalTTC || 0), 0);

        const totalEncaissements = payments.reduce((sum, p) => sum + (p.montant || 0), 0);

        const totalTTCAchats = expenses.reduce((sum, e) => sum + (e.montant || 0), 0);
        // Approximation for expenses without explicit tax breakdown
        const totalHTAchats = totalTTCAchats / 1.2;
        const totalTVAAchats = totalTTCAchats - totalHTAchats;

        // 3. Build Account Lines
        // Structure: Account Code | Label | Debit | Credit | Balance (Debit - Credit)
        const accounts = [
            // Actif
            { code: this.CONFIG.RECEIVABLE_ACCOUNT, label: 'Clients', debit: totalTTCVentes, credit: totalEncaissements },
            { code: this.CONFIG.CASH_ACCOUNT, label: 'Trésorerie (Caisse/Banque)', debit: totalEncaissements, credit: totalTTCAchats },

            // Passif & Charges
            { code: this.CONFIG.PAYABLE_ACCOUNT, label: 'Fournisseurs', debit: totalTTCAchats, credit: totalTTCAchats }, // Assuming paid
            { code: this.CONFIG.SALES_TAX_ACCOUNT, label: 'État - TVA Facturée', debit: 0, credit: totalTVAVentes },

            // Charges
            { code: this.CONFIG.EXPENSE_ACCOUNT, label: 'Achats de marchandises', debit: totalHTAchats, credit: 0 },
            { code: this.CONFIG.INPUT_TAX_ACCOUNT, label: 'État - TVA Récupérable', debit: totalTVAAchats, credit: 0 },

            // Produits
            { code: this.CONFIG.SALES_REVENUE_ACCOUNT, label: 'Ventes de marchandises', debit: 0, credit: totalHTVentes },
        ];

        // 4. Generate CSV with BOM for Excel UTF-8 support
        const header = '\uFEFFCompte;Intitulé;Débit;Crédit;Solde\n';

        const formatCsvNumber = (num: number) => num.toFixed(2).replace('.', ',');

        const lines = accounts.map(acc => {
            const solde = acc.debit - acc.credit;
            return `${acc.code};${acc.label};${formatCsvNumber(acc.debit)};${formatCsvNumber(acc.credit)};${formatCsvNumber(solde)}`;
        });

        // Add Totals Line
        const grandTotalDebit = accounts.reduce((sum, acc) => sum + acc.debit, 0);
        const grandTotalCredit = accounts.reduce((sum, acc) => sum + acc.credit, 0);
        lines.push(`;TOTAUX;${formatCsvNumber(grandTotalDebit)};${formatCsvNumber(grandTotalCredit)};${formatCsvNumber(grandTotalDebit - grandTotalCredit)}`);

        return header + lines.join('\n');
    }

    /**
     * Generates Landscape PDF with TVA rate sorting (20%, 14%, etc. - Max to Min)
     */
    private async generateJournalPdfLandscape(dto: ExportSageDto) {
        this.logger.log(`Starting Landscape PDF Generation: ${JSON.stringify(dto)}`);
        const { startDate, endDate, centreId } = dto;
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        const cid = centreId && centreId !== 'ALL' && centreId !== '' ? centreId : undefined;

        let [payments, expenses] = await Promise.all([
            this.prisma.paiement.findMany({
                where: {
                    date: { gte: start, lte: end },
                    statut: 'ENCAISSE',
                    facture: cid ? { centreId: cid } : undefined,
                },
                include: { facture: { include: { client: true } } },
            }),
            this.prisma.depense.findMany({
                where: {
                    date: { gte: start, lte: end },
                    statut: { in: ['VALIDEE', 'VALIDÉ', 'PAYEE', 'PAYE'] },
                    centreId: cid,
                },
                include: { fournisseur: true, factureFournisseur: true },
            }),
        ]);

        // Helper to get TVA rate
        const getPaymentTvaRate = (p: any): number => {
            if (p.facture?.totalTTC && p.facture?.totalHT) {
                const tva = p.facture.totalTTC - p.facture.totalHT;
                if (p.facture.totalHT > 0) return (tva / p.facture.totalHT) * 100;
            }
            return 20;
        };

        const getExpenseTvaRate = (e: any): number => {
            if (e.factureFournisseur?.montantHT && e.factureFournisseur?.montantTVA) {
                return (e.factureFournisseur.montantTVA / e.factureFournisseur.montantHT) * 100;
            }
            return 20;
        };

        payments = payments.sort((a, b) => getPaymentTvaRate(b) - getPaymentTvaRate(a));
        expenses = expenses.sort((a, b) => getExpenseTvaRate(b) - getExpenseTvaRate(a));

        const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape', bufferPages: true });
        const formatMoney = (amount: number) => (amount || 0).toFixed(2);
        const formatDate = (date: Date | string) => this.formatDateDisplay(date);

        const drawTable = (title: string, headers: string[], colWidths: number[], rows: string[][], totals: { [key: number]: number }, headerColor: string = '#dbeafe') => {
            if (doc.y + 100 > 550) doc.addPage();

            doc.fontSize(14).font('Helvetica-Bold').fillColor('#000').text(title, 30, doc.y, { align: 'center', width: 780 });
            doc.moveDown(0.5);
            doc.fontSize(10).font('Helvetica').text(`Période du ${formatDate(start)} au ${formatDate(end)}`, { align: 'center' });
            doc.moveDown(1.5);

            const totalTableWidth = colWidths.reduce((a, b) => a + b, 0);
            const pageWidth = 841.89;
            const startX = (pageWidth - totalTableWidth) / 2;

            const rowHeight = 20;
            let currentY = doc.y;

            const drawHeaders = (y: number) => {
                doc.save().rect(startX, y, totalTableWidth, rowHeight).fill(headerColor).stroke().restore();
                let x = startX;
                doc.font('Helvetica-Bold').fontSize(8).fillColor('#000');
                headers.forEach((h, i) => {
                    doc.text(h, x + 2, y + 6, { width: colWidths[i] - 4, align: 'center' });
                    doc.rect(x, y, colWidths[i], rowHeight).stroke();
                    x += colWidths[i];
                });
            };

            drawHeaders(currentY);
            currentY += rowHeight;

            doc.font('Helvetica').fontSize(8);
            rows.forEach((row, rowIndex) => {
                if (currentY + rowHeight > 550) {
                    doc.addPage();
                    currentY = 40;
                    drawHeaders(currentY);
                    currentY += rowHeight;
                    doc.font('Helvetica').fontSize(8);
                }

                let currentX = startX;
                if (rowIndex % 2 === 1) {
                    doc.save().rect(startX, currentY, totalTableWidth, rowHeight).fill('#f8fafc').restore();
                }

                row.forEach((cell, i) => {
                    const isAmount = cell.includes('.');
                    const align = i > 3 && isAmount ? 'right' : 'center';
                    doc.fillColor('#000').text(cell, currentX + 2, currentY + 6, { width: colWidths[i] - 4, align });
                    doc.rect(currentX, currentY, colWidths[i], rowHeight).stroke();
                    currentX += colWidths[i];
                });
                currentY += rowHeight;
            });

            // --- Column-Aligned Subtotals ---
            if (currentY + rowHeight > 550) {
                doc.addPage();
                currentY = 40;
            }

            // Draw Totals Row Background
            const totalsColor = headerColor === '#dbeafe' ? '#10b981' : '#ef4444'; // Green for Sales, Red for Expenses
            const textColor = '#ffffff';

            doc.save().rect(startX, currentY, totalTableWidth, rowHeight).fill(totalsColor).stroke().restore();

            let currentX = startX;
            doc.font('Helvetica-Bold').fontSize(8).fillColor(textColor);

            // "TOTAUX" label in first column
            doc.text("TOTAUX", currentX + 2, currentY + 6, { width: colWidths[0] - 4, align: 'left' });
            doc.rect(currentX, currentY, colWidths[0], rowHeight).stroke();
            currentX += colWidths[0];

            // Loop through other columns
            for (let i = 1; i < colWidths.length; i++) {
                if (totals[i] !== undefined) {
                    const val = formatMoney(totals[i]);
                    doc.text(val, currentX + 2, currentY + 6, { width: colWidths[i] - 4, align: 'right' });
                }
                doc.rect(currentX, currentY, colWidths[i], rowHeight).stroke();
                currentX += colWidths[i];
            }

            doc.y = currentY + 30; // Move cursor well below table
        };

        try {
            // --- ENCAISSEMENTS ---
            const salesHeaders = ['LIBELLE', 'Client', 'Date Fac', 'N° Facture', 'Montant TTC', 'Montant HT', 'Taux TVA', 'TVA', 'Mode', 'Timbre', 'Date Reg'];
            const salesWidths = [140, 90, 55, 55, 65, 65, 50, 60, 75, 45, 55];

            let totalSalesTTC = 0;
            let totalSalesHT = 0;
            let totalSalesTVA = 0;
            let totalSalesTimbre = 0;

            const salesRows = payments.map(p => {
                const ttc = p.montant || 0;
                const tvaRate = getPaymentTvaRate(p);
                const ht = ttc / (1 + tvaRate / 100);
                const tva = ttc - ht;

                // Stamp Duty (Droits de Timbre) - 0.25% on Cash Payments
                // LF 2026 maintains standard practice: 0.25% on cash transactions
                let timbre = 0;
                if (p.mode === 'ESPECES' || p.mode === 'ESPÈCES' || p.mode === 'CASH') {
                    timbre = ttc * 0.0025;
                }

                totalSalesTTC += ttc;
                totalSalesHT += ht;
                totalSalesTVA += tva;
                totalSalesTimbre += timbre;

                return [
                    `Vente ${p.facture?.numero || 'Divers'}`.substring(0, 30),
                    p.facture?.client?.nom || 'Client Divers',
                    formatDate(p.facture?.dateEmission || p.date),
                    p.facture?.numero || '-',
                    formatMoney(ttc),
                    formatMoney(ht),
                    `${tvaRate.toFixed(0)}%`,
                    formatMoney(tva),
                    p.mode || 'ESPECES',
                    formatMoney(timbre),
                    formatDate(p.date)
                ];
            });

            // Totals map by column index
            // TTC: 4, HT: 5, TVA: 7, Timbre: 9
            const salesTotals = {
                4: totalSalesTTC,
                5: totalSalesHT,
                7: totalSalesTVA,
                9: totalSalesTimbre
            };

            drawTable('ETAT DES ENCAISSEMENTS', salesHeaders, salesWidths, salesRows, salesTotals, '#dbeafe');

            doc.addPage();

            // --- DEPENSES ---
            const purchaseHeaders = ['Facture n°', 'Date Fac', 'I.F', 'Fournisseur', 'Nature', 'Mnt TTC', 'Mnt HT', 'Taux', 'TVA', 'Mode', 'Pièce', 'Date Paie'];
            const purchaseWidths = [60, 60, 60, 100, 120, 70, 70, 40, 60, 60, 60, 60];

            let totalPurchasesTTC = 0;
            let totalPurchasesHT = 0;
            let totalPurchasesTVA = 0;

            const purchaseRows = expenses.map(exp => {
                const ttc = exp.montant || 0;
                const tvaRate = getExpenseTvaRate(exp);
                const ht = ttc / (1 + tvaRate / 100);
                const tva = ttc - ht;

                totalPurchasesTTC += ttc;
                totalPurchasesHT += ht;
                totalPurchasesTVA += tva;

                return [
                    exp.factureFournisseur?.numeroFacture || exp.reference || '-',
                    formatDate(exp.factureFournisseur?.dateEmission || exp.date),
                    exp.fournisseur?.identifiantFiscal || '-',
                    exp.fournisseur?.nom || 'Fournisseur Divers',
                    exp.categorie || 'Achat',
                    formatMoney(ttc),
                    formatMoney(ht),
                    `${tvaRate.toFixed(0)}%`,
                    formatMoney(tva),
                    exp.modePaiement || '-',
                    exp.reference || '-',
                    formatDate(exp.date)
                ];
            });

            // Totals map by column index
            // TTC: 5, HT: 6, TVA: 8
            const purchaseTotals = {
                5: totalPurchasesTTC,
                6: totalPurchasesHT,
                8: totalPurchasesTVA
            };

            drawTable('RELEVE DES ACHATS, LIVRAISONS ET TRAVAUX', purchaseHeaders, purchaseWidths, purchaseRows, purchaseTotals, '#e0e7ff');

            // --- RECAPITULATIF SECTION ---
            doc.addPage();
            doc.fontSize(16).font('Helvetica-Bold').fillColor('#000').text('RÉCAPITULATIF', 30, 40, { align: 'center', width: 780 });
            doc.moveDown(2);

            // AGGREGATION LOGIC
            const salesByMode: { [key: string]: number } = {};
            const salesByTva: { [key: number]: { ht: number, tva: number } } = {};

            payments.forEach(p => {
                const mode = p.mode || 'AUTRE';
                salesByMode[mode] = (salesByMode[mode] || 0) + (p.montant || 0);

                const tvaRate = getPaymentTvaRate(p);
                const ttc = p.montant || 0;
                const ht = ttc / (1 + tvaRate / 100);
                const tva = ttc - ht;

                if (!salesByTva[tvaRate]) salesByTva[tvaRate] = { ht: 0, tva: 0 };
                salesByTva[tvaRate].ht += ht;
                salesByTva[tvaRate].tva += tva;
            });

            const expensesByMode: { [key: string]: number } = {};
            const expensesByTva: { [key: number]: { ht: number, tva: number } } = {};

            expenses.forEach(e => {
                const mode = e.modePaiement || 'AUTRE';
                expensesByMode[mode] = (expensesByMode[mode] || 0) + (e.montant || 0);

                const tvaRate = getExpenseTvaRate(e);
                const ttc = e.montant || 0;
                const ht = ttc / (1 + tvaRate / 100);
                const tva = ttc - ht;

                if (!expensesByTva[tvaRate]) expensesByTva[tvaRate] = { ht: 0, tva: 0 };
                expensesByTva[tvaRate].ht += ht;
                expensesByTva[tvaRate].tva += tva;
            });

            const drawRecapTable = (title: string, x: number, y: number, headers: string[], rows: string[][], color: string) => {
                doc.fontSize(10).font('Helvetica-Bold').fillColor('#000').text(title, x, y);
                y += 15;
                const colWidth = 100;

                // Header
                doc.save().rect(x, y, headers.length * colWidth, 20).fill(color).stroke().restore();
                headers.forEach((h, i) => {
                    doc.fillColor('#000').text(h, x + (i * colWidth) + 5, y + 6);
                });
                y += 20;

                // Rows
                doc.font('Helvetica');
                rows.forEach(row => {
                    row.forEach((cell, i) => {
                        doc.rect(x + (i * colWidth), y, colWidth, 20).stroke();
                        doc.text(cell, x + (i * colWidth) + 5, y + 6);
                    });
                    y += 20;
                });
                return y;
            };

            let yPos = 80;

            // SALES RECAP
            doc.fontSize(12).font('Helvetica-Bold').text('VENTES', 50, yPos);
            yPos += 20;

            const salesModeRows = Object.entries(salesByMode).map(([mode, amt]) => [mode, formatMoney(amt)]);
            if (totalSalesTimbre > 0) salesModeRows.push(['TIMBRE', formatMoney(totalSalesTimbre)]); // Add Timbre line

            drawRecapTable('Par Mode de Paiement', 50, yPos, ['Mode', 'Montant TTC'], salesModeRows, '#dbeafe');

            const salesTvaRows = Object.entries(salesByTva).map(([rate, vals]) => [`${parseFloat(rate).toFixed(0)}%`, formatMoney(vals.ht), formatMoney(vals.tva)]);
            drawRecapTable('Par Taux de TVA', 350, yPos, ['Taux', 'Base HT', 'Montant TVA'], salesTvaRows, '#dbeafe');

            yPos += Math.max(salesModeRows.length, salesTvaRows.length) * 20 + 60;

            // EXPENSES RECAP
            doc.fontSize(12).font('Helvetica-Bold').text('ACHATS', 50, yPos);
            yPos += 20;

            const expenseModeRows = Object.entries(expensesByMode).map(([mode, amt]) => [mode, formatMoney(amt)]);
            drawRecapTable('Par Mode de Paiement', 50, yPos, ['Mode', 'Montant TTC'], expenseModeRows, '#e0e7ff');

            const expenseTvaRows = Object.entries(expensesByTva).map(([rate, vals]) => [`${parseFloat(rate).toFixed(0)}%`, formatMoney(vals.ht), formatMoney(vals.tva)]);
            drawRecapTable('Par Taux de TVA', 350, yPos, ['Taux', 'Base HT', 'Montant TVA'], expenseTvaRows, '#e0e7ff');

            const range = doc.bufferedPageRange();
            for (let i = range.start; i < range.start + range.count; i++) {
                doc.switchToPage(i);
                doc.fontSize(8).fillColor('#666').text(`Page ${i + 1} / ${range.count}`, 750, 550, { align: 'right' });
            }

            doc.end();
            return doc;
        } catch (e) {
            this.logger.error('Error PDF:', e);
            throw new Error(`PDF Error: ${e.message}`);
        }
    }
}
