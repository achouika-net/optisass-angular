import { Injectable } from '@nestjs/common';
import * as xlsx from 'xlsx';
const pdf = require('pdf-parse');

export interface ParsedReleve {
  transactions: any[];
  detectedAccountInfo?: {
    rib?: string;
    bankName?: string;
  };
}

@Injectable()
export class ReleveParserService {
  async parseExcel(buffer: Buffer): Promise<ParsedReleve> {
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
    
    const transactions: any[] = [];
    let isDataRow = false;
    let rib: string | undefined;
    let bankName: string | undefined;
    
    for (const row of data as any[]) {
      if (row.length === 0) continue;
      
      const strRow = row.join(' ').toLowerCase();
      
      // Try to detect RIB in header rows
      if (!isDataRow) {
        const ribMatch = strRow.match(/(?:rib|compte|n[^\s]*)\s*:?\s*([a-z0-9\s-]{10,35})/i);
        if (ribMatch) {
          const cleanRib = ribMatch[1].replace(/[^a-z0-9]/gi, '');
          if (cleanRib.length >= 10) {
            rib = cleanRib;
          }
        } else {
          const raw24 = strRow.match(/\b(?:\d[ -\s]*){24}\b/);
          if (raw24) {
            rib = raw24[0].replace(/[^a-z0-9]/gi, '');
          } else {
            const raw16 = strRow.match(/\b(?:\d[ -\s]*){16}\b/);
            if (raw16) {
              rib = raw16[0].replace(/[^a-z0-9]/gi, '');
            }
          }
        }
      }
      
      // Heuristic to find the header row
      if (!isDataRow && (strRow.includes('date') && (strRow.includes('libellé') || strRow.includes('libelle') || strRow.includes('description') || strRow.includes('debit') || strRow.includes('credit') || strRow.includes('montant')))) {
        isDataRow = true;
        continue;
      }
      
      if (isDataRow && row.length >= 3) {
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
    
    return { transactions, detectedAccountInfo: { rib, bankName } };
  }

  async parsePdf(buffer: Buffer): Promise<ParsedReleve> {
    const data = await pdf(buffer);
    const text = data.text;
    const lines = text.split('\n');
    const transactions: any[] = [];
    let rib: string | undefined;
    let bankName: string | undefined;

    console.log('[PDF-PARSER] Pages: ' + data.numpages + ', Total lines: ' + lines.length);

    // ATW format: CODE DATE(DD MM) LIBELLE VALEUR(DD MM YYYY) AMOUNT
    const atwRegex = /^(?:[A-Z0-9]{6}\s*)?(\d{2}\s\d{2})\s+(.+?)\s*(\d{2}\s\d{2}\s\d{4})\s+(.+)$/;
    const partialRegex = /^(?:[A-Z0-9]{6}\s*)?(\d{2}\s\d{2})\s+(.+)$/;
    const contRegex = /^[A-Z]?(\d{2}\s\d{2}\s\d{4})\s+(.+)$/;

    // RIB Detection Regex: 24 digits or 16 digits with optional spaces/dashes
    const ribRegex = /(?:RIB|Compte|N[^\s]*\s*de\s*compte|N[^\s]*\s*compte)[:\s-]+([0-9A-Z\s-]{10,35})/i;
    const raw24DigitRegex = /\b(?:\d[ -\s]*){24}\b/;
    const raw16DigitRegex = /\b(?:\d[ -\s]*){16}\b/;

    let pendingLine: string | null = null;

    for (let i = 0; i < lines.length; i++) {
      const cleanLine = lines[i].trim();
      if (!cleanLine) continue;

      // Extract Bank Name heuristically from first few lines
      if (i < 20 && !bankName) {
        if (cleanLine.toLowerCase().includes('attijariwafa')) bankName = 'Attijariwafa Bank';
        else if (cleanLine.toLowerCase().includes('bmce') || cleanLine.toLowerCase().includes('bank of africa')) bankName = 'Bank of Africa';
        else if (cleanLine.toLowerCase().includes('bp') || cleanLine.toLowerCase().includes('banque populaire')) bankName = 'Banque Populaire';
        else if (cleanLine.toLowerCase().includes('sgmb') || cleanLine.toLowerCase().includes('societe generale')) bankName = 'Société Générale';
        else if (cleanLine.toLowerCase().includes('cdg')) bankName = 'CDG';
        else if (cleanLine.toLowerCase().includes('cih')) bankName = 'CIH';
      }

      // Extract RIB
      if (!rib) {
        const ribMatch = cleanLine.match(ribRegex);
        if (ribMatch) {
          const cleanRib = ribMatch[1].replace(/[^0-9A-Z]/gi, '');
          if (cleanRib.length >= 10) rib = cleanRib;
        } else {
          const raw24Match = cleanLine.match(raw24DigitRegex);
          if (raw24Match) {
            rib = raw24Match[0].replace(/[^0-9A-Z]/gi, '');
          } else {
            const raw16Match = cleanLine.match(raw16DigitRegex);
            if (raw16Match) {
              rib = raw16Match[0].replace(/[^0-9A-Z]/gi, '');
            }
          }
        }
      }

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

      // Fallback: standard format (including concatenated dates like 22/0522/05)
      let dateStr = '';
      let rest = '';
      const stdMatch = cleanLine.match(/^\s*(\d{2}[\/\-]\d{2}[\/\-]\d{2,4})\s+(.+)$/);
      if (stdMatch) {
        dateStr = stdMatch[1];
        rest = stdMatch[2];
      } else {
        const concatMatch = cleanLine.match(/^\s*(\d{2}[\/\-]\d{2}(?:[\/\-]\d{2,4})?)\d{2}[\/\-]\d{2}(?:[\/\-]\d{2,4})?\s+(.+)$/);
        if (concatMatch) {
          dateStr = concatMatch[1];
          rest = concatMatch[2];
          if (dateStr.length === 5) {
            dateStr = dateStr + '/' + new Date().getFullYear();
          }
        }
      }

      if (dateStr && rest) {
        // Extract amount from end of rest (e.g. "1 375,05" or "49,11")
        const amountMatch = rest.match(/(\d{1,3}(?:\s\d{3})*(?:[\,\.]\d{2})?)\s*$/);
        if (amountMatch) {
          const montantStr = amountMatch[1];
          const montant = parseFloat(montantStr.replace(/\s/g, '').replace(',', '.'));
          const desc = rest.substring(0, amountMatch.index).trim();
          const isDebit = this.determineIsDebit(desc);
          transactions.push({
            date: dateStr,
            description: desc,
            type: isDebit ? 'DEBIT' : 'CREDIT',
            montant,
            reference: ''
          });
          console.log('[PDF-PARSER] MATCHED STANDARD/CONCAT: ' + desc + ' | ' + montant + ' | ' + (isDebit ? 'DEBIT' : 'CREDIT'));
        }
      }

      if (!atwMatch && !stdMatch && cleanLine.length > 10 && !cleanLine.match(/^[A-Z0-9]{6}/)) {
        console.log('[PDF-PARSER] SKIPPED: ' + cleanLine.substring(0, 100));
      }
    }

    console.log(`[PDF-PARSER] Extracted: \${transactions.length} txs. Detected RIB: \${rib}, Bank: \${bankName}`);
    return { transactions, detectedAccountInfo: { rib, bankName } };
  }

    private determineIsDebit(libelle: string): boolean {
    const libLower = libelle.toLowerCase();
    
    // Explicitly check for debit indicators (e.g., échéance de crédit / loan repayment, direct debits, bank fees)
    if (libLower.includes('echeance') || libLower.includes('echeance credit') || libLower.includes('echeance-credit') || libLower.includes('ech.cred') || libLower.includes('retrait') || libLower.includes('prlv') || libLower.includes('agios')) {
      return true;
    }
    
    // Check for credit indicators (e.g., received transfers, cash deposits, card settlement deposits from CMI/AP)
    if (
      libLower.includes('recu') || 
      libLower.includes('reu') || 
      libLower.includes('reçu') ||
      libLower.includes('versement') || 
      libLower.includes('remise') || 
      libLower.includes('cred') || 
      libLower.includes('virement en votre faveur') || 
      libLower.includes('virement recu') ||
      libLower.includes('ver/ord') || 
      libLower.includes('vir.rec') || 
      libLower.includes('vir rec') || 
      libLower.includes('vir/ord') ||
      libLower.includes('cd cmi') ||
      libLower.includes('cd ap') ||
      libLower.includes('cmi')
    ) {
      return false;
    }
    
    return true; // Default to DEBIT
  }

  private extractAtwTransaction(match: RegExpMatchArray): any | null {
    const dateRaw = match[1];
    const libelle = match[2].trim();
    const valeurRaw = match[3];
    const amountStr = match[4].trim();

    const cleanAmountStr = amountStr.replace(/\s/g, '').replace(',', '.');
    const montant = parseFloat(cleanAmountStr);
    if (isNaN(montant)) {
      return null;
    }

    const partsValeur = valeurRaw.split(' ');
    const year = partsValeur[2];
    const partsDate = dateRaw.split(' ');
    const month = partsDate[1];
    const day = partsDate[0];
    const date = year + '-' + month + '-' + day;

    const isDebit = this.determineIsDebit(libelle);

    return { date, description: libelle, type: isDebit ? 'DEBIT' : 'CREDIT', montant, reference: '' };
  }

  private parseJoinedLine(partial: string, continuation: string): any | null {
    const contMatch = continuation.match(/^[A-Z]?(\d{2}\s\d{2}\s\d{4})\s+(.*)$/);
    if (!contMatch) return null;

    const partMatch = partial.match(/^(?:[A-Z0-9]{6}\s*)?(\d{2}\s\d{2})\s+(.+)$/);
    if (!partMatch) return null;

    const dateRaw = partMatch[1];
    let libelle = partMatch[2].trim();
    const valeurRaw = contMatch[1];
    const amountStr = contMatch[2].trim();

    const firstChar = continuation.charAt(0);
    if (firstChar.match(/[A-Z]/i) && !firstChar.match(/\d/)) {
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

    const isDebit = this.determineIsDebit(libelle);

    return { date, description: libelle, type: isDebit ? 'DEBIT' : 'CREDIT', montant, reference: '' };
  }
}
