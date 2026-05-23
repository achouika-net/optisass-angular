import { Injectable } from '@nestjs/common';
import * as xlsx from 'xlsx';
const pdf = require('pdf-parse');

@Injectable()
export class ReleveParserService {
  async parseExcel(buffer: Buffer): Promise<any[]> {
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
    
    const transactions: any[] = [];
    let isDataRow = false;
    
    for (const row of data as any[]) {
      if (row.length === 0) continue;
      
      const strRow = row.join(' ').toLowerCase();
      // Heuristic to find the header row
      if (!isDataRow && (strRow.includes('date') && (strRow.includes('libellé') || strRow.includes('description') || strRow.includes('debit') || strRow.includes('credit') || strRow.includes('montant')))) {
        isDataRow = true;
        continue;
      }
      
      if (isDataRow && row.length >= 3) {
        // Simple mapping attempt: Date, Description, Debit, Credit
        // Needs proper mapping based on actual bank template. Here is a generic approach:
        let date, desc, debit, credit;
        if (row[0] && new Date(row[0]).toString() !== 'Invalid Date') {
          date = row[0];
          desc = row[1];
          debit = parseFloat(row[2]) || 0;
          credit = parseFloat(row[3]) || 0;
          
          if (!desc && typeof row[2] === 'string') {
             desc = row[2];
             debit = parseFloat(row[3]) || 0;
             credit = parseFloat(row[4]) || 0;
          }
        }
        
        if (date && (debit > 0 || credit > 0)) {
          transactions.push({
            date,
            description: desc || 'Transaction',
            type: credit > 0 ? 'CREDIT' : 'DEBIT',
            montant: credit > 0 ? credit : debit,
            reference: ''
          });
        }
      }
    }
    
    return transactions;
  }

  async parsePdf(buffer: Buffer): Promise<any[]> {
    const data = await pdf(buffer);
    const text = data.text;
    const lines = text.split('\n');
    const transactions: any[] = [];
    console.log('[PDF-PARSER] Pages: ' + data.numpages + ', Total lines: ' + lines.length);

    // ATW format: CODE DATE(DD MM) LIBELLE VALEUR(DD MM YYYY) AMOUNT
    // Some lines are split across 2 lines in the PDF text extraction
    const atwRegex = /^(?:[A-Z0-9]{6}\s*)?(\d{2}\s\d{2})\s+(.+?)\s+(\d{2}\s\d{2}\s\d{4})\s+(.+)$/;
    // Partial line: has the code+date+libelle but NO valeur date
    const partialRegex = /^(?:[A-Z0-9]{6}\s*)?(\d{2}\s\d{2})\s+(.+)$/;
    // Continuation line: starts with valeur date and amount
    const contRegex = /^[A-Z]?(\d{2}\s\d{2}\s\d{4})\s+(.+)$/;

    let pendingLine: string | null = null;

    for (let i = 0; i < lines.length; i++) {
      const cleanLine = lines[i].trim();
      if (!cleanLine) continue;

      // Skip header/footer lines
      if (cleanLine.includes('Attijariwafa bank') || cleanLine.includes('capital de') ||
          cleanLine.includes('PAGE') || cleanLine.includes('SOLDE') ||
          cleanLine.includes('TOTAL MOUVEMENTS') || cleanLine.includes('________') ||
          cleanLine.includes('tablissement de') || cleanLine.includes('privatisation') ||
          cleanLine.includes('AVENUE') || cleanLine.includes('RABAT') ||
          cleanLine.startsWith('00 ') || cleanLine.startsWith('007 ')) {
        continue;
      }

      // If we have a pending partial line, try to join with current
      if (pendingLine !== null) {
        const contMatch = cleanLine.match(contRegex);
        if (contMatch) {
          const joined = pendingLine + ' ' + cleanLine;
          console.log('[PDF-PARSER] JOINED: ' + joined.substring(0, 100));
          const fullMatch = joined.match(atwRegex);
          if (fullMatch) {
            const tx = this.extractAtwTransaction(fullMatch);
            if (tx) { transactions.push(tx); console.log('[PDF-PARSER] MATCHED JOINED: ' + tx.description); }
          } else {
            // Try direct parsing of the continuation
            const tx = this.parseJoinedLine(pendingLine, cleanLine);
            if (tx) { transactions.push(tx); console.log('[PDF-PARSER] MATCHED PARSED: ' + tx.description); }
          }
          pendingLine = null;
          continue;
        } else {
          console.log('[PDF-PARSER] DROPPED pending: ' + pendingLine.substring(0, 80));
          pendingLine = null;
        }
      }

      // Try full ATW match first
      const atwMatch = cleanLine.match(atwRegex);
      if (atwMatch) {
        const tx = this.extractAtwTransaction(atwMatch);
        if (tx) { transactions.push(tx); console.log('[PDF-PARSER] MATCHED: ' + tx.description); }
        continue;
      }

      // Check if this is a partial ATW line (code+date+libelle but no valeur)
      const partMatch = cleanLine.match(partialRegex);
      if (partMatch && cleanLine.match(/^[A-Z0-9]{6}/)) {
        pendingLine = cleanLine;
        continue;
      }

      // Fallback: standard format
      const stdMatch = cleanLine.match(/^\s*(\d{2}[\/\-]\d{2}[\/\-]\d{2,4})\s+(.+)$/);
      if (stdMatch) {
        const dateStr = stdMatch[1];
        const rest = stdMatch[2];
        const parts = rest.split(/\s+/);
        const numbers = parts.filter(p => /^[\d,\.]+$/.test(p));
        const montantStr = numbers[numbers.length - 1];
        if (!montantStr) continue;
        const montant = parseFloat(montantStr.replace(',', '.'));
        const desc = parts.slice(0, parts.length - numbers.length).join(' ');
        const isDebit = desc.toLowerCase().includes('retrait') || desc.toLowerCase().includes('prlv') || desc.toLowerCase().includes('agios');
        transactions.push({ date: dateStr, description: desc, type: isDebit ? 'DEBIT' : 'CREDIT', montant, reference: '' });
      }

      if (!atwMatch && !stdMatch && cleanLine.length > 10 && !cleanLine.match(/^[A-Z0-9]{6}/)) {
        console.log('[PDF-PARSER] SKIPPED: ' + cleanLine.substring(0, 100));
      }
    }

    console.log('[PDF-PARSER] Total extracted: ' + transactions.length);
    return transactions;
  }

