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

    const twoDatesRegex = /^\s*(\d{2}[\/\-.\s]\d{2}[\/\-\s]\d{2,4})\s+(\d{2}[\/\-.\s]\d{2}[\/\-\s]\d{2,4})\s+(.+)$/;
    const concatDatesRegex = /^\s*(\d{2}[\/\-.]\d{2}(?:[\/\-.]\d{2,4})?)(\d{2}[\/\-.]\d{2}(?:[\/\-.]\d{2,4})?)\s+(.+)$/;
    const singleDateRegex = /^\s*(\d{4}[\/\-.]\d{2}[\/\-.]\d{2}|\d{2}[\/\-.\s]\d{2}[\/\-.\s]\d{2,4}|\d{2}[\/\-.]\d{2})\s+(.+)$/;
    const amountRegex = /(?:\s{2,})([+-]?\d+[\d\s\.,]*(?:[\.,]\d{2})?)\s*(?:MAD|DH|USD|EUR|GBP|CAD|AUD|CHF|\$|€)?\s*(?:[-+])?\s*$/i;

    const atwRegex = /^(?:[A-Z0-9]{6}\s*)?(\d{2}\s\d{2})\s+((?!(?:19|20)\d{2}\s).+?)\s*(\d{2}\s\d{2}\s\d{4})\s+(.+)$/;
    const partialRegex = /^(?:[A-Z0-9]{6}\s*)?(\d{2}\s\d{2})\s+(.+)$/;
    const contRegex = /^[A-Z]?(\d{2}\s\d{2}\s\d{4})\s+(.+)$/;

    // RIB Detection Regex: 24 digits or 16 digits with optional spaces/dashes
    const ribRegex = /(?:RIB|Compte|N[^\s]*\s*de\s*compte|N[^\s]*\s*compte)[:\s-]+([0-9A-Z\s-]{10,35})/i;
    const raw24DigitRegex = /\b(?:\d[ -\s]*){24}\b/;
    const raw16DigitRegex = /\b(?:\d[ -\s]*){16}\b/;

    // 1. First Pass: RIB / IBAN 24-digit detection
    let detectedRib = '';
    let candidate16 = '';
    for (const line of lines) {
      const cleanL = line.trim();
      if (!cleanL) continue;
      const ribMatch = cleanL.match(ribRegex);
      if (ribMatch) {
        const cleaned = this.cleanAndNormalizeRib(ribMatch[1]);
        if (cleaned.length >= 24) {
          detectedRib = cleaned;
          break;
        } else if (cleaned.length >= 10 && !candidate16) {
          candidate16 = cleaned;
        }
      }
    }

    if (!detectedRib) {
      for (const line of lines) {
        const cleanL = line.trim();
        if (!cleanL) continue;
        if (cleanL.toLowerCase().includes('tél') || cleanL.toLowerCase().includes('tel') || cleanL.toLowerCase().includes('fax')) {
          continue;
        }
        const raw24Match = cleanL.match(raw24DigitRegex);
        if (raw24Match) {
          detectedRib = this.cleanAndNormalizeRib(raw24Match[0]);
          break;
        }
      }
    }

    if (!detectedRib && !candidate16) {
      for (const line of lines) {
        const cleanL = line.trim();
        if (!cleanL) continue;
        if (cleanL.toLowerCase().includes('tél') || cleanL.toLowerCase().includes('tel') || cleanL.toLowerCase().includes('fax')) {
          continue;
        }
        const raw16Match = cleanL.match(raw16DigitRegex);
        if (raw16Match) {
          candidate16 = this.cleanAndNormalizeRib(raw16Match[0]);
        }
      }
    }

    rib = detectedRib || candidate16 || undefined;
    if (rib) {
      bankName = this.getBankNameByRib(rib);
    }

    let pendingLine: string | null = null;

    for (let i = 0; i < lines.length; i++) {
      const cleanLine = lines[i].trim();
      if (!cleanLine) continue;

      // Extract Bank Name heuristically from first few lines if not detected from RIB
      if (i < 30 && !bankName) {
        const lower = cleanLine.toLowerCase();
        if (lower.includes('attijariwafa')) bankName = 'Attijariwafa Bank';
        else if (lower.includes('bmce') || lower.includes('bank of africa')) bankName = 'Bank of Africa';
        else if (lower.includes('bp') || lower.includes('banque populaire')) bankName = 'Banque Populaire';
        else if (lower.includes('sgmb') || lower.includes('societe generale') || lower.includes('société générale')) bankName = 'Société Générale';
        else if (lower.includes('cdg')) bankName = 'CDG';
        else if (lower.includes('cih')) bankName = 'CIH Bank';
        else if (lower.includes('bmci')) bankName = 'BMCI';
        else if (lower.includes('credit du maroc') || lower.includes('crédit du maroc')) bankName = 'Crédit du Maroc';
        else if (lower.includes('barid')) bankName = 'Al Barid Bank';
        else if (lower.includes('cfg')) bankName = 'CFG Bank';
        else if (lower.includes('credit agricole') || lower.includes('crédit agricole')) bankName = 'Crédit Agricole';
        else if (lower.includes('bnp paribas')) bankName = 'BNP Paribas';
        else if (lower.includes('barclays')) bankName = 'Barclays';
        else if (lower.includes('hsbc')) bankName = 'HSBC';
        else if (lower.includes('citibank')) bankName = 'Citibank';
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
          const fullMatch = joined.match(atwRegex);
          if (fullMatch) {
            const tx = this.extractAtwTransaction(fullMatch);
            if (tx) transactions.push(tx);
          } else {
            const tx = this.parseJoinedLine(pendingLine, cleanLine);
            if (tx) transactions.push(tx);
          }
          pendingLine = null;
          continue;
        } else {
          pendingLine = null;
        }
      }

      // 1. Double Dates regex match (e.g. BP)
      const twoDatesMatch = cleanLine.match(twoDatesRegex);
      if (twoDatesMatch) {
        const dateStr = twoDatesMatch[1];
        const rest = twoDatesMatch[3].trim();
        const amtMatch = rest.match(amountRegex);
        if (amtMatch) {
          const amountStr = amtMatch[1];
          const parsed = this.parseAmount(amountStr, rest);
          if (parsed) {
            let desc = rest.substring(0, amtMatch.index).trim();
            let reference = '';
            const firstWordMatch = desc.match(/^(\S+)\s+(.+)$/);
            if (firstWordMatch && (firstWordMatch[1].match(/^[A-Z0-9]{5,15}$/) || firstWordMatch[1].match(/^\d+$/))) {
              reference = firstWordMatch[1];
              desc = firstWordMatch[2];
            }
            const normalizedDate = this.normalizeDateString(dateStr);
            transactions.push({
              date: normalizedDate,
              description: desc,
              type: parsed.type,
              montant: parsed.amount,
              reference
            });
            continue;
          }
        }
      }

      // 2. Concatenated Dates regex match (OCR glued dates)
      const concatMatch = cleanLine.match(concatDatesRegex);
      if (concatMatch) {
        const dateStr = concatMatch[1];
        const rest = concatMatch[3].trim();
        const amtMatch = rest.match(amountRegex);
        if (amtMatch) {
          const amountStr = amtMatch[1];
          const parsed = this.parseAmount(amountStr, rest);
          if (parsed) {
            const desc = rest.substring(0, amtMatch.index).trim();
            const normalizedDate = this.normalizeDateString(dateStr);
            transactions.push({
              date: normalizedDate,
              description: desc,
              type: parsed.type,
              montant: parsed.amount,
              reference: ''
            });
            continue;
          }
        }
      }

      // 3. Try full ATW match
      const atwMatch = cleanLine.match(atwRegex);
      if (atwMatch) {
        const tx = this.extractAtwTransaction(atwMatch);
        if (tx) transactions.push(tx);
        continue;
      }

      // 4. Check if this is a partial ATW line (code+date+libelle but no valeur)
      const partMatch = cleanLine.match(partialRegex);
      if (partMatch && cleanLine.match(/^[A-Z0-9]{6}/)) {
        pendingLine = cleanLine;
        continue;
      }

      // 5. Single Date regex match (Standard fallback)
      const singleDateMatch = cleanLine.match(singleDateRegex);
      if (singleDateMatch) {
        const dateStr = singleDateMatch[1];
        const rest = singleDateMatch[2].trim();
        const amtMatch = rest.match(amountRegex);
        if (amtMatch) {
          const amountStr = amtMatch[1];
          const parsed = this.parseAmount(amountStr, rest);
          if (parsed) {
            const desc = rest.substring(0, amtMatch.index).trim();
            const normalizedDate = this.normalizeDateString(dateStr);
            transactions.push({
              date: normalizedDate,
              description: desc,
              type: parsed.type,
              montant: parsed.amount,
              reference: ''
            });
            continue;
          }
        }
      }
    }

    console.log(`[PDF-PARSER] Extracted: ${transactions.length} txs. Detected RIB: ${rib}, Bank: ${bankName}`);
    return { transactions, detectedAccountInfo: { rib, bankName } };
  }

  private cleanAndNormalizeRib(raw: string): string {
    if (!raw) return '';
    let cleaned = raw.replace(/[^0-9A-Z]/gi, '').toUpperCase();
    
    let countryCode = '';
    let numbersPart = cleaned;
    if (/^[A-Z]{2}/.test(cleaned)) {
      countryCode = cleaned.substring(0, 2);
      numbersPart = cleaned.substring(2);
    }

    const ocrMap: { [key: string]: string } = {
      'B': '8',
      'O': '0',
      'I': '1',
      'L': '1',
      'S': '5',
      'Z': '2',
      'G': '6'
    };
    let normalizedNumbers = '';
    for (const char of numbersPart) {
      normalizedNumbers += ocrMap[char] || char;
    }
    return countryCode + normalizedNumbers;
  }

  private getBankNameByRib(rib: string): string | undefined {
    if (!rib) return undefined;
    
    let clean = rib.toUpperCase().replace(/[^A-Z0-9]/g, '');
    let bankCode = '';
    
    if (clean.startsWith('MA') && clean.length === 28) {
      bankCode = clean.substring(4, 7);
    } else if (clean.length === 24 && /^\d+$/.test(clean)) {
      bankCode = clean.substring(0, 3);
    } else if (clean.startsWith('FR') && clean.length === 27) {
      bankCode = clean.substring(4, 9);
      const frenchBanks: { [key: string]: string } = {
        '30002': 'Société Générale',
        '30003': 'Société Générale',
        '30004': 'BNP Paribas',
        '30056': 'HSBC',
        '10278': 'Barclays',
        '20041': 'La Banque Postale',
        '18206': 'Crédit Mutuel',
        '12819': 'Crédit Agricole'
      };
      if (frenchBanks[bankCode]) return frenchBanks[bankCode];
    }
    
    const bankCodes: { [key: string]: string } = {
      '007': 'Attijariwafa Bank',
      '181': 'Banque Populaire',
      '190': 'Banque Populaire',
      '011': 'Bank of Africa',
      '013': 'BMCI',
      '021': 'Crédit du Maroc',
      '022': 'Société Générale',
      '230': 'CIH Bank',
      '350': 'Al Barid Bank',
      '195': 'CFG Bank',
      '010': 'Crédit Agricole'
    };
    return bankCodes[bankCode];
  }

  private parseTextualMonth(monthStr: string): string | null {
    const lower = monthStr.toLowerCase().substring(0, 3);
    const months: { [key: string]: string } = {
      'jan': '01', 'fev': '02', 'fév': '02', 'mar': '03', 'avr': '04',
      'mai': '05', 'jun': '06', 'jui': '07', 'aou': '08', 'aoû': '08',
      'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12', 'déc': '12',
      'apr': '04', 'may': '05', 'aug': '08'
    };
    return months[lower] || null;
  }

  private normalizeDateString(dateStr: string): string {
    const cleanDate = dateStr.trim();
    const dateParts = cleanDate.split(/[\/\-\.\s]+/);
    if (dateParts.length === 3) {
      let day = dateParts[0].trim();
      let month = dateParts[1].trim();
      let year = dateParts[2].trim();

      if (day.length === 4) {
        const tmp = day;
        day = year;
        year = tmp;
      }

      if (isNaN(Number(month))) {
        const resolvedMonth = this.parseTextualMonth(month);
        if (resolvedMonth) month = resolvedMonth;
      }

      if (year.length === 2) {
        year = '20' + year;
      }

      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    } else if (dateParts.length === 2) {
      let day = dateParts[0].trim();
      let month = dateParts[1].trim();
      if (isNaN(Number(month))) {
        const resolvedMonth = this.parseTextualMonth(month);
        if (resolvedMonth) month = resolvedMonth;
      }
      const year = new Date().getFullYear().toString();
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    return dateStr;
  }

  private determineIsDebit(libelle: string): boolean {
    const libLower = libelle.toLowerCase();
    if (libLower.includes('echeance') || libLower.includes('echeance credit') || libLower.includes('echeance-credit') || libLower.includes('ech.cred') || libLower.includes('retrait') || libLower.includes('prlv') || libLower.includes('agios')) {
      return true;
    }
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
    return true;
  }

  private parseAmount(amountStr: string, desc: string): { amount: number, type: 'DEBIT' | 'CREDIT' } | null {
    let clean = amountStr.trim();
    let isDebit = false;
    let isCredit = false;

    if (clean.startsWith('(') && clean.endsWith(')')) {
      isDebit = true;
      clean = clean.substring(1, clean.length - 1);
    }

    if (clean.endsWith('-')) {
      isDebit = true;
      clean = clean.slice(0, -1);
    } else if (clean.endsWith('+')) {
      isCredit = true;
      clean = clean.slice(0, -1);
    }

    if (clean.toUpperCase().endsWith(' CR') || clean.toUpperCase().endsWith('CR')) {
      isCredit = true;
      clean = clean.replace(/cr$/i, '').trim();
    } else if (clean.toUpperCase().endsWith(' DB') || clean.toUpperCase().endsWith('DB')) {
      isDebit = true;
      clean = clean.replace(/db$/i, '').trim();
    }

    clean = clean.replace(/(?:MAD|DH|USD|EUR|GBP|CAD|AUD|CHF|[\$€£¥])/gi, '').trim();
    clean = clean.replace(/\s/g, '');

    const dotCount = (clean.match(/\./g) || []).length;
    const commaCount = (clean.match(/,/g) || []).length;

    if (dotCount === 1 && commaCount === 0) {
      clean = clean.replace(',', '');
    } else if (commaCount === 1 && dotCount === 0) {
      clean = clean.replace(',', '.');
    } else if (dotCount > 0 && commaCount === 1) {
      clean = clean.replace(/\./g, '').replace(',', '.');
    } else if (commaCount > 0 && dotCount === 1) {
      clean = clean.replace(/,/g, '');
    } else {
      clean = clean.replace(',', '.');
    }

    const val = parseFloat(clean);
    if (isNaN(val)) return null;

    let type: 'DEBIT' | 'CREDIT' = 'DEBIT';
    if (isCredit) {
      type = 'CREDIT';
    } else if (isDebit) {
      type = 'DEBIT';
    } else {
      type = this.determineIsDebit(desc) ? 'DEBIT' : 'CREDIT';
    }

    return { amount: Math.abs(val), type };
  }

  private extractAtwTransaction(match: RegExpMatchArray): any | null {
    const dateRaw = match[1];
    const libelle = match[2].trim();
    const valeurRaw = match[3];
    const amountStr = match[4].trim();

    const parsed = this.parseAmount(amountStr, libelle);
    if (!parsed) return null;

    const partsValeur = valeurRaw.split(' ');
    const year = partsValeur[2];
    const partsDate = dateRaw.split(' ');
    const month = partsDate[1];
    const day = partsDate[0];
    const date = year + '-' + month.padStart(2, '0') + '-' + day.padStart(2, '0');

    return { date, description: libelle, type: parsed.type, montant: parsed.amount, reference: '' };
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

    const parsed = this.parseAmount(amountStr, libelle);
    if (!parsed) return null;

    const partsValeur = valeurRaw.split(' ');
    const year = partsValeur[2];
    const partsDate = dateRaw.split(' ');
    const month = partsDate[1];
    const day = partsDate[0];
    const date = year + '-' + month.padStart(2, '0') + '-' + day.padStart(2, '0');

    return { date, description: libelle, type: parsed.type, montant: parsed.amount, reference: '' };
  }
}
