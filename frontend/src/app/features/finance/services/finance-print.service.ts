import { Injectable } from '@angular/core';
import { CompanySettings } from '../../../shared/interfaces/company-settings.interface';

@Injectable({
    providedIn: 'root'
})
export class FinancePrintService {

    constructor() { }

    printFinanceTable(title: string, columns: { key: string, label: string }[], items: any[], totals: any, companySettings: CompanySettings | null): void {
        const logoUrl = companySettings?.logoUrl || '/assets/images/logo.png';
        const companyName = companySettings?.name || 'OPTISASS';
        const today = new Date().toLocaleDateString('fr-FR');

        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const formatValue = (val: any, key: string) => {
            if (val === null || val === undefined || val === '') return '-';
            
            if (key.toLowerCase().includes('date')) {
                return new Date(val).toLocaleDateString('fr-FR');
            }

            if (typeof val === 'number') {
                const formatted = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
                if (key.toLowerCase().includes('qte') || key.toLowerCase().includes('quantite') || key.toLowerCase().includes('count') || key.toLowerCase().includes('quantity')) {
                    return formatted;
                }
                return formatted + ' DH';
            }

            return val;
        };

        let tableRows = '';
        items.forEach(item => {
            tableRows += '<tr>';
            columns.forEach(col => {
                tableRows += `<td>${formatValue(item[col.key], col.key)}</td>`;
            });
            tableRows += '</tr>';
        });

        // Detect totals that can be aligned with columns
        const alignedTotals: Record<string, string> = {};
        const unalignedTotals: Record<string, any> = {};

        if (totals) {
            Object.keys(totals).forEach(key => {
                const totalData = totals[key];
                const value = typeof totalData === 'object' ? totalData.value : totalData;
                const label = typeof totalData === 'object' ? totalData.label : key;
                const colKey = typeof totalData === 'object' ? totalData.colKey : null;

                if (colKey && columns.find(c => c.key === colKey)) {
                    alignedTotals[colKey] = formatValue(value, colKey);
                } else {
                    unalignedTotals[label] = value;
                }
            });
        }

        let footerRow = '';
        if (Object.keys(alignedTotals).length > 0) {
            footerRow = '<tfoot><tr class="footer-row">';
            columns.forEach(col => {
                const val = alignedTotals[col.key] || '';
                footerRow += `<td>${val}</td>`;
            });
            footerRow += '</tr></tfoot>';
        }

        let extraTotalsSection = '';
        if (Object.keys(unalignedTotals).length > 0) {
            extraTotalsSection = `
                <div class="totals-section">
                    ${Object.keys(unalignedTotals).map(label => {
                        const val = unalignedTotals[label];
                        const isQty = label.toLowerCase().includes('produits') || label.toLowerCase().includes('quantité') || label.toLowerCase().includes('nb');
                        const formatted = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
                        return `
                            <div class="total-item">
                                <span class="total-label">${label}:</span>
                                <span class="total-value">${formatted}${isQty ? '' : ' DH'}</span>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        }

        printWindow.document.write(`
            <!DOCTYPE html>
            <html lang="fr">
            <head>
                <meta charset="UTF-8">
                <title>${title}</title>
                <style>
                    @page { size: A4 landscape; margin: 10mm; }
                    body { font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; padding: 0; line-height: 1.4; font-size: 9pt; background: #fff; }
                    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0f172a; padding-bottom: 15px; margin-bottom: 20px; }
                    .logo-box img { height: 50px; }
                    .company-info { text-align: right; }
                    .company-info h1 { margin: 0; font-size: 18pt; text-transform: uppercase; }
                    .doc-title { font-size: 14pt; color: #3b82f6; font-weight: 800; text-transform: uppercase; margin-top: 5px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                    th { background: #f8fafc; text-align: left; font-size: 8pt; text-transform: uppercase; color: #64748b; padding: 10px; border-bottom: 2px solid #e2e8f0; }
                    td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; }
                    tr:nth-child(even) { background: #fcfcfc; }
                    .footer-row { background: #f1f5f9 !important; font-weight: 800; border-top: 2px solid #0f172a; }
                    .footer-row td { padding: 10px; border-bottom: none; color: #0f172a; font-size: 10pt; }
                    .totals-section { display: flex; justify-content: flex-end; gap: 30px; margin-top: 20px; padding: 15px; background: #f8fafc; border-radius: 8px; }
                    .total-item { text-align: right; }
                    .total-label { display: block; font-size: 8pt; color: #64748b; font-weight: 700; text-transform: uppercase; }
                    .total-value { font-size: 12pt; font-weight: 800; color: #0f172a; }
                    .footer { text-align: center; margin-top: 30px; font-size: 8pt; color: #94a3b8; }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="logo-box"><img src="${logoUrl}" alt="Logo"></div>
                    <div class="company-info">
                        <h1>${companyName}</h1>
                        <div class="doc-title">${title}</div>
                        <div style="font-size: 8pt; color: #64748b;">Imprimé le ${today}</div>
                    </div>
                </div>
                <table>
                    <thead>
                        <tr>${columns.map(c => `<th>${c.label}</th>`).join('')}</tr>
                    </thead>
                    <tbody>
                        ${tableRows}
                    </tbody>
                    ${footerRow}
                </table>
                ${extraTotalsSection}
                <div class="footer">
                    ${companyName} - Logiciel de Gestion de Trésorerie
                </div>
                <script>window.onload = function() { window.print(); setTimeout(() => window.close(), 1000); }<\/script>
            </body>
            </html>
        `);
        printWindow.document.close();
    }