  private extractAtwTransaction(match: RegExpMatchArray): any | null {
    const dateRaw = match[1];
    const libelle = match[2].trim();
    const valeurRaw = match[3];
    const amountStr = match[4].trim();

    const cleanAmountStr = amountStr.replace(/\s/g, '').replace(',', '.');
    const montant = parseFloat(cleanAmountStr);
    if (isNaN(montant)) {
      // Could be a credit with no amount on debit side
      const partsValeur = valeurRaw.split(' ');
      const year = partsValeur[2];
      const partsDate = dateRaw.split(' ');
      const month = partsDate[1];
      const day = partsDate[0];
      const date = year + '-' + month + '-' + day;
      // Check if amount is empty = credit without visible amount
      return null;
    }

    const partsValeur = valeurRaw.split(' ');
    const year = partsValeur[2];
    const partsDate = dateRaw.split(' ');
    const month = partsDate[1];
    const day = partsDate[0];
    const date = year + '-' + month + '-' + day;

    const libLower = libelle.toLowerCase();
    let isDebit = true;
    if (libLower.includes('recu') || libLower.includes('versement') || libLower.includes('remise') || 
        libLower.includes('cred') || libLower.includes('virement en votre faveur') || libLower.includes('virement recu')) {
      isDebit = false;
    }

    return { date, description: libelle, type: isDebit ? 'DEBIT' : 'CREDIT', montant, reference: '' };
  }

  private parseJoinedLine(partial: string, continuation: string): any | null {
    // partial: 0016BK05 12 VIR.EMIS WEB VERS Ste FI LAMANE AS
    // continuation: S02 12 2022           2 578,00
    // Or continuation starts with a letter then date
    const contMatch = continuation.match(/^[A-Z]?(\d{2}\s\d{2}\s\d{4})\s+(.*)$/);
    if (!contMatch) return null;

    const partMatch = partial.match(/^(?:[A-Z0-9]{6}\s*)?(\d{2}\s\d{2})\s+(.+)$/);
    if (!partMatch) return null;

    const dateRaw = partMatch[1];
    let libelle = partMatch[2].trim();
    const valeurRaw = contMatch[1];
    const amountStr = contMatch[2].trim();

    // If continuation starts with a letter, it might be part of the libelle
    const firstChar = continuation.charAt(0);
    if (firstChar.match(/[A-Z]/i) && !firstChar.match(/\d/)) {
      // the letter belongs to libelle continuation
      libelle += firstChar;
    }

    const cleanAmountStr = amountStr.replace(/\s/g, '').replace(',', '.');
    const montant = parseFloat(cleanAmountStr);
    if (isNaN(montant) || montant === 0) return null;

    const partsValeur = valeurRaw.split(' ');
    const year = partsValeur[2];
    const partsDate = dateRaw.split(' ');
    const month = partsDate[1];
    const day = partsDate[0];
    const date = year + '-' + month + '-' + day;

    const libLower = libelle.toLowerCase();
    let isDebit = true;
    if (libLower.includes('recu') || libLower.includes('versement') || libLower.includes('remise') || 
        libLower.includes('cred') || libLower.includes('virement en votre faveur') || libLower.includes('virement recu')) {
      isDebit = false;
    }

    return { date, description: libelle, type: isDebit ? 'DEBIT' : 'CREDIT', montant, reference: '' };
  }
}