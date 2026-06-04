import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ExportSageDto } from './dto/export-sage.dto';

// Use require for pdfkit to avoid constructor issues in mixed ESM/CJS environments
const PDFDocument = require('pdfkit');

@Injectable()
export class AccountingService {
  private readonly logger = new Logger(AccountingService.name);

  constructor(private prisma: PrismaService) {}

  // Default Mapping (Plan Comptable Marocain)
  private readonly CONFIG = {
    RECEIVABLE_ACCOUNT: '3421', // Clients
    SALES_REVENUE_ACCOUNT: '7111', // Ventes
    SALES_TAX_ACCOUNT: '4455', // TVA CollectÃ©e
    CASH_ACCOUNT: '5161', // Caisse
    PAYABLE_ACCOUNT: '4411', // Fournisseurs
    EXPENSE_ACCOUNT: '6111', // Achats
    INPUT_TAX_ACCOUNT: '3455', // TVA DÃ©ductible
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

    // BUG-007 FIX: Ensure centreId is always provided (security)
    if (!centreId || centreId === 'ALL' || centreId === '') {
      throw new Error(
        'Export Sage requires specific centre ID (no ALL export allowed)',
      );
    }

    const [invoices, payments, expenses] = await Promise.all([
      this.prisma.facture.findMany({
        where: {
          dateEmission: { gte: start, lte: end },
          statut: { in: ['VALIDE', 'VALIDEE', 'PAYEE', 'SOLDEE', 'ENCAISSE'] },
          centreId: centreId, // BUG-007: Mandatory filter (not optional)
          exportComptable: true,
          type: 'FACTURE', // Only fiscal invoices (not DEVIS, BON_COMM, AVOIR)
        },
        include: { client: true },
        orderBy: { dateEmission: 'asc' },
      }),
      this.prisma.paiement.findMany({
        where: {
          date: { gte: start, lte: end },
          statut: 'ENCAISSE',
          facture: {
            centreId: centreId, // BUG-007: Mandatory filter
            type: 'FACTURE', // Only fiscal invoices
          },
        },
        include: { facture: { include: { client: true } } },
        orderBy: { date: 'asc' },
      }),
      this.prisma.depense.findMany({
        where: {
          date: { gte: start, lte: end },
          statut: { in: ['VALIDEE', 'VALIDÃ‰', 'PAYEE', 'PAYE'] },
          centreId: centreId, // BUG-007: Mandatory filter
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
          `${lineNumber++}\t${dateStr}\t${this.CONFIG.SALES_TAX_ACCOUNT}\t${ref}\tTVA CollectÃ©e\tC\t${tva.toFixed(2)}`,
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
          `${lineNumber++}\t${dateStr}\t${this.CONFIG.INPUT_TAX_ACCOUNT}\t${ref}\tTVA DÃ©ductible\tD\t${tva.toFixed(2)}`,
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
      const [
        invoices,
        payments,
        paymentsOnBC,
        expenses,
        stock,
        bankTransactions,
        companySettings,
      ] = await Promise.all([
        // 1. Real FACTURES only (not BC/DEVIS) - real revenue & receivables
        this.prisma.facture.findMany({
          where: {
            dateEmission: { lte: end },
            centreId: cid,
            type: 'FACTURE',
            statut: { notIn: ['ARCHIVE', 'ANNULEE'] },
          },
          select: {
            dateEmission: true,
            totalHT: true,
            totalTVA: true,
            totalTTC: true,
            resteAPayer: true,
          },
        }),
        // 2. Payments on real FACTURES
        this.prisma.paiement.findMany({
          where: {
            date: { lte: end },
            statut: 'ENCAISSE',
            facture: cid
              ? { centreId: cid, type: 'FACTURE' }
              : { type: 'FACTURE' },
          },
          select: { montant: true },
        }),
        // 3. Payments on BON_COMMANDE = Avances clients (deposits not yet invoiced)
        this.prisma.paiement.findMany({
          where: {
            date: { lte: end },
            statut: 'ENCAISSE',
            facture: cid
              ? { centreId: cid, type: 'BON_COMMANDE' }
              : { type: 'BON_COMMANDE' },
          },
          select: { montant: true },
        }),
        // 4. Expenses
        this.prisma.depense.findMany({
          where: {
            date: { lte: end },
            statut: { in: ['VALIDEE', 'VALID\u00C9E', 'PAYEE', 'PAYE', 'PAY\u00C9E'] },
            centreId: cid,
          },
          select: { date: true, montant: true, statut: true },
        }),
        // 5. Stock
        this.prisma.product.findMany({
          where: {
            entrepot: cid ? { centreId: cid } : undefined,
          },
          select: { quantiteActuelle: true, prixAchatHT: true },
        }),
        // 6. Bank fees (agios, frais, prÃ©lÃ¨vements)
        this.prisma.transactionBancaire.findMany({
          where: {
            dateTransaction: { lte: end },
            type: 'DEBIT',
            typeTransaction: { in: ['AGIOS', 'FRAIS', 'PRELEVEMENT'] },
          },
          select: { dateTransaction: true, montant: true },
        }),
        // 7. Company settings (capital social)
        this.prisma.companySettings.findFirst(),
      ]);

      // --- Cumulative totals (Actif - balance sheet snapshot at end date) ---
      const totalCreances = invoices.reduce((sum, inv) => sum + (inv.resteAPayer || 0), 0);
      const totalEncaissements = payments.reduce((sum, p) => sum + (p.montant || 0), 0);
      // Avances clients = cash received on BCs not yet converted to invoices
      const avancesClients = paymentsOnBC.reduce((sum, p) => sum + (p.montant || 0), 0);

      const totalDepenses_TTC = expenses.reduce((sum, exp) => sum + (exp.montant || 0), 0);
      const unpaidExpenses_TTC = expenses
        .filter(exp => exp.statut.toUpperCase().startsWith('VALID'))
        .reduce((sum, exp) => sum + (exp.montant || 0), 0);
      const totalBankFees = bankTransactions.reduce((sum, t) => sum + (t.montant || 0), 0);
      const stockValue = stock.reduce((sum, p) => sum + p.quantiteActuelle * p.prixAchatHT, 0);

      // Cash in = payments on real invoices + advance deposits on BCs
      const totalCashIn = totalEncaissements + avancesClients;
      const totalCashOut = (totalDepenses_TTC - unpaidExpenses_TTC) + totalBankFees;
      const tresorerie = totalCashIn - totalCashOut;
      const totalActif = stockValue + totalCreances + tresorerie;

      // --- TVA Logic (only on real FACTURES) ---
      const tvaCollectee = invoices.reduce((sum, inv) => sum + (inv.totalTVA || 0), 0);
      const tvaDeductible = expenses.reduce((sum, exp) => {
        const m = exp.montant || 0;
        const ht = m / 1.2;
        return sum + (m - ht);
      }, 0);
      const tvaAPayer = Math.max(0, tvaCollectee - tvaDeductible);

      // --- Resultat of the PERIOD only (only real FACTURES in the date range) ---
      const periodInvoices = invoices.filter(inv => new Date(inv.dateEmission) >= start);
      const periodExpenses = expenses.filter(exp => new Date(exp.date) >= start);
      const periodBankFees = bankTransactions.filter(t => new Date(t.dateTransaction) >= start);

      const periodCA_HT = periodInvoices.reduce((sum, inv) => sum + (inv.totalHT || 0), 0);
      const periodDepenses_HT = periodExpenses.reduce((sum, exp) => sum + ((exp.montant || 0) / 1.2), 0);
      const periodBankFeesTotal = periodBankFees.reduce((sum, t) => sum + (t.montant || 0), 0);

      const resultat_period = periodCA_HT - periodDepenses_HT - periodBankFeesTotal;

      // --- Passif Balancing ---
      // Total Actif = Capital + Reserves + Resultat + AvancesClients + Dettes + TVA
      const capitalSocial = companySettings?.capitalSocial ?? 0;
      // Reserves = balancing figure (retained earnings from all periods before start date)
      const reserves = totalActif - (capitalSocial + resultat_period + avancesClients + unpaidExpenses_TTC + tvaAPayer);
      const totalPassif = capitalSocial + reserves + resultat_period + avancesClients + unpaidExpenses_TTC + tvaAPayer;

      return {
        actif: {
          immobilisations: 0,
          stock: stockValue,
          creances: totalCreances,
          tresorerie: tresorerie,
          total: totalActif,
        },
        passif: {
          capitaux: capitalSocial,
          reserves: reserves,
          avancesClients: avancesClients,
          dettes: unpaidExpenses_TTC,
          resultat: resultat_period,
          total: totalPassif,
        },
        exploitation: {
          chiffreAffaires: periodCA_HT,
          achats: periodDepenses_HT,
          resultat: resultat_period,
        },
        tva: {
          collectee: tvaCollectee,
          deductible: tvaDeductible,
          aPayer: tvaAPayer,
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

    const cid =
      centreId && centreId !== 'ALL' && centreId !== '' ? centreId : undefined;

    const balance = await this.generateBalance(dto);

    const doc = new PDFDocument({ margin: 40, size: 'A4', bufferPages: true });

    const formatMoney = (amount: number) =>
      amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

    try {
      // Header
      doc
        .fontSize(20)
        .font('Helvetica-Bold')
        .fillColor('#1e3a8a')
        .text('BILAN COMPTABLE', { align: 'center' });
      doc.moveDown(0.5);
      doc
        .fontSize(10)
        .font('Helvetica')
        .fillColor('#666')
        .text(
          `PÃ©riode : ${this.formatDateDisplay(start)} au ${this.formatDateDisplay(end)}`,
          { align: 'center' },
        );
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
      doc.text('ACTIF', startX_Actif, startY + 8, {
        width: colWidth,
        align: 'center',
      });
      doc.text('PASSIF', startX_Passif, startY + 8, {
        width: colWidth,
        align: 'center',
      });

      let currentY_Actif = startY + 40;
      let currentY_Passif = startY + 40;

      // --- ACTIF CONTENT ---
      const actifItems = [
        {
          label: 'ACTIF IMMOBILISÃ‰',
          value: balance.actif.immobilisations,
          bold: true,
          bg: '#f1f5f9',
        },
        { label: '  Immobilisations corporelles', value: 0, indent: true },
        { label: '  Immobilisations incorporelles', value: 0, indent: true },
        { label: '', value: null, spacer: true },
        { label: 'ACTIF CIRCULANT', value: null, bold: true, bg: '#f1f5f9' },
        {
          label: '  Stocks et en-cours',
          value: balance.actif.stock,
          indent: true,
        },
        {
          label: '  CrÃ©ances clients',
          value: balance.actif.creances,
          indent: true,
        },
        { label: '  Autres crÃ©ances', value: 0, indent: true },
        { label: '', value: null, spacer: true },
        {
          label: 'TRÃ‰SORERIE - ACTIF',
          value: balance.actif.tresorerie,
          bold: true,
          bg: '#f1f5f9',
        },
        {
          label: '  Banques',
          value: balance.actif.tresorerie * 0.7,
          indent: true,
        },
        {
          label: '  Caisses',
          value: balance.actif.tresorerie * 0.3,
          indent: true,
        },
      ];

      actifItems.forEach((item) => {
        if (item.spacer) {
          currentY_Actif += 15;
          return;
        }

        if (item.bg) {
          doc
            .rect(startX_Actif, currentY_Actif - 4, colWidth, 20)
            .fill(item.bg);
        }

        const font = item.bold ? 'Helvetica-Bold' : 'Helvetica';
        const size = item.bold ? 10 : 9;
        const color = item.bold ? '#1e293b' : '#334155';

        doc.fontSize(size).font(font).fillColor(color);
        doc.text(item.label, startX_Actif + 5, currentY_Actif, {
          width: colWidth - 70,
          continued: false,
        });

        if (item.value !== null) {
          doc.text(
            `${formatMoney(item.value)} DH`,
            startX_Actif + colWidth - 85,
            currentY_Actif,
            { width: 80, align: 'right' },
          );
        }

        currentY_Actif += 20;
      });

      // --- PASSIF CONTENT ---
      const passifItems = [
        { label: 'CAPITAUX PROPRES', value: null, bold: true, bg: '#f1f5f9' },
        {
          label: '  Capital social',
          value: balance.passif.capitaux,
          indent: true,
        },
        { label: '  R\u00E9serves', value: balance.passif.reserves, indent: true },
        {
          label: "  R\u00E9sultat de l'exercice",
          value: balance.passif.resultat,
          indent: true,
        },
        { label: '', value: null, spacer: true },
        {
          label: 'AVANCES CLIENTS',
          value: null,
          bold: true,
          bg: '#fef9c3',
        },
        {
          label: '  Acomptes sur commandes (BC)',
          value: balance.passif.avancesClients,
          indent: true,
        },
        { label: '', value: null, spacer: true },
        { label: 'DETTES', value: null, bold: true, bg: '#f1f5f9' },
        {
          label: '  Dettes fournisseurs',
          value: balance.passif.dettes,
          indent: true,
        },
        {
          label: '  Dettes fiscales et sociales',
          value: balance.tva.aPayer,
          indent: true,
        },
        { label: '  Autres dettes', value: 0, indent: true },
        { label: '', value: null, spacer: true },
        { label: 'TR\u00C9SORERIE - PASSIF', value: 0, bold: true, bg: '#f1f5f9' },
        { label: '  D\u00E9couverts bancaires', value: 0, indent: true },
      ];

      passifItems.forEach((item) => {
        if (item.spacer) {
          currentY_Passif += 15;
          return;
        }

        if (item.bg) {
          doc
            .rect(startX_Passif, currentY_Passif - 4, colWidth, 20)
            .fill(item.bg);
        }

        const font = item.bold ? 'Helvetica-Bold' : 'Helvetica';
        const size = item.bold ? 10 : 9;
        const color = item.bold ? '#1e293b' : '#334155';

        doc.fontSize(size).font(font).fillColor(color);
        doc.text(item.label, startX_Passif + 5, currentY_Passif, {
          width: colWidth - 70,
          continued: false,
        });

        if (item.value !== null) {
          doc.text(
            `${formatMoney(item.value)} DH`,
            startX_Passif + colWidth - 85,
            currentY_Passif,
            { width: 80, align: 'right' },
          );
        }

        currentY_Passif += 20;
      });

      // --- SEPARATOR LINE ---
      const finalY = Math.max(currentY_Actif, currentY_Passif) + 20;

      // Vertical line
      doc.lineWidth(1).strokeColor('#e2e8f0');
      doc
        .moveTo(pageWidth / 2, startY)
        .lineTo(pageWidth / 2, finalY)
        .stroke();

      // --- TOTALS ROW (Aligned) ---
      const totalY = finalY;

      // Total Actif Box
      doc.rect(startX_Actif, totalY, colWidth, 30).fill('#1e3a8a');
      doc.fontSize(12).font('Helvetica-Bold').fillColor('#fff');
      doc.text('TOTAL ACTIF', startX_Actif + 10, totalY + 8);
      doc.text(
        `${formatMoney(balance.actif.total)} DH`,
        startX_Actif + colWidth - 110,
        totalY + 8,
        { width: 100, align: 'right' },
      );

      // Total Passif Box
      doc.rect(startX_Passif, totalY, colWidth, 30).fill('#1e3a8a');
      doc.fillColor('#fff'); // FIX: Text in white
      doc.text('TOTAL PASSIF', startX_Passif + 10, totalY + 8);
      doc.text(
        `${formatMoney(balance.passif.total)} DH`,
        startX_Passif + colWidth - 110,
        totalY + 8,
        { width: 100, align: 'right' },
      );

      // Footer
      doc
        .fontSize(8)
        .fillColor('#94a3b8')
        .text(
          `GÃ©nÃ©rÃ© le ${new Date().toLocaleDateString('fr-FR')}`,
          margin,
          780,
          { align: 'center' },
        );

      doc.end();
      return doc;
    } catch (e) {
      this.logger.error('Error generating Bilan:', e);
      throw new Error(`Bilan Error: ${e.message}`);
    }
  }

  /**
   * Generates a CSV Trial Balance (Balance des Comptes)
   * Format: Compte;IntitulÃ©;DÃ©bit;CrÃ©dit;Solde
   */
  async generateTrialBalanceCsv(dto: ExportSageDto): Promise<string> {
    this.logger.log(`Generating Trial Balance CSV: ${JSON.stringify(dto)}`);
    const { startDate, endDate, centreId } = dto;
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const cid =
      centreId && centreId !== 'ALL' && centreId !== '' ? centreId : undefined;

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
          statut: { in: ['VALIDEE', 'VALIDÃ‰', 'PAYEE', 'PAYE'] },
          centreId: cid,
        },
        select: { montant: true },
      }),
    ]);

    // 2. Calculate Account Totals
    const totalHTVentes = invoices.reduce(
      (sum, i) => sum + (i.totalHT || 0),
      0,
    );
    const totalTVAVentes = invoices.reduce(
      (sum, i) => sum + (i.totalTVA || 0),
      0,
    );
    const totalTTCVentes = invoices.reduce(
      (sum, i) => sum + (i.totalTTC || 0),
      0,
    );

    const totalEncaissements = payments.reduce(
      (sum, p) => sum + (p.montant || 0),
      0,
    );

    const totalTTCAchats = expenses.reduce(
      (sum, e) => sum + (e.montant || 0),
      0,
    );
    // Approximation for expenses without explicit tax breakdown
    const totalHTAchats = totalTTCAchats / 1.2;
    const totalTVAAchats = totalTTCAchats - totalHTAchats;

    // 3. Build Account Lines
    // Structure: Account Code | Label | Debit | Credit | Balance (Debit - Credit)
    const accounts = [
      // Actif
      {
        code: this.CONFIG.RECEIVABLE_ACCOUNT,
        label: 'Clients',
        debit: totalTTCVentes,
        credit: totalEncaissements,
      },
      {
        code: this.CONFIG.CASH_ACCOUNT,
        label: 'TrÃ©sorerie (Caisse/Banque)',
        debit: totalEncaissements,
        credit: totalTTCAchats,
      },

      // Passif & Charges
      {
        code: this.CONFIG.PAYABLE_ACCOUNT,
        label: 'Fournisseurs',
        debit: totalTTCAchats,
        credit: totalTTCAchats,
      }, // Assuming paid
      {
        code: this.CONFIG.SALES_TAX_ACCOUNT,
        label: 'Ã‰tat - TVA FacturÃ©e',
        debit: 0,
        credit: totalTVAVentes,
      },

      // Charges
      {
        code: this.CONFIG.EXPENSE_ACCOUNT,
        label: 'Achats de marchandises',
        debit: totalHTAchats,
        credit: 0,
      },
      {
        code: this.CONFIG.INPUT_TAX_ACCOUNT,
        label: 'Ã‰tat - TVA RÃ©cupÃ©rable',
        debit: totalTVAAchats,
        credit: 0,
      },

      // Produits
      {
        code: this.CONFIG.SALES_REVENUE_ACCOUNT,
        label: 'Ventes de marchandises',
        debit: 0,
        credit: totalHTVentes,
      },
    ];

    // 4. Generate CSV with BOM for Excel UTF-8 support
    const header = '\uFEFFCompte;IntitulÃ©;DÃ©bit;CrÃ©dit;Solde\n';

    const formatCsvNumber = (num: number) => num.toFixed(2).replace('.', ',');

    const lines = accounts.map((acc) => {
      const solde = acc.debit - acc.credit;
      return `${acc.code};${acc.label};${formatCsvNumber(acc.debit)};${formatCsvNumber(acc.credit)};${formatCsvNumber(solde)}`;
    });

    // Add Totals Line
    const grandTotalDebit = accounts.reduce((sum, acc) => sum + acc.debit, 0);
    const grandTotalCredit = accounts.reduce((sum, acc) => sum + acc.credit, 0);
    lines.push(
      `;TOTAUX;${formatCsvNumber(grandTotalDebit)};${formatCsvNumber(grandTotalCredit)};${formatCsvNumber(grandTotalDebit - grandTotalCredit)}`,
    );

    return header + lines.join('\n');
  }

  /**
   * Generates Landscape PDF with TVA rate sorting (20%, 14%, etc. - Max to Min)
   */
  private async generateJournalPdfLandscape(dto: ExportSageDto) {
    this.logger.log(
      `Starting Landscape PDF Generation: ${JSON.stringify(dto)}`,
    );
    const { startDate, endDate, centreId } = dto;
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const cid =
      centreId && centreId !== 'ALL' && centreId !== '' ? centreId : undefined;

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
          statut: { in: ['VALIDEE', 'VALIDÃ‰', 'PAYEE', 'PAYE'] },
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
        return (
          (e.factureFournisseur.montantTVA / e.factureFournisseur.montantHT) *
          100
        );
      }
      return 20;
    };

    payments = payments.sort(
      (a, b) => getPaymentTvaRate(b) - getPaymentTvaRate(a),
    );
    expenses = expenses.sort(
      (a, b) => getExpenseTvaRate(b) - getExpenseTvaRate(a),
    );

    const doc = new PDFDocument({
      margin: 30,
      size: 'A4',
      layout: 'landscape',
      bufferPages: true,
    });
    const formatMoney = (amount: number) => (amount || 0).toFixed(2);
    const formatDate = (date: Date | string) => this.formatDateDisplay(date);

    const drawTable = (
      title: string,
      headers: string[],
      colWidths: number[],
      rows: string[][],
      totals: { [key: number]: number },
      headerColor: string = '#dbeafe',
    ) => {
      if (doc.y + 100 > 550) doc.addPage();

      doc
        .fontSize(14)
        .font('Helvetica-Bold')
        .fillColor('#000')
        .text(title, 30, doc.y, { align: 'center', width: 780 });
      doc.moveDown(0.5);
      doc
        .fontSize(10)
        .font('Helvetica')
        .text(`PÃ©riode du ${formatDate(start)} au ${formatDate(end)}`, {
          align: 'center',
        });
      doc.moveDown(1.5);

      const totalTableWidth = colWidths.reduce((a, b) => a + b, 0);
      const pageWidth = 841.89;
      const startX = (pageWidth - totalTableWidth) / 2;

      const rowHeight = 20;
      let currentY = doc.y;

      const drawHeaders = (y: number) => {
        doc
          .save()
          .rect(startX, y, totalTableWidth, rowHeight)
          .fill(headerColor)
          .stroke()
          .restore();
        let x = startX;
        doc.font('Helvetica-Bold').fontSize(8).fillColor('#000');
        headers.forEach((h, i) => {
          doc.text(h, x + 2, y + 6, {
            width: colWidths[i] - 4,
            align: 'center',
          });
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
          doc
            .save()
            .rect(startX, currentY, totalTableWidth, rowHeight)
            .fill('#f8fafc')
            .restore();
        }

        row.forEach((cell, i) => {
          const isAmount = cell.includes('.');
          const align = i > 3 && isAmount ? 'right' : 'center';
          doc.fillColor('#000').text(cell, currentX + 2, currentY + 6, {
            width: colWidths[i] - 4,
            align,
          });
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

      doc
        .save()
        .rect(startX, currentY, totalTableWidth, rowHeight)
        .fill(totalsColor)
        .stroke()
        .restore();

      let currentX = startX;
      doc.font('Helvetica-Bold').fontSize(8).fillColor(textColor);

      // "TOTAUX" label in first column
      doc.text('TOTAUX', currentX + 2, currentY + 6, {
        width: colWidths[0] - 4,
        align: 'left',
      });
      doc.rect(currentX, currentY, colWidths[0], rowHeight).stroke();
      currentX += colWidths[0];

      // Loop through other columns
      for (let i = 1; i < colWidths.length; i++) {
        if (totals[i] !== undefined) {
          const val = formatMoney(totals[i]);
          doc.text(val, currentX + 2, currentY + 6, {
            width: colWidths[i] - 4,
            align: 'right',
          });
        }
        doc.rect(currentX, currentY, colWidths[i], rowHeight).stroke();
        currentX += colWidths[i];
      }

      doc.y = currentY + 30; // Move cursor well below table
    };

    try {
      // --- ENCAISSEMENTS ---
      const salesHeaders = [
        'LIBELLE',
        'Client',
        'Date Fac',
        'NÂ° Facture',
        'Montant TTC',
        'Montant HT',
        'Taux TVA',
        'TVA',
        'Mode',
        'Timbre',
        'Date Reg',
      ];
      const salesWidths = [140, 90, 55, 55, 65, 65, 50, 60, 75, 45, 55];

      let totalSalesTTC = 0;
      let totalSalesHT = 0;
      let totalSalesTVA = 0;
      let totalSalesTimbre = 0;

      const salesRows = payments.map((p) => {
        const ttc = p.montant || 0;
        const tvaRate = getPaymentTvaRate(p);
        const ht = ttc / (1 + tvaRate / 100);
        const tva = ttc - ht;

        // Stamp Duty (Droits de Timbre) - 0.25% on Cash Payments
        // LF 2026 maintains standard practice: 0.25% on cash transactions
        let timbre = 0;
        if (p.mode === 'ESPECES' || p.mode === 'ESPÃˆCES' || p.mode === 'CASH') {
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
          formatDate(p.date),
        ];
      });

      // Totals map by column index
      // TTC: 4, HT: 5, TVA: 7, Timbre: 9
      const salesTotals = {
        4: totalSalesTTC,
        5: totalSalesHT,
        7: totalSalesTVA,
        9: totalSalesTimbre,
      };

      drawTable(
        'ETAT DES ENCAISSEMENTS',
        salesHeaders,
        salesWidths,
        salesRows,
        salesTotals,
        '#dbeafe',
      );

      doc.addPage();

      // --- DEPENSES ---
      const purchaseHeaders = [
        'Facture nÂ°',
        'Date Fac',
        'I.F',
        'Fournisseur',
        'Nature',
        'Mnt TTC',
        'Mnt HT',
        'Taux',
        'TVA',
        'Mode',
        'PiÃ¨ce',
        'Date Paie',
      ];
      const purchaseWidths = [60, 60, 60, 100, 120, 70, 70, 40, 60, 60, 60, 60];

      let totalPurchasesTTC = 0;
      let totalPurchasesHT = 0;
      let totalPurchasesTVA = 0;

      const purchaseRows = expenses.map((exp) => {
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
          formatDate(exp.date),
        ];
      });

      // Totals map by column index
      // TTC: 5, HT: 6, TVA: 8
      const purchaseTotals = {
        5: totalPurchasesTTC,
        6: totalPurchasesHT,
        8: totalPurchasesTVA,
      };

      drawTable(
        'RELEVE DES ACHATS, LIVRAISONS ET TRAVAUX',
        purchaseHeaders,
        purchaseWidths,
        purchaseRows,
        purchaseTotals,
        '#e0e7ff',
      );

      // --- RECAPITULATIF SECTION ---
      doc.addPage();
      doc
        .fontSize(16)
        .font('Helvetica-Bold')
        .fillColor('#000')
        .text('RÃ‰CAPITULATIF', 30, 40, { align: 'center', width: 780 });
      doc.moveDown(2);

      // AGGREGATION LOGIC
      const salesByMode: { [key: string]: number } = {};
      const salesByTva: { [key: number]: { ht: number; tva: number } } = {};

      payments.forEach((p) => {
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
      const expensesByTva: { [key: number]: { ht: number; tva: number } } = {};

      expenses.forEach((e) => {
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

      const drawRecapTable = (
        title: string,
        x: number,
        y: number,
        headers: string[],
        rows: string[][],
        color: string,
      ) => {
        doc
          .fontSize(10)
          .font('Helvetica-Bold')
          .fillColor('#000')
          .text(title, x, y);
        y += 15;
        const colWidth = 100;

        // Header
        doc
          .save()
          .rect(x, y, headers.length * colWidth, 20)
          .fill(color)
          .stroke()
          .restore();
        headers.forEach((h, i) => {
          doc.fillColor('#000').text(h, x + i * colWidth + 5, y + 6);
        });
        y += 20;

        // Rows
        doc.font('Helvetica');
        rows.forEach((row) => {
          row.forEach((cell, i) => {
            doc.rect(x + i * colWidth, y, colWidth, 20).stroke();
            doc.text(cell, x + i * colWidth + 5, y + 6);
          });
          y += 20;
        });
        return y;
      };

      let yPos = 80;

      // SALES RECAP
      doc.fontSize(12).font('Helvetica-Bold').text('VENTES', 50, yPos);
      yPos += 20;

      const salesModeRows = Object.entries(salesByMode).map(([mode, amt]) => [
        mode,
        formatMoney(amt),
      ]);
      if (totalSalesTimbre > 0)
        salesModeRows.push(['TIMBRE', formatMoney(totalSalesTimbre)]); // Add Timbre line

      drawRecapTable(
        'Par Mode de Paiement',
        50,
        yPos,
        ['Mode', 'Montant TTC'],
        salesModeRows,
        '#dbeafe',
      );

      const salesTvaRows = Object.entries(salesByTva).map(([rate, vals]) => [
        `${parseFloat(rate).toFixed(0)}%`,
        formatMoney(vals.ht),
        formatMoney(vals.tva),
      ]);
      drawRecapTable(
        'Par Taux de TVA',
        350,
        yPos,
        ['Taux', 'Base HT', 'Montant TVA'],
        salesTvaRows,
        '#dbeafe',
      );

      yPos += Math.max(salesModeRows.length, salesTvaRows.length) * 20 + 60;

      // EXPENSES RECAP
      doc.fontSize(12).font('Helvetica-Bold').text('ACHATS', 50, yPos);
      yPos += 20;

      const expenseModeRows = Object.entries(expensesByMode).map(
        ([mode, amt]) => [mode, formatMoney(amt)],
      );
      drawRecapTable(
        'Par Mode de Paiement',
        50,
        yPos,
        ['Mode', 'Montant TTC'],
        expenseModeRows,
        '#e0e7ff',
      );

      const expenseTvaRows = Object.entries(expensesByTva).map(
        ([rate, vals]) => [
          `${parseFloat(rate).toFixed(0)}%`,
          formatMoney(vals.ht),
          formatMoney(vals.tva),
        ],
      );
      drawRecapTable(
        'Par Taux de TVA',
        350,
        yPos,
        ['Taux', 'Base HT', 'Montant TVA'],
        expenseTvaRows,
        '#e0e7ff',
      );

      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        doc
          .fontSize(8)
          .fillColor('#666')
          .text(`Page ${i + 1} / ${range.count}`, 750, 550, { align: 'right' });
      }

      doc.end();
      return doc;
    } catch (e) {
      this.logger.error('Error PDF:', e);
      throw new Error(`PDF Error: ${e.message}`);
    }
  }

    async getTvaBilan(dto: ExportSageDto) {
    const { startDate, endDate, centreId } = dto;
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const centreFilter: any = {};
    if (centreId && centreId !== 'ALL' && centreId !== '') {
      centreFilter.centreId = centreId;
    }

    // -----------------------------------------------------------------------
    // APPROACH: Bank-transaction-based TVA bilan (1 line per bank statement entry)
    // This prevents duplicates when multiple paiement records share 1 bank tx.
    // -----------------------------------------------------------------------
    const [creditTx, allDebitTx, nonReconciledTx] = await Promise.all([
      // All RAPPROCHE CREDIT bank transactions in period (=actual encaissements)
      this.prisma.transactionBancaire.findMany({
        where: {
          dateTransaction: { gte: start, lte: end },
          type: 'CREDIT',
          statutRapprochement: 'RAPPROCHE',
          ...(centreId && centreId !== 'ALL' && centreId !== '' ? { releveBancaire: { compteBancaire: { centreId } } } : {})
        },
        include: {
          paiements: { include: { facture: true } }
        }
      }),
      // All RAPPROCHE DEBIT bank transactions in period (unified: expenses + bank fees)
      // Processed in one pass to avoid double-counting when a FRAIS_BANCAIRES tx has linked depenses
      this.prisma.transactionBancaire.findMany({
        where: {
          dateTransaction: { gte: start, lte: end },
          type: 'DEBIT',
          statutRapprochement: 'RAPPROCHE',
          ...(centreId && centreId !== 'ALL' && centreId !== '' ? { releveBancaire: { compteBancaire: { centreId } } } : {})
        },
        include: {
          depenses: { include: { factureFournisseur: true } }
        }
      }),
      // Non-reconciled transactions for the period (for comparison summary)
      this.prisma.transactionBancaire.findMany({
        where: {
          dateTransaction: { gte: start, lte: end },
          statutRapprochement: 'NON_RAPPROCHE',
          ...(centreId && centreId !== 'ALL' && centreId !== '' ? { releveBancaire: { compteBancaire: { centreId } } } : {})
        }
      })
    ]);

    // Helper: determine TVA rate from linked paiements (take first paiement with facture)
    const getTvaRateFromPaiements = (paiements: any[]): number => {
      for (const p of (paiements || [])) {
        if (p.facture?.totalTTC && p.facture?.totalHT && p.facture.totalHT > 0) {
          const tva = p.facture.totalTTC - p.facture.totalHT;
          return Math.round((tva / p.facture.totalHT) * 100);
        }
      }
      return 20; // default 20%
    };

    // Helper: determine TVA rate from linked depenses
    const getTvaRateFromDepenses = (depenses: any[]): number => {
      for (const e of (depenses || [])) {
        if (e.factureFournisseur?.montantHT && e.factureFournisseur?.montantTVA) {
          return Math.round((e.factureFournisseur.montantTVA / e.factureFournisseur.montantHT) * 100);
        }
      }
      return 20; // default 20%
    };

    // Helper: get best description for a credit bank transaction
    const getCreditDescription = (tx: any): string => {
      if (tx.paiements && tx.paiements.length > 0) {
        const nums = tx.paiements.map((p: any) => p.facture?.numero || p.reference || '').filter(Boolean);
        if (nums.length > 0) return nums.slice(0, 2).join(', ');
      }
      return tx.description || 'Encaissement';
    };

    // Helper: get best description for a debit bank transaction
    const getDebitDescription = (tx: any): string => {
      if (tx.depenses && tx.depenses.length > 0) {
        const refs = tx.depenses.map((e: any) => e.factureFournisseur?.numeroFacture || e.description || '').filter(Boolean);
        if (refs.length > 0) return refs.slice(0, 2).join(', ');
      }
      return tx.description || 'Depense';
    };

    // ---- TVA COLLECTEE (Ventes / Encaissements) ----
    const salesByRate: Record<number, { ht: number; tva: number; ttc: number }> = {};
    let totalSalesTTC = 0;
    let totalSalesHT = 0;
    let totalSalesTVA = 0;
    const salesDetails: any[] = [];

    creditTx.forEach(tx => {
      const rate = getTvaRateFromPaiements(tx.paiements);
      const ttc = tx.montant || 0;
      const ht = ttc / (1 + rate / 100);
      const tva = ttc - ht;

      if (!salesByRate[rate]) salesByRate[rate] = { ht: 0, tva: 0, ttc: 0 };
      salesByRate[rate].ttc += ttc;
      salesByRate[rate].ht += ht;
      salesByRate[rate].tva += tva;

      totalSalesTTC += ttc;
      totalSalesHT += ht;
      totalSalesTVA += tva;

      salesDetails.push({
        date: tx.dateTransaction,
        description: getCreditDescription(tx),
        montantTTC: ttc,
        montantHT: ht,
        montantTVA: tva,
        taux: rate,
        mode: tx.typeTransaction || 'AUTRE'
      });
    });

    // ---- TVA DEDUCTIBLE (Achats / Decaissements + Frais Bancaires) ----
    // Single unified loop over ALL RAPPROCHE DEBIT transactions.
    // TVA rate determined by typeTransaction:
    //   FRAIS_BANCAIRES (commissions, agios, 'operation au debit') -> 10%
    //   Others (normal expense payments) -> rate from linked depense or 20% default
    const expensesByRate: Record<number, { ht: number; tva: number; ttc: number }> = {};
    let totalExpensesTTC = 0;
    let totalExpensesHT = 0;
    let totalExpensesTVA = 0;
    let totalBankFeesTTC = 0;
    let totalBankFeesHT = 0;
    let totalBankFeesTVA = 0;
    const expensesDetails: any[] = [];

    // Descriptions that indicate this is a bank fee (10% TVA)
    const isBankFeeDescription = (desc: string): boolean => {
      const d = (desc || '').toLowerCase();
      return d.includes('commission') || d.includes('agios') || d.includes('frais') ||
             d.includes('timbre') || d.includes('operation au debit') || d.includes('au debit') ||
             d.includes('incident') || d.includes('penalite') || d.includes('cotisation');
    };

    allDebitTx.forEach(tx => {
      const ttc = tx.montant || 0;
      const isBankFee = tx.typeTransaction === 'FRAIS_BANCAIRES' || isBankFeeDescription(tx.description || '');

      let rate: number;
      let ht: number;
      let tva: number;
      let description: string;

      if (isBankFee) {
        // Bank fee: always 10% TVA
        rate = 10;
        ht = ttc / 1.10;
        tva = ttc - ht;
        description = tx.description || 'Frais Bancaires';

        totalBankFeesTTC += ttc;
        totalBankFeesHT += ht;
        totalBankFeesTVA += tva;
      } else {
        // Normal expense: determine rate from linked depenses
        rate = getTvaRateFromDepenses(tx.depenses || []);
        ht = ttc / (1 + rate / 100);
        tva = ttc - ht;
        description = getDebitDescription(tx);

        totalExpensesTTC += ttc;
        totalExpensesHT += ht;
        totalExpensesTVA += tva;
      }

      if (!expensesByRate[rate]) expensesByRate[rate] = { ht: 0, tva: 0, ttc: 0 };
      expensesByRate[rate].ttc += ttc;
      expensesByRate[rate].ht += ht;
      expensesByRate[rate].tva += tva;

      expensesDetails.push({
        date: tx.dateTransaction,
        description,
        montantTTC: ttc,
        montantHT: ht,
        montantTVA: tva,
        taux: rate,
        mode: tx.typeTransaction || 'AUTRE'
      });
    });

    const totalTvaRecuperable = totalExpensesTVA + totalBankFeesTVA;
    const soldeTva = totalSalesTVA - totalTvaRecuperable;

    // Non-reconciled summary
    const nonReconciledCredits = nonReconciledTx.filter(t => t.type === 'CREDIT').reduce((sum, t) => sum + (t.montant || 0), 0);
    const nonReconciledDebits = nonReconciledTx.filter(t => t.type === 'DEBIT').reduce((sum, t) => sum + (t.montant || 0), 0);

    return {
      period: { startDate, endDate },
      sales: {
        totalTTC: totalSalesTTC,
        totalHT: totalSalesHT,
        totalTVA: totalSalesTVA,
        byRate: Object.entries(salesByRate).map(([rate, val]) => ({ rate: parseInt(rate), ...val })),
        details: salesDetails
      },
      expenses: {
        totalTTC: totalExpensesTTC + totalBankFeesTTC,
        totalHT: totalExpensesHT + totalBankFeesHT,
        totalTVA: totalTvaRecuperable,
        charges: {
          totalTTC: totalExpensesTTC,
          totalHT: totalExpensesHT,
          totalTVA: totalExpensesTVA
        },
        bankFees: {
          totalTTC: totalBankFeesTTC,
          totalHT: totalBankFeesHT,
          totalTVA: totalBankFeesTVA
        },
        byRate: Object.entries(expensesByRate).map(([rate, val]) => ({ rate: parseInt(rate), ...val })),
        details: expensesDetails
      },
      soldeTva,
      isCredit: soldeTva < 0,
      reconciliationSummary: {
        nonReconciledCredits,
        nonReconciledDebits,
        nonReconciledCount: nonReconciledTx.length
      }
    };
  }

  async generateTvaCsv(dto: ExportSageDto): Promise<string> {
    const data = await this.getTvaBilan(dto);
    
    // Header
    let csv = `Regime;Regime des encaissements\n`;
    csv += `Periode;du ${dto.startDate} au ${dto.endDate}\n\n`;
    
    // Summary
    csv += `RESUME GLOBAL\n`;
    csv += `TVA Collectee (Ventes);${data.sales.totalTVA.toFixed(2)}\n`;
    csv += `TVA Deductible;${data.expenses.totalTVA.toFixed(2)}\n`;
    csv += `SOLDE TVA (${data.isCredit ? 'Credit de TVA' : 'TVA due'});${Math.abs(data.soldeTva).toFixed(2)}\n\n`;

    // Detailed transactions breakdown list (Sales)
    csv += 'DETAILS DES OPERATIONS (TVA COLLECTEE)\n';
    csv += 'Date;Description;Mode;Taux;Base HT;Montant TVA;Total TTC\n';
    data.sales.details.forEach((d) => {
      const dateStr = d.date ? new Date(d.date).toLocaleDateString('fr-FR') : '';
      const modeStr = (d.mode || 'AUTRE').replace(/_/g, ' ');
      csv += `${dateStr};${d.description || ''};${modeStr};${d.taux}%;${d.montantHT.toFixed(2)};${d.montantTVA.toFixed(2)};${d.montantTTC.toFixed(2)}\n`;
    });
    csv += '\n';

    // Detailed transactions breakdown list (Deductible)
    csv += 'DETAILS DES OPERATIONS (TVA DEDUCTIBLE)\n';
    csv += 'Date;Description;Mode;Taux;Base HT;Montant TVA;Total TTC\n';
    data.expenses.details.forEach((d) => {
      const dateStr = d.date ? new Date(d.date).toLocaleDateString('fr-FR') : '';
      const modeStr = (d.mode || 'AUTRE').replace(/_/g, ' ');
      csv += `${dateStr};${d.description || ''};${modeStr};${d.taux}%;${d.montantHT.toFixed(2)};${d.montantTVA.toFixed(2)};${d.montantTTC.toFixed(2)}\n`;
    });

    return csv;
  }

  async generateTvaPdf(dto: ExportSageDto): Promise<any> {
    const data = await this.getTvaBilan(dto);
    const doc = new PDFDocument({ margin: 40, size: 'A4', bufferPages: true });

    // Simple ASCII clean-up helper to avoid rendering issues with PDFKit Helvetica default font
    const ascii = (str) => {
      if (!str) return '';
      return str
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // remove accents
        .replace(/[^\x20-\x7E]/g, '?');  // remove non-printable characters
    };

    try {
      doc.fillColor('#1e293b').fontSize(20).text('Bilan TVA Periodique', { align: 'center' });
      doc.fontSize(10).fillColor('#64748b').text(`Regime des encaissements - Periode du ${dto.startDate} au ${dto.endDate}`, { align: 'center' });
      doc.moveDown(2);

      // Synthesis card
      doc.rect(40, 100, 515, 70).fillAndStroke('#f8fafc', '#cbd5e1');
      doc.fillColor('#1e293b').fontSize(11).text('RESUME GLOBAL', 50, 110);
      
      doc.fontSize(9).fillColor('#64748b').text('Total TVA Collectee (Ventes) :', 50, 130);
      doc.fillColor('#0f766e').text(`${data.sales.totalTVA.toFixed(2)} MAD`, 220, 130);

      doc.fillColor('#64748b').text('Total TVA Recuperable (Achats & Frais) :', 50, 145);
      doc.fillColor('#b91c1c').text(`${data.expenses.totalTVA.toFixed(2)} MAD`, 220, 145);

      const statusText = data.isCredit ? 'Credit de TVA (a recuperer)' : 'TVA Net a payer (due)';
      doc.fillColor('#1e293b').fontSize(10).text(`${statusText} :`, 300, 130);
      doc.fontSize(12).fillColor(data.isCredit ? '#0f766e' : '#b91c1c').text(`${Math.abs(data.soldeTva).toFixed(2)} MAD`, 300, 145);

      // Section Tables
      let yPos = 190;
      doc.fillColor('#1e293b').fontSize(12).text('DETAILS DES TAXES COLLECTEES (VENTES)', 40, yPos);
      yPos += 20;

      // Table Header
      doc.rect(40, yPos, 515, 20).fill('#e2e8f0');
      doc.fillColor('#334155').fontSize(9).text('Taux de TVA', 50, yPos + 6);
      doc.text('Base HT', 200, yPos + 6);
      doc.text('Montant TVA', 310, yPos + 6);
      doc.text('Total TTC', 430, yPos + 6);
      yPos += 20;

      data.sales.byRate.forEach((r) => {
        doc.fillColor('#475569').text(`${r.rate}%`, 50, yPos + 6);
        doc.text(`${r.ht.toFixed(2)} MAD`, 200, yPos + 6);
        doc.text(`${r.tva.toFixed(2)} MAD`, 310, yPos + 6);
        doc.text(`${r.ttc.toFixed(2)} MAD`, 430, yPos + 6);
        yPos += 20;
      });

      doc.rect(40, yPos, 515, 1).fill('#cbd5e1'); yPos += 5;
      doc.fillColor('#1e293b').font('Helvetica-Bold').text('Total', 50, yPos);
      doc.text(`${data.sales.totalHT.toFixed(2)} MAD`, 200, yPos);
      doc.text(`${data.sales.totalTVA.toFixed(2)} MAD`, 310, yPos);
      doc.text(`${data.sales.totalTTC.toFixed(2)} MAD`, 430, yPos);
      doc.font('Helvetica');

      // Expenses table
      yPos += 35;
      doc.fillColor('#1e293b').fontSize(12).text('DETAILS DES TAXES DEDUCTIBLES (ACHATS & FRAIS)', 40, yPos);
      yPos += 20;

      doc.rect(40, yPos, 515, 20).fill('#e2e8f0');
      doc.fillColor('#334155').fontSize(9).text('Taux de TVA', 50, yPos + 6);
      doc.text('Base HT', 200, yPos + 6);
      doc.text('Montant TVA', 310, yPos + 6);
      doc.text('Total TTC', 430, yPos + 6);
      yPos += 20;

      data.expenses.byRate.forEach((r) => {
        doc.fillColor('#475569').text(`${r.rate}%`, 50, yPos + 6);
        doc.text(`${r.ht.toFixed(2)} MAD`, 200, yPos + 6);
        doc.text(`${r.tva.toFixed(2)} MAD`, 310, yPos + 6);
        doc.text(`${r.ttc.toFixed(2)} MAD`, 430, yPos + 6);
        yPos += 20;
      });

      doc.rect(40, yPos, 515, 1).fill('#cbd5e1'); yPos += 5;
      doc.fillColor('#1e293b').font('Helvetica-Bold').text('Total', 50, yPos);
      doc.text(`${data.expenses.totalHT.toFixed(2)} MAD`, 200, yPos);
      doc.text(`${data.expenses.totalTVA.toFixed(2)} MAD`, 310, yPos);
      doc.text(`${data.expenses.totalTTC.toFixed(2)} MAD`, 430, yPos);
      doc.font('Helvetica');

      const drawHdr = (y) => {
        doc.rect(40, y, 515, 20).fill('#e2e8f0');
        doc.fillColor('#334155').fontSize(8).font('Helvetica-Bold');
        doc.text('Date',        45,  y + 6);
        doc.text('Description', 100, y + 6);
        doc.text('Mode',        240, y + 6);
        doc.text('Taux',        330, y + 6);
        doc.text('Base HT',     370, y + 6);
        doc.text('TVA',         430, y + 6);
        doc.text('Total TTC',   490, y + 6);
        doc.font('Helvetica');
        return y + 20;
      };

      const drawRow = (y, d) => {
        const dateStr = d.date ? new Date(d.date).toLocaleDateString('fr-FR') : '';
        const desc = ascii(d.description || '').substring(0, 24);
        const mode = ascii((d.mode || '').replace(/_/g, ' ')).substring(0, 16);
        doc.fillColor('#475569').fontSize(7.5);
        doc.text(dateStr, 45, y + 4);
        doc.text(desc,    100, y + 4);
        doc.text(mode,    240, y + 4);
        doc.text(d.taux + '%',               330, y + 4);
        doc.text(d.montantHT.toFixed(2),     370, y + 4);
        doc.text(d.montantTVA.toFixed(2),    430, y + 4);
        doc.text(d.montantTTC.toFixed(2),    490, y + 4);
        return y + 16;
      };

      // Page 2: Details of Collected VAT (Sales)
      doc.addPage();
      doc.fillColor('#1e293b').fontSize(13).font('Helvetica-Bold').text('Details des Operations - TVA Collectee (Ventes)', 40, 40);
      doc.font('Helvetica');
      let y = 65; 
      y = drawHdr(y);
      data.sales.details.forEach((d) => {
        if (y > 760) {
          doc.addPage();
          y = 40;
          y = drawHdr(y);
        }
        y = drawRow(y, d);
      });

      // Page 3: Details of Deductible VAT (Expenses)
      doc.addPage();
      doc.fillColor('#1e293b').fontSize(13).font('Helvetica-Bold').text('Details des Operations - TVA Deductible (Achats & Frais)', 40, 40);
      doc.font('Helvetica');
      y = 65; 
      y = drawHdr(y);
      data.expenses.details.forEach((d) => {
        if (y > 760) {
          doc.addPage();
          y = 40;
          y = drawHdr(y);
        }
        y = drawRow(y, d);
      });

      doc.end();
      return doc;
    } catch (e) {
      throw new Error('TVA PDF Error: ' + e.message);
    }
  }
}