    printCombinedJournal(title: string, incomingItems: any[], outgoingItems: any[], summary: any, companySettings: CompanySettings | null, period: string): void {
        const logoUrl = companySettings?.logoUrl || '/assets/images/logo.png';
        const companyName = companySettings?.name || 'OPTISASS';
        const today = new Date().toLocaleDateString('fr-FR');

        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const formatCurrency = (val: number) => new Intl.NumberFormat('fr-FR', { style: 'decimal', minimumFractionDigits: 2 }).format(val || 0) + ' DH';
        const formatDate = (val: string) => val ? new Date(val).toLocaleDateString('fr-FR') : '-';

        let incomingRows = '';
        incomingItems.forEach(item => {
            incomingRows += `
                <tr>
                    <td>${formatDate(item.datePiece || item.date)}</td>
                    <td>${item.numeroPiece || item.libelle || '-'}</td>
                    <td>${item.client || item.libelle || '-'}</td>
                    <td>${item.methodePaiement || '-'}</td>
                    <td style="text-align: right; color: #059669; font-weight: 600;">+ ${formatCurrency(item.montant)}</td>
                </tr>
            `;
        });

        let outgoingRows = '';
        outgoingItems.forEach(item => {
            outgoingRows += `
                <tr>
                    <td>${formatDate(item.datePiece || item.date)}</td>
                    <td>${item.numeroPiece || item.reference || '-'}</td>
                    <td>${item.fournisseur || item.libelle || '-'}</td>
                    <td>${item.type?.replace('_', ' ') || '-'}</td>
                    <td>${item.methodePaiement || '-'}</td>
                    <td style="text-align: right; color: #dc2626; font-weight: 600;">- ${formatCurrency(item.montant)}</td>
                </tr>
            `;
        });

        printWindow.document.write(`
            <!DOCTYPE html>
            <html lang="fr">
            <head>
                <meta charset="UTF-8">
                <title>${title}</title>
                <style>
                    @page { size: A4 portrait; margin: 10mm; }
                    body { font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; padding: 0; line-height: 1.4; font-size: 8.5pt; background: #fff; }
                    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 15px; }
                    .logo-box img { height: 40px; }
                    .company-info { text-align: right; }
                    .company-info h1 { margin: 0; font-size: 16pt; text-transform: uppercase; }
                    .doc-title { font-size: 12pt; color: #3b82f6; font-weight: 800; text-transform: uppercase; margin-top: 2px; }
                    
                    .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 20px; }
                    .summary-card { padding: 10px; border-radius: 8px; border: 1px solid #e2e8f0; }
                    .summary-card.income { border-left: 4px solid #10b981; }
                    .summary-card.expense { border-left: 4px solid #ef4444; }
                    .summary-card.balance { background: #f8fafc; border-left: 4px solid #3b82f6; }
                    .summary-label { display: block; font-size: 7pt; color: #64748b; font-weight: 700; text-transform: uppercase; margin-bottom: 4px; }
                    .summary-value { font-size: 12pt; font-weight: 800; }
                    
                    .section-title { font-size: 10pt; font-weight: 800; color: #1e293b; text-transform: uppercase; margin: 20px 0 10px 0; padding-bottom: 5px; border-bottom: 1px solid #e2e8f0; }
                    table { width: 100%; border-collapse: collapse; }
                    th { background: #f8fafc; text-align: left; font-size: 7.5pt; text-transform: uppercase; color: #64748b; padding: 8px; border-bottom: 1px solid #e2e8f0; }
                    td { padding: 6px 8px; border-bottom: 1px solid #f1f5f9; }
                    
                    .footer { text-align: center; margin-top: 30px; font-size: 8pt; color: #94a3b8; }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="logo-box"><img src="${logoUrl}" alt="Logo"></div>
                    <div class="company-info">
                        <h1>${companyName}</h1>
                        <div class="doc-title">${title}</div>
                        <div style="font-size: 8pt; color: #64748b;">Période: ${period} | Imprimé le ${today}</div>
                    </div>
                </div>

                <div class="summary-grid">
                    <div class="summary-card income">
                        <span class="summary-label">Total Recettes</span>
                        <div class="summary-value" style="color: #059669;">+ ${formatCurrency(summary.totalIncomingCashed)}</div>
                    </div>
                    <div class="summary-card expense">
                        <span class="summary-label">Total Dépenses</span>
                        <div class="summary-value" style="color: #dc2626;">- ${formatCurrency(summary.totalExpensesCashed)}</div>
                    </div>
                    <div class="summary-card balance">
                        <span class="summary-label">Solde Réel Final</span>
                        <div class="summary-value" style="color: #1e40af;">${formatCurrency(summary.balanceReal)}</div>
                    </div>
                </div>

                <div class="section-title">Journal des Recettes</div>
                <table>
                    <thead>
                        <tr><th>Date</th><th>Référence</th><th>Client / Source</th><th>Mode</th><th style="text-align: right;">Montant</th></tr>
                    </thead>
                    <tbody>
                        ${incomingRows || '<tr><td colspan="5" style="text-align: center; font-style: italic; color: #94a3b8; padding: 20px;">Aucune recette sur cette période</td></tr>'}
                    </tbody>
                </table>

                <div class="section-title">Journal des Dépenses</div>
                <table>
                    <thead>
                        <tr><th>Date</th><th>Référence</th><th>Fournisseur / Libellé</th><th>Catégorie</th><th>Mode</th><th style="text-align: right;">Montant</th></tr>
                    </thead>
                    <tbody>
                        ${outgoingRows || '<tr><td colspan="6" style="text-align: center; font-style: italic; color: #94a3b8; padding: 20px;">Aucune dépense sur cette période</td></tr>'}
                    </tbody>
                </table>

                <div class="footer">
                    ${companyName} - État de Trésorerie
                </div>
                <script>window.onload = function() { window.print(); setTimeout(() => window.close(), 1000); }<\/script>
            </body>
            </html>
        `);
        printWindow.document.close();
    }
}
