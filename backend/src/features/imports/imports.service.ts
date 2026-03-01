import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
const XLSX = require('xlsx');
const crypto = require('crypto');

@Injectable()
export class ImportsService {
  constructor(private prisma: PrismaService) { }

  private normalizeInvoiceNum(num: any): string {
    if (num === undefined || num === null || num === '') return '';
    const sn = String(num).replace(/\s+/g, ' ').trim().toUpperCase();
    return sn;
  }

  private logToFile(msg: string) {
    const fs = require('fs');
    const timestamp = new Date().toISOString();
    console.log(`[ServiceLog] ${msg}`); // ENSURE IT GOES TO STDOUT FOR REDIRECTION
    try {
      fs.appendFileSync(
        'import_execute.log',
        `${timestamp} [ServiceLog] ${msg}\n`,
      );
    } catch (e) {
      // Silently fail if file write fails, console.log is our primary now
    }
  }

  private isRowEmpty(row: any, mapping: any): boolean {
    if (!row) return true;
    // Check if ANY of the mapped fields have data
    const mappedValues = Object.values(mapping).filter(v => v !== undefined && v !== null && v !== '');
    if (mappedValues.length === 0) return false; // If nothing is mapped, don't skip as 'empty' (it might fail later, but not here)

    const hasData = mappedValues.some((csvHeader) => {
      const val = row[csvHeader as string];
      return val !== undefined && val !== null && String(val).trim() !== '';
    });
    return !hasData;
  }

  private isHeaderRow(row: any, mapping: any, index: number): boolean {
    if (!row || index > 2) return false; // Only check the first few rows

    // Detect if the row contains field names or synonyms (EXACT matches or very close)
    const synonyms = [
      'numero',
      'facture',
      'date',
      'montant',
      'client',
      'fournisseur',
      'type',
      'designation',
      'code',
      'prix',
      'ttc',
      'fourn',
      'npiece',
      'piece',
    ];
    let matches = 0;
    let totalMapped = 0;

    for (const [key, csvHeader] of Object.entries(mapping)) {
      if (!csvHeader) continue;
      totalMapped++;
      const val = String(row[csvHeader as string] || '')
        .toLowerCase()
        .trim();
      const fieldName = key.toLowerCase();

      // STRICTER MATCHING: Only match if the value is EXACTLY the field name or a synonym
      if (val && (val === fieldName || synonyms.includes(val))) {
        matches++;
      }
    }
    // High threshold for header detection
    return matches >= 2 && matches / totalMapped >= 0.5;
  }

  async parseFile(buffer: Buffer) {
    try {
      console.log(`Parsing buffer of size: ${buffer.length}`);
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      console.log('Workbook read. Sheet names:', workbook.SheetNames);

      if (workbook.SheetNames.length === 0) {
        throw new Error('No sheets found in workbook');
      }

      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      // raw: false ensures we get formatted strings, but cellDates: true gives us Dates for numbers.
      // We'll use cellDates: true to get Date objects directly where possible.
      const data = XLSX.utils.sheet_to_json(worksheet, {
        defval: '',
        cellDates: true,
      });

      console.log(`Parsed ${data.length} rows`);

      // Get headers
      const headers = data.length > 0 ? Object.keys(data[0] as object) : [];
      console.log('Headers detected:', headers);

      const result = {
        headers,
        data,
        preview: data.slice(0, 5),
      };

      console.log('About to return result with keys:', Object.keys(result));
      console.log('Result.headers length:', result.headers.length);
      console.log('Result.data length:', result.data.length);
      console.log('Result.preview length:', result.preview.length);

      return result;
    } catch (error) {
      console.error('Parse error details:', error);
      throw new BadRequestException('Failed to parse file: ' + error.message);
    }
  }

  async importClients(data: any[], mapping: any, centreId?: string) {
    const results = {
      success: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      errors: [] as string[],
    };

    console.log(`Starting importClients with centreId: ${centreId}`);

    // --- INTELLIGENT FAMILY GROUPING PRE-PROCESSING ---
    const phoneGroups = new Map<string, string>(); // Phone -> GroupeId
    const sharedPhones = new Map<string, string>(); // Phone -> FamilyName
    const phoneCounts = new Map<string, Set<string>>(); // Phone -> Set of Codes/Names

    data.forEach((row) => {
      const tel = row[mapping.telephone];
      const nom = row[mapping.nom];
      const code = row[mapping.codeClient];
      if (tel && (nom || code)) {
        if (!phoneCounts.has(tel)) phoneCounts.set(tel, new Set());
        phoneCounts.get(tel)!.add(code || nom);
        sharedPhones.set(tel, nom || 'Inconnu');
      }
    });

    // Identify phones shared by >1 person
    for (const [tel, people] of phoneCounts) {
      if (people.size > 1) {
        const familyName = sharedPhones.get(tel);
        // Ensure Groupe exists
        let group = await this.prisma.groupe.findFirst({
          where: { nom: `Famille ${familyName}` },
        });
        if (!group) {
          group = await this.prisma.groupe.create({
            data: {
              nom: `Famille ${familyName}`,
              description: `Groupe créé automatiquement par import (Tél: ${tel})`,
            },
          });
        }
        phoneGroups.set(tel, group.id);
      }
    }
    // ----------------------------------------------------

    for (const [index, row] of data.entries()) {
      try {
        const clientData: any = {
          typeClient: 'PARTICULIER', // Default
          dateCreation: new Date(), // Default Value
          statut: 'ACTIF',
          centreId: centreId, // Assign default center
        };

        // Link to Family Group if detected
        const rowTel = row[mapping.telephone];
        if (rowTel && phoneGroups.has(rowTel)) {
          clientData.groupeId = phoneGroups.get(rowTel);
        }

        for (const [dbField, csvHeader] of Object.entries(mapping)) {
          if (csvHeader && row[csvHeader as string] !== undefined) {
            let value = row[csvHeader as string];

            // 1. Handle Dates
            if (dbField === 'dateCreation' || dbField === 'dateNaissance') {
              const parsed = this.parseDate(value);
              value =
                dbField === 'dateCreation' ? parsed || new Date() : parsed;
            }
            // 2. Handle Booleans
            else if (dbField === 'tvaAssujetti') {
              value =
                value === 'true' ||
                value === true ||
                value === 1 ||
                value === '1';
            }
            // 3. Handle Integers
            else if (dbField === 'pointsFidelite') {
              value =
                value !== null && value !== undefined
                  ? parseInt(String(value), 10) || 0
                  : 0;
            }
            // 4. Handle JSON fields (Skipped here, handled in post-process)
            else if (
              [
                'couvertureSociale',
                'numCouvertureSociale',
                'groupeFamille',
                'dossierMedical',
                'contacts',
                'convention',
              ].includes(dbField)
            ) {
              // Keep as is for post-processing
            }
            // 5. Default: Force String & Trim for all other fields (Nom, Tel, Code, etc.)
            else {
              value =
                value !== null && value !== undefined
                  ? String(value).trim() || null
                  : null;
            }

            // Assign normalized value
            clientData[dbField] = value;
            if (value === null || value === '') {
              // console.log(`[ImportDebug] Field ${dbField} is empty for row ${index+1}`);
            }
          }
        }

        // Post-process specific fields (Aggregation & Nullification)
        // This ensures Json? fields are valid objects or null (strings NOT allowed)
        const assurance = clientData.couvertureSociale
          ? String(clientData.couvertureSociale).trim()
          : null;
        const numero = clientData.numCouvertureSociale
          ? String(clientData.numCouvertureSociale).trim()
          : null;

        if (assurance || numero) {
          clientData.couvertureSociale = {
            assurance: assurance || null,
            numero: numero || null,
          };
        } else {
          clientData.couvertureSociale = null;
        }

        // IMPORTANT: Always cleanup synthetic fields before Prisma
        delete clientData.numCouvertureSociale;

        // Business Logic
        if (!clientData.raisonSociale && !clientData.identifiantFiscal) {
          clientData.typeClient = 'particulier';
        } else if (clientData.raisonSociale) {
          clientData.typeClient = 'societe';
        }

        // Check for existing client (Smart Update)
        let existingClient: any = null;

        if (clientData.codeClient) {
          // EXCLUSIVE MATCH BY CODE: If code exists, it's our ONLY identifier
          existingClient = await this.prisma.client.findFirst({
            where: { codeClient: clientData.codeClient },
          });
        } else if (clientData.nom && clientData.telephone) {
          // FALLBACK: Only search by Name + Phone IF no code is provided
          existingClient = await this.prisma.client.findFirst({
            where: {
              nom: { equals: clientData.nom, mode: 'insensitive' },
              telephone: clientData.telephone,
            },
          });
        }

        if (existingClient) {
          // Smart Update: Only fill missing fields
          const updateData: any = {};
          let hasUpdates = false;

          // Also link to center if missing
          if (!existingClient.centreId && centreId) {
            updateData.centreId = centreId;
            hasUpdates = true;
          }

          for (const key of Object.keys(clientData)) {
            if (
              (existingClient[key] === null ||
                existingClient[key] === '' ||
                existingClient[key] === undefined) &&
              clientData[key]
            ) {
              updateData[key] = clientData[key];
              hasUpdates = true;
            }
          }

          if (hasUpdates) {
            await this.prisma.client.update({
              where: { id: existingClient.id },
              data: updateData,
            });
            results.updated++;
            results.success++; // Count update as a success row
          } else {
            // IT'S A DUPLICATE - BUT A SUCCESS (Data is already correct)
            results.success++;
            this.logToFile(
              `Row ${index + 1}: Informative - Duplicate client found with no new info. Counting as success.`,
            );
          }
        } else {
          await this.prisma.client.create({ data: clientData });
          results.success++;
        }
      } catch (error) {
        console.error(`Row ${index} error:`, error);

        // P2002 is Unique constraint failed
        if (error.code === 'P2002') {
          // Log which field caused the duplicate
          const field = error.meta?.target;
          console.warn(
            `Row ${index} skipped due to unique constraint on: ${field}`,
          );
          results.skipped++;
        } else {
          results.failed++;
          results.errors.push(`Row ${index + 1}: ${error.message}`);
        }
      }
    }

    return results;
  }

  private parseAmount(v: any): number {
    if (v === undefined || v === null || v === '') return 0;
    if (typeof v === 'number') return v;
    const s = String(v)
      .replace(/\s/g, '')
      .replace(',', '.')
      .replace(/[^0-9.-]/g, '');
    const val = parseFloat(s);
    return isNaN(val) ? 0 : val;
  }

  private parseDate(v: any): Date | null {
    if (
      v === undefined ||
      v === null ||
      String(v).trim() === '' ||
      v === 0 ||
      v === '0'
    )
      return null;

    // Handle Excel serial dates (numbers)
    let val = v;
    if (typeof v === 'string' && /^\d+(\.\d+)?$/.test(v)) {
      val = parseFloat(v);
    }

    if (typeof val === 'number' && val > 0 && val < 60000) {
      // Excel dates are days since 1900. Unix epoch is 25569 days after Excel epoch.
      const d = new Date(Math.round((val - 25569) * 86400 * 1000));
      if (d.getFullYear() < 1980) return null; // Sanity check
      return d;
    }

    const d = new Date(v);
    if (!isNaN(d.getTime())) {
      // Check if it's too old (e.g. interpreted as ms instead of days)
      if (d.getFullYear() <= 1970 && typeof v === 'number' && v > 0) {
        const corrected = new Date(Math.round((v - 25569) * 86400 * 1000));
        if (corrected.getFullYear() < 1980) return null;
        return corrected;
      }
      if (d.getFullYear() < 1980) return null;
      return d;
    }

    // Try manual parsing for common DD/MM/YYYY
    if (typeof v === 'string') {
      const parts = v.split(/[-/]/);
      if (parts.length === 3) {
        let day, month, year;
        // Check for YYYY-MM-DD (Year first)
        if (parts[0].length === 4) {
          year = parseInt(parts[0], 10);
          month = parseInt(parts[1], 10) - 1;
          day = parseInt(parts[2], 10);
        } else {
          // Assume DD-MM-YYYY
          day = parseInt(parts[0], 10);
          month = parseInt(parts[1], 10) - 1;
          year = parseInt(parts[2], 10);
        }

        if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
          const pd = new Date(year, month, day);
          if (!isNaN(pd.getTime()) && pd.getFullYear() >= 1980) return pd;
        }
      }
    }

    return null;
  }

  private inferExpenseCategory(description: string): string {
    const desc = description.toLowerCase();

    // Salary-related
    if (
      desc.includes('salaire') ||
      desc.includes('salary') ||
      desc.includes('paie')
    ) {
      return 'SALAIRE';
    }

    // Social security
    if (desc.includes('cnss') || desc.includes('securite sociale')) {
      return 'CHARGES_SOCIALES';
    }

    // Health insurance
    if (
      desc.includes('amo') ||
      desc.includes('assurance maladie') ||
      desc.includes('mutuelle')
    ) {
      return 'ASSURANCE';
    }

    // Rent
    if (desc.includes('loyer') || desc.includes('rent')) {
      return 'LOYER';
    }

    // Utilities
    if (
      desc.includes('electricite') ||
      desc.includes('eau') ||
      desc.includes('internet') ||
      desc.includes('telephone')
    ) {
      return 'CHARGES_FIXES';
    }

    // Default
    return 'AUTRE_DEPENSE';
  }

  async importFiches(
    data: any[],
    mapping: any,
    centreId?: string,
    importType: string = 'fiches',
  ) {
    const results = {
      success: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      errors: [] as string[],
    };

    const log = (msg: string) => {
      const now = new Date();
      console.log(
        `[${now.toISOString().split('T')[1].split('.')[0]}] 📄 ${msg}`,
      );
    };

    // Declare outside try so bulk insert can access them after the catch
    const fichesToCreate: any[] = [];
    const facturesToCreate: any[] = [];

    // Helper functions (defined early to avoid hoisting/TDZ issues)
    const parseNum = (v) => {
      if (v === undefined || v === null || v === '') return undefined;
      const raw = String(v).trim();
      const digitCount = (raw.match(/\d/g) || []).length;
      const alphaCount = (raw.match(/[a-zA-Z]/g) || []).length;
      if (alphaCount > 2 || digitCount === 0) return undefined;
      const val = raw.replace(',', '.').replace(/[^-0-9.]/g, '');
      const n = parseFloat(val);
      return isNaN(n) ? undefined : n;
    };

    const parseDate = (v) => this.parseDate(v);

    try {
      // TARGETED OPTIMIZATION:
      // Extract all search criteria from the CURRENT batch to fetch only needed clients
      const codes = new Set<string>();
      const names = new Set<string>();
      const phones = new Set<string>();

      data.forEach((row) => {
        const code = row[mapping.codeClient];
        if (code) codes.add(String(code));

        const name = row[mapping.nom];
        const phone = row[mapping.telephone];
        if (name) names.add(String(name));
        if (phone) phones.add(String(phone));
      });

      log(
        `Searching for clients in batch... (${codes.size
        } codes, ${names.size} names)`,
      );

      // Build targeted query
      const allClients = await this.prisma.client.findMany({
        where: {
          OR: [
            { codeClient: { in: Array.from(codes) } },
            {
              AND: [
                { nom: { in: Array.from(names) } },
                { telephone: { in: Array.from(phones) } },
              ],
            },
          ],
        },
        select: { id: true, codeClient: true, nom: true, telephone: true },
      });

      log(`Found ${allClients.length} potential client matches for this batch`);

      // Create lookup maps
      const codeMap = new Map();
      const identityMap = new Map();

      allClients.forEach((c) => {
        if (c.codeClient) codeMap.set(String(c.codeClient), c.id);
        if (c.nom && c.telephone) {
          const key = `${String(c.nom).toLowerCase().trim()}_${String(c.telephone).trim()} `;
          identityMap.set(key, c.id);
        }
      });

      // --- AUTO-PROVISIONING MISSING CLIENTS ---
      const missingClients: any[] = [];
      const processedCodes = new Set(codeMap.keys());
      const processedIdentities = new Set(identityMap.keys());
      const processedNames = new Set(); // Fallback for name-only

      data.forEach((row, idx) => {
        const mappedRow: any = {};
        for (const k of Object.keys(mapping)) {
          if (mapping[k]) mappedRow[k] = row[mapping[k]];
        }

        const code = mappedRow.codeClient ? String(mappedRow.codeClient) : null;
        const nom = mappedRow.nom
          ? String(mappedRow.nom).toLowerCase().trim()
          : '';
        const tel = mappedRow.telephone
          ? String(mappedRow.telephone).trim()
          : '';

        const identKey = nom && tel ? `${nom}_${tel} ` : null;

        let isMissing = false;
        if (code && !processedCodes.has(code)) {
          isMissing = true;
          processedCodes.add(code);
        } else if (!code && identKey && !processedIdentities.has(identKey)) {
          isMissing = true;
          processedIdentities.add(identKey);
        } else if (!code && !identKey && nom && !processedNames.has(nom)) {
          // New fallback: Create by name even if tel/code missing
          isMissing = true;
          processedNames.add(nom);
        } else if (
          !code &&
          !identKey &&
          !nom &&
          tel &&
          !processedNames.has(`tel_${tel} `)
        ) {
          // New fallback: Create by phone even if name/code missing
          isMissing = true;
          processedNames.add(`tel_${tel} `);
        }

        if (isMissing) {
          const clientTmpId = crypto.randomUUID();
          // Store in maps so subsequent rows in THIS SAME BATCH can find it
          if (code) codeMap.set(code, clientTmpId);
          if (identKey) identityMap.set(identKey, clientTmpId);
          if (nom && !identKey) {
            const fallbackKey = `name_${nom} `;
            if (!identityMap.has(fallbackKey))
              identityMap.set(fallbackKey, clientTmpId);
          }

          const clientData: any = {
            codeClient: code || null,
            nom:
              typeof mappedRow.nom === 'string' && mappedRow.nom.trim()
                ? mappedRow.nom.trim()
                : tel
                  ? `Client Tel ${tel} `
                  : code
                    ? `Client ${code} `
                    : 'Client Inconnu',
            prenom:
              typeof mappedRow.prenom === 'string' && mappedRow.prenom.trim()
                ? mappedRow.prenom.trim()
                : typeof mappedRow.prenom === 'number'
                  ? String(mappedRow.prenom)
                  : null,
            telephone: tel || null,
            email:
              typeof mappedRow.email === 'string' && mappedRow.email.trim()
                ? mappedRow.email.trim()
                : null,
            adresse:
              typeof mappedRow.adresse === 'string' && mappedRow.adresse.trim()
                ? mappedRow.adresse.trim()
                : null,
            ville:
              typeof mappedRow.ville === 'string' && mappedRow.ville.trim()
                ? mappedRow.ville.trim()
                : null,
            codePostal:
              typeof mappedRow.codePostal === 'string' &&
                mappedRow.codePostal.trim()
                ? mappedRow.codePostal.trim()
                : typeof mappedRow.codePostal === 'number'
                  ? String(mappedRow.codePostal)
                  : null,
            dateNaissance: parseDate(mappedRow.dateNaissance),
            dateCreation: parseDate(mappedRow.dateCreation) || new Date(),
            typeClient: 'PHYSIQUE',
            statut: 'ACTIF',
            centreId: centreId || null,
          };

          // Handle insurance (Aggregation & Nullification)
          const assuranceIns = mappedRow.couvertureSociale
            ? String(mappedRow.couvertureSociale).trim()
            : null;
          const numeroIns = mappedRow.numCouvertureSociale
            ? String(mappedRow.numCouvertureSociale).trim()
            : null;

          if (assuranceIns || numeroIns) {
            clientData.couvertureSociale = {
              assurance: assuranceIns || null,
              numero: numeroIns || null,
            };
          } else {
            clientData.couvertureSociale = null;
          }

          missingClients.push(clientData);
        }
      });

      if (missingClients.length > 0) {
        log(
          `⚡ Aggressive Auto - creating ${missingClients.length} missing clients...`,
        );
        await this.prisma.client.createMany({
          data: missingClients,
          skipDuplicates: true,
        });

        // Re-fetch ALL possible matches to update IDs
        const newClients = await this.prisma.client.findMany({
          where: {
            OR: [
              { codeClient: { in: Array.from(processedCodes) } },
              {
                AND: [
                  { nom: { in: Array.from(names) } },
                  { telephone: { in: Array.from(phones) } },
                ],
              },
              { nom: { in: Array.from(names) } }, // Aggressive fetch
              { telephone: { in: Array.from(phones) } },
            ],
          },
          select: { id: true, codeClient: true, nom: true, telephone: true },
        });

        newClients.forEach((c) => {
          if (c.codeClient) codeMap.set(String(c.codeClient), c.id);
          if (c.nom && c.telephone) {
            const key = `${String(c.nom).toLowerCase().trim()}_${String(c.telephone).trim()} `;
            identityMap.set(key, c.id);
          }
          // Secondary backups: match by name only or tel only if no full identity
          if (c.nom) {
            const nameKey = String(c.nom).toLowerCase().trim();
            if (!identityMap.has(nameKey)) identityMap.set(nameKey, c.id);
          }
          if (c.telephone) {
            const telKey = `tel_${String(c.telephone).trim()} `;
            if (!identityMap.has(telKey)) identityMap.set(telKey, c.id);
          }
        });
      }
      // ----------------------------------------

      // (arrays declared above, before try block)

      // 1. Group data by Fiche ID + Date
      const groupedFiches = new Map<string, any[]>();
      data.forEach((row, idx) => {
        const fid =
          row[mapping.fiche_id] ||
          (row[mapping.numero] ? String(row[mapping.numero]) : null);

        // Grouping by Date as well to separate historical visits
        const dateVal =
          row[mapping.dateCreation] || row[mapping.date_ordonnance];
        let dateStr = 'nodate';
        if (dateVal) {
          const d = new Date(dateVal);
          if (!isNaN(d.getTime())) {
            dateStr = d.toISOString().split('T')[0]; // Just YYYY-MM-DD to group same-day rows
          }
        }

        // Extract client identity for fallback key
        // [MODIFIED] logic: If we have a valid FID, we GROUP by it.
        // If NO FID, we force unique rows (ROW_idx) to avoid accidental merging of different people.
        let key = '';
        if (fid && fid !== 'nofid') {
          key = `FID_${fid}_${dateStr} `; // Group by ID + Date
        } else {
          key = `ROW_${idx}_${fid || 'nofid'} `; // Force unique if no ID
        }

        if (!groupedFiches.has(key)) groupedFiches.set(key, []);
        groupedFiches.get(key)!.push(row);
      });

      log(
        `Grouped ${data.length} rows into ${groupedFiches.size} unique fiches`,
      );

      // 2. Pre-fetch ALL possible existing Fiches to prevent N+1 queries latency
      log(`Pre-fetching existing Fiches to avoid N+1 latency...`);
      const ficheQueries: { clientId: string; numero: string }[] = [];
      const ficheLookupMap = new Map<string, any>();

      for (const [key, rows] of groupedFiches) {
        const firstRow = rows[0];
        const sharedMapped: any = {};
        for (const k of Object.keys(mapping)) {
          if (mapping[k]) sharedMapped[k] = firstRow[mapping[k]];
        }

        let cId = null;
        if (sharedMapped.codeClient) {
          cId = codeMap.get(String(sharedMapped.codeClient));
        } else if (sharedMapped.nom || sharedMapped.telephone) {
          const nomStr = sharedMapped.nom ? String(sharedMapped.nom).toLowerCase().trim() : '';
          const telStr = sharedMapped.telephone ? String(sharedMapped.telephone).trim() : '';
          const identKey = nomStr && telStr ? `${nomStr}_${telStr} ` : nomStr || `tel_${telStr} `;
          cId = identityMap.get(identKey);
        }

        const pm: any = {};
        rows.forEach((r) => {
          for (const k of Object.keys(mapping)) {
            if (mapping[k] !== undefined && mapping[k] !== null) {
              let v = r[mapping[k]];
              if (typeof v === 'string' && !v.trim()) v = '';
              if (v !== undefined && v !== null && v !== '' && (pm[k] === undefined || pm[k] === null || pm[k] === '')) {
                pm[k] = v;
              }
            }
          }
        });

        const fNum = pm.fiche_id ? String(pm.fiche_id) : pm.numero ? String(pm.numero) : null;
        if (cId && fNum) {
          ficheQueries.push({ clientId: cId, numero: fNum });
        }
      }

      if (ficheQueries.length > 0) {
        log(`Executing pre-fetch query for ${ficheQueries.length} possible existing Fiches...`);
        // Chunk the OR query to avoid Prisma limits (e.g. max 2000 expressions) if needed
        const chunkSize = 1500;
        for (let i = 0; i < ficheQueries.length; i += chunkSize) {
          const chunk = ficheQueries.slice(i, i + chunkSize);
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
          const existing = await this.prisma.fiche.findMany({
            where: { OR: chunk as any }
          });
          existing.forEach(ex => ficheLookupMap.set(`${ex.clientId}_${ex.numero}`, ex));
        }
        log(`Found ${ficheLookupMap.size} existing Fiches in the database.`);
      }

      // 3. Process each group
      let groupIndex = 0;
      for (const [key, rows] of groupedFiches) {
        try {
          // Extract shared data from first row
          const firstRow = rows[0];
          const sharedMapped: any = {};
          for (const k of Object.keys(mapping)) {
            if (mapping[k]) sharedMapped[k] = firstRow[mapping[k]];
          }

          // Resolve Client ID
          let clientId = null;
          if (sharedMapped.codeClient) {
            clientId = codeMap.get(String(sharedMapped.codeClient));
          } else if (sharedMapped.nom || sharedMapped.telephone) {
            const nomStr = sharedMapped.nom
              ? String(sharedMapped.nom).toLowerCase().trim()
              : '';
            const telStr = sharedMapped.telephone
              ? String(sharedMapped.telephone).trim()
              : '';
            const identKey =
              nomStr && telStr
                ? `${nomStr}_${telStr} `
                : nomStr || `tel_${telStr} `;
            clientId = identityMap.get(identKey);
          }

          if (!clientId) {
            log(
              `Skipping group ${key}: No client found(code: ${sharedMapped.codeClient}, nom: ${sharedMapped.nom}, tel: ${sharedMapped.telephone})`,
            );
            results.skipped += rows.length;
            continue;
          }

          // 2. CONSOLIDATED UNIFIED LOGIC
          // We merge ALL rows in the group into a single Fiche.

          const pm: any = {};
          rows.forEach((row) => {
            for (const k of Object.keys(mapping)) {
              if (mapping[k]) {
                let val = row[mapping[k]];
                // Normalize: Treat whitespace-only as empty
                if (typeof val === 'string' && !val.trim()) val = '';

                if (val !== undefined && val !== null && val !== '') {
                  if (pm[k] === undefined || pm[k] === null || pm[k] === '') {
                    pm[k] = val;
                  }
                }
              }
            }
          });

          // Determine main type of the fiche based on priority:
          // 1. Explicit "Type Dossier" column (M=Monture, L=Lentilles)
          // 2. Automatic detection: lentilles > monture > produit
          let finalType = 'produit';
          let hasMontureData = false;
          let hasLentilleData = false;

          const explicitType = pm.fiche_type
            ? String(pm.fiche_type).trim().toUpperCase()
            : null;

          // [FIX] Independent detection: Don't let explicitType block the other data type
          hasMontureData = !!(
            pm.monture_marque ||
            pm.monture_reference ||
            pm.verres_type ||
            pm.verres_prix_od ||
            pm.verres_prix_og ||
            pm.verres_marque ||
            pm.verres_matiere
          );
          hasLentilleData = !!(
            pm.lentilles_marque ||
            pm.od_rayon ||
            pm.og_rayon ||
            pm.lentilles_marque_od ||
            pm.lentilles_marque_og ||
            pm.lentilles_prix ||
            pm.lentilles_usage
          );

          const hasPrescription = !!(
            pm.od_sphere ||
            pm.og_sphere ||
            pm.od_cylindre ||
            pm.og_cylindre
          );

          if (explicitType === 'M') {
            finalType = 'monture';
          } else if (explicitType === 'L') {
            finalType = 'lentilles';
          } else {
            // FALLBACK: Automatic Detection
            if (hasLentilleData) finalType = 'lentilles';
            else if (hasMontureData || hasPrescription) finalType = 'monture';
          }

          // Force detection flags if explicit type is set (for backward compatibility or explicit mapping)
          if (explicitType === 'M') hasMontureData = true;
          if (explicitType === 'L') hasLentilleData = true;

          groupIndex++;

          // Initialize Unified Content
          const content: any = {
            ordonnance: {
              od: {
                sphere: parseNum(pm.od_sphere),
                cylindre: parseNum(pm.od_cylindre),
                axe: parseNum(pm.od_axe),
                addition: parseNum(pm.od_addition),
                k1: parseNum(pm.od_k1),
                k2: parseNum(pm.od_k2),
              },
              og: {
                sphere: parseNum(pm.og_sphere),
                cylindre: parseNum(pm.og_cylindre),
                axe: parseNum(pm.og_axe),
                addition: parseNum(pm.og_addition),
                k1: parseNum(pm.og_k1),
                k2: parseNum(pm.og_k2),
              },
              epOD: parseNum(pm.ep_od),
              epOG: parseNum(pm.ep_og),
              dateOrdonnance: parseDate(pm.date_ordonnance),
              nomMedecin: pm.nom_medecin,
            },
            equipements: [],
            notes: pm.notes,
            fournisseur: pm.fournisseur,
            factureFournisseur: pm.facture_fournisseur,
            dateLivraisonEstimee: parseDate(pm.dateLivraisonEstimee),
          };

          // Add Monture if present
          if (hasMontureData) {
            content.monture = {
              marque: pm.monture_marque,
              modele: pm.monture_modele,
              reference: pm.monture_reference,
              prixMonture: parseNum(pm.monture_prix) || 0,
            };
            content.verres = {
              type: pm.verres_type || 'Unifocal',
              indice: pm.verres_indice,
              matiere: pm.verres_matiere,
              marque: pm.verres_marque,
              traitement: pm.verres_traitement ? [pm.verres_traitement] : [],
              prixOD: parseNum(pm.verres_prix_od) || 0,
              prixOG: parseNum(pm.verres_prix_og) || 0,
              matiereOD: pm.verres_matiere_od || pm.verres_matiere,
              matiereOG: pm.verres_matiere_og || pm.verres_matiere,
              indiceOD: pm.verres_indice_od || pm.verres_indice,
              indiceOG: pm.verres_indice_og || pm.verres_indice,
              differentODOG: !!(
                pm.og_sphere ||
                pm.og_cylindre ||
                pm.og_axe ||
                pm.verres_prix_og ||
                (pm.verres_matiere_od &&
                  pm.verres_matiere_og &&
                  pm.verres_matiere_od !== pm.verres_matiere_og) ||
                (pm.verres_indice_od &&
                  pm.verres_indice_og &&
                  pm.verres_indice_od !== pm.verres_indice_og)
              ),
            };
          }

          // Add Lentilles if present
          if (hasLentilleData) {
            content.lentilles = {
              type: pm.lentilles_usage || 'Mensuelle',
              diffLentilles: !!(
                pm.og_rayon ||
                pm.og_diametre ||
                pm.og_sphere ||
                pm.og_cylindre ||
                pm.og_axe ||
                (pm.lentilles_marque_od &&
                  pm.lentilles_marque_og &&
                  pm.lentilles_marque_od !== pm.lentilles_marque_og)
              ),
              od: {
                marque: pm.lentilles_marque_od || pm.lentilles_marque,
                modele: pm.lentilles_modele_od || pm.lentilles_modele,
                rayon: parseNum(pm.od_rayon),
                diametre: parseNum(pm.od_diametre),
                sphere: parseNum(pm.od_sphere),
                cylindre: parseNum(pm.od_cylindre),
                axe: parseNum(pm.od_axe),
                prix: parseNum(pm.lentilles_prix) || 0,
                quantite: parseNum(pm.lentilles_qte) || 1,
              },
              og: {
                marque: pm.lentilles_marque_og || pm.lentilles_marque,
                modele: pm.lentilles_modele_og || pm.lentilles_modele,
                rayon: parseNum(pm.og_rayon),
                diametre: parseNum(pm.og_diametre),
                sphere: parseNum(pm.og_sphere),
                cylindre: parseNum(pm.og_cylindre),
                axe: parseNum(pm.og_axe),
                prix: parseNum(pm.lentilles_prix) || 0,
                quantite: parseNum(pm.lentilles_qte) || 1,
              },
            };
          }

          // Process ALL rows for products and equipments
          const addedProductsRefs = new Set();

          rows.forEach((row, rowIndex) => {
            const m: any = {};
            for (const k of Object.keys(mapping))
              if (mapping[k]) m[k] = row[mapping[k]];

            // Products
            const addProd = (ref, desc, qte, prix) => {
              if ((ref || desc) && !addedProductsRefs.has(ref + desc)) {
                if (!content.produits) content.produits = [];
                content.produits.push({
                  reference: String(ref || ''),
                  designation: String(desc || ''),
                  quantite: parseNum(qte) || 1,
                  prixUnitaire: parseNum(prix) || 0,
                  prixTotal: (parseNum(qte) || 1) * (parseNum(prix) || 0),
                });
                addedProductsRefs.add(ref + desc);
              }
            };
            addProd(
              m.produit_ref,
              m.produit_designation,
              m.produit_qte,
              m.produit_prix,
            );
            addProd(
              m.produit2_ref,
              m.produit2_designation,
              m.produit2_qte,
              m.produit2_prix,
            );

            // --- EQUIPMENT PROCESSING ---

            // Helper to create equipment object
            const createEquip = (mtType, mtData, vrData) => ({
              type: mtType || 'Monture',
              dateAjout: new Date(),
              monture: {
                marque: mtData.marque,
                modele: mtData.modele,
                reference: mtData.reference || 'Equipement Extra',
                prixMonture: parseNum(mtData.prix) || 0,
              },
              verres: {
                type: 'Unifocal',
                marque: vrData.marque,
                prixOD: parseNum(vrData.prix_od) || 0,
                prixOG:
                  parseNum(vrData.prix_og) || parseNum(vrData.prix_od) || 0,
              },
            });

            // 1. Process PRIMARY columns for SUBSEQUENT rows (rowIndex > 0)
            if (rowIndex > 0) {
              // Check if this row has Primary data (Monture/Verres OR Lentilles)
              const hasPrimaryData =
                m.monture_marque ||
                m.monture_reference ||
                m.verres_marque ||
                m.verres_prix_od ||
                m.lentilles_marque ||
                m.lentilles_prix ||
                m.od_rayon;

              if (hasPrimaryData) {
                // [NEW] MERGE INTO MAIN if Main is currently empty or contains generic "CLIENT" placeholder
                const isMainMontureEmpty =
                  !content.monture?.marque ||
                  content.monture?.marque === 'CLIENT';
                const isMainVerresEmpty = !content.verres?.marque;
                const isMainLentillesEmpty =
                  !content.lentilles?.od?.marque &&
                  !content.lentilles?.og?.marque;

                if (
                  isMainMontureEmpty &&
                  m.monture_marque &&
                  m.monture_marque !== 'CLIENT'
                ) {
                  // Merge frame data into root
                  if (!content.monture) content.monture = {};
                  content.monture.marque = m.monture_marque;
                  content.monture.modele =
                    m.monture_modele || content.monture.modele;
                  content.monture.reference =
                    m.monture_reference || content.monture.reference;
                  content.monture.prixMonture =
                    parseNum(m.monture_prix) || content.monture.prixMonture;
                  console.log(
                    `MERGED Subsequent Row ${rowIndex} Monture into Main: ${m.monture_marque} `,
                  );
                } else if (isMainVerresEmpty && m.verres_marque) {
                  // Merge lens data into root
                  if (!content.verres) content.verres = { type: 'Unifocal' };
                  content.verres.marque = m.verres_marque;
                  content.verres.prixOD =
                    parseNum(m.verres_prix_od) || content.verres.prixOD;
                  content.verres.prixOG =
                    parseNum(m.verres_prix_og) ||
                    parseNum(m.verres_prix_od) ||
                    content.verres.prixOG;
                  console.log(
                    `MERGED Subsequent Row ${rowIndex} Verres into Main: ${m.verres_marque} `,
                  );
                } else if (
                  isMainLentillesEmpty &&
                  (m.lentilles_marque ||
                    m.lentilles_marque_od ||
                    m.lentilles_marque_og)
                ) {
                  // Merge contact lens data into root
                  if (!content.lentilles) {
                    content.lentilles = {
                      type: m.lentilles_usage || 'Mensuelle',
                      od: {},
                      og: {},
                    };
                  }
                  content.lentilles.od.marque =
                    m.lentilles_marque_od ||
                    m.lentilles_marque ||
                    content.lentilles.od.marque;
                  content.lentilles.og.marque =
                    m.lentilles_marque_og ||
                    m.lentilles_marque ||
                    content.lentilles.og.marque;
                  content.lentilles.od.prix =
                    parseNum(m.lentilles_prix) || content.lentilles.od.prix;
                  content.lentilles.og.prix =
                    parseNum(m.lentilles_prix) || content.lentilles.og.prix;
                  console.log(
                    `MERGED Subsequent Row ${rowIndex} Lentilles into Main`,
                  );
                } else {
                  // Both Main and Row have data -> Add as NEW equipment to avoid overwriting
                  content.equipements.push(
                    createEquip(
                      'Monture',
                      {
                        marque: m.monture_marque,
                        modele: m.monture_modele,
                        reference: m.monture_reference,
                        prix: m.monture_prix,
                      },
                      {
                        marque: m.verres_marque,
                        prix_od: m.verres_prix_od,
                        prix_og: m.verres_prix_og,
                      },
                    ),
                  );
                }
              }
            } else {
              // 2. FOR ROW 0 ONLY: Checks for 0-price overwrite
              // If content.verres (Main) has 0 price, but this row effectively has a price, patch it.
              const v_od = m.verres_prix_od;
              const v_og = m.verres_prix_og;
              const m_prix = m.monture_prix;
              const l_prix = m.lentilles_prix;

              const v_od_n = parseNum(v_od) || 0;
              const v_og_n = parseNum(v_og) || 0;
              const m_prix_n = parseNum(m_prix) || 0;
              const l_prix_n = parseNum(l_prix) || 0;

              if (content.verres && content.verres.prixOD === 0 && v_od_n > 0) {
                content.verres.prixOD = v_od_n;
              }
              if (
                content.verres &&
                content.verres.prixOG === 0 &&
                (v_og_n > 0 || v_od_n > 0)
              ) {
                content.verres.prixOG = v_og_n || v_od_n;
              }
              // Same for Monture
              if (
                content.monture &&
                (content.monture.prixMonture === 0 ||
                  !content.monture.prixMonture) &&
                m_prix_n > 0
              ) {
                content.monture.prixMonture = m_prix_n;
              }
              // Same for Lentilles
              if (
                content.lentilles &&
                content.lentilles.od &&
                (content.lentilles.od.prix === 0 ||
                  !content.lentilles.od.prix) &&
                l_prix_n > 0
              ) {
                content.lentilles.od.prix = l_prix_n;
                if (content.lentilles.og) content.lentilles.og.prix = l_prix_n;
              }
            }

            // 3. Process SECONDARY columns (For ALL rows, including Row 0)
            // If monture2 exists, it's ALWAYS a separate equipment.
            if (
              m.monture2_marque ||
              m.monture2_reference ||
              m.verres2_marque ||
              m.verres2_prix_od
            ) {
              // FAILSAFE: Strict check against Main Equipment
              const matchesMain =
                m.monture2_marque === content.monture?.marque &&
                m.monture2_reference === content.monture?.reference;

              if (!matchesMain) {
                content.equipements.push(
                  createEquip(
                    'Monture',
                    {
                      marque: m.monture2_marque,
                      modele: m.monture2_modele,
                      reference: m.monture2_reference || 'Equipement 2',
                      prix: m.monture2_prix,
                    },
                    {
                      marque: m.verres2_marque,
                      prix_od: m.verres2_prix_od,
                      prix_og: m.verres2_prix_og,
                    },
                  ),
                );
              } else {
                // If it matches main, maybe we can steal the price if main is missing it?
                if (
                  content.monture &&
                  content.monture.prixMonture === 0 &&
                  m.monture2_prix
                ) {
                  content.monture.prixMonture = parseNum(m.monture2_prix) || 0;
                }
              }
            }
          });

          // Sum up montantPaye and analyze other business flags
          const totalPaye = rows.reduce(
            (sum, r) => sum + (parseNum(r[mapping.montantPaye]) || 0),
            0,
          );
          const totalAmount = parseNum(pm.montantTotal) || 0;

          // --- LOGICAL MAPPING FOR DOCUMENT TYPE ---
          const isValide =
            String(pm.valide || '')
              .toLowerCase()
              .trim() === 'true' || pm.valide === true;
          const isDefinitive =
            String(pm.facture || '')
              .trim()
              .toLowerCase() === 'oui';
          const hasInvoiceNum = !!(pm.numero || pm.fiche_id || pm.numero_fiche);

          // [avecFacture] VRAI = create invoice, FAUX = skip invoice (notes acompte on fiche only)
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
          const avecFactureRaw = pm.avecFacture !== undefined ? pm.avecFacture : pm.facture;
          const avecFactureStr = String(avecFactureRaw || '').toLowerCase().trim();
          // Explicit FAUX / false / non / no means: skip invoice creation
          const avecFactureIsFaux = ['faux', 'false', 'non', 'no', '0', 'n'].includes(avecFactureStr);

          // Determine if we REALLY want to create an invoice record now
          // We only create it if it's Validated, Invoiced, has a Payment, or has an Explicit Number
          // BUT: avecFacture=FAUX overrides everything — no facture for this fiche
          const shouldCreateInvoice = !avecFactureIsFaux &&
            (isValide || isDefinitive || totalPaye > 0 || hasInvoiceNum);

          let docType = 'DEVIS';
          let docStatut = 'BROUILLON';

          if (isValide) {
            if (isDefinitive) {
              docType = 'FACTURE';
              docStatut = 'VALIDE';
            } else {
              docType = 'BON_COMMANDE';
              docStatut = 'VALIDE';
            }
          } else if (totalPaye > 0 || isDefinitive) {
            docType = 'BON_COMMANDE';
            docStatut = 'VALIDE';
          }

          // Pre-generate IDs
          const ficheId = crypto.randomUUID();

          // ROBUST NUMERO PARSING FOR FICHE
          // e.g. "158/2019" -> 100158 (if we want uniqueness) or just 158?
          // Let's stick to the same logic as Sales Import: Extract first valid number.
          let ficheNumero: number | undefined;
          const rawFicheNum = pm.numero || pm.fiche_id || pm.numero_fiche;
          if (rawFicheNum) {
            const parts = String(rawFicheNum)
              .split(/[^0-9]/)
              .filter((p) => p.length > 0);
            if (parts.length > 0) {
              const parsed = parseInt(parts[0]);
              if (!isNaN(parsed)) ficheNumero = parsed;
            }
          }

          // Use the parsed number if available, otherwise let the DB auto-increment (by not providing it?)
          // Prisma createMany doesn't support omitting auto-increment fields easily if we mix them?
          // actually it does if we mark it optional in type.
          // But here we might want to force it to match the paper dossier number.

          const ficheObject: any = {
            id: ficheId,
            clientId: clientId,
            type: finalType,
            statut: String(pm.statut || 'livre').toLowerCase(),
            dateCreation: parseDate(pm.dateCreation) || new Date(),
            montantTotal: totalAmount,
            montantPaye: totalPaye,
            content: content,
          };

          if (ficheNumero) {
            ficheObject.numero = ficheNumero;
          }

          // ─── UPSERT: Check if this Fiche already exists ───────────────
          // Match by: clientId + numero (if provided), else clientId + dateCreation date
          let existingFiche: any = null;
          if (ficheNumero && clientId) {
            existingFiche = ficheLookupMap.get(`${clientId}_${ficheNumero}`);
          }

          if (existingFiche) {
            // Reuse the existing fiche ID so the linked Facture upsert still points to it
            // Only update facturesToCreate, we bypass updating the Fiche itself synchronously to save time
            // since this is an import of a blank/fresh environment usually.
            // If strictly needed, we can batch update later, but for Fiches, skipping duplicate creation is the main goal.

            // Update facturesToCreate to use existing fiche ID
            const pendingFacture = facturesToCreate.find(
              (f) => f.ficheId === ficheId,
            );
            if (pendingFacture) pendingFacture.ficheId = existingFiche.id;
            results.updated++;
          } else {
            fichesToCreate.push(ficheObject);
          }
          // ─────────────────────────────────────────────────────────────

          // Conditional linked Facture creation
          if (shouldCreateInvoice) {
            const factureId = crypto.randomUUID();
            let invoiceNumero = pm.numero
              ? String(pm.numero)
              : pm.fiche_id
                ? String(pm.fiche_id)
                : pm.numero_fiche
                  ? String(pm.numero_fiche)
                  : null;
            if (
              !invoiceNumero ||
              invoiceNumero === 'nofid' ||
              invoiceNumero === 'null' ||
              invoiceNumero === 'undefined'
            ) {
              invoiceNumero = `IMP-${docType}-${Date.now()}-${groupIndex}`;
            }
            if (docType === 'FACTURE' && !invoiceNumero.startsWith('FAC-')) {
              invoiceNumero = `FAC-${invoiceNumero}`;
            }

            const resteAPayer = Math.max(0, totalAmount - totalPaye);
            const finalStatut =
              resteAPayer <= 0 && docType === 'FACTURE' ? 'PAYEE' : docStatut;

            facturesToCreate.push({
              id: factureId,
              numero: invoiceNumero,
              type: docType,
              statut: finalStatut,
              clientId: clientId,
              ficheId: ficheId,
              centreId: centreId || null,
              dateEmission: parseDate(pm.dateCreation) || new Date(),
              totalHT: totalAmount / 1.2,
              totalTVA: totalAmount - totalAmount / 1.2,
              totalTTC: totalAmount,
              resteAPayer: resteAPayer,
              _acompte: totalPaye, // Temporary field for post-bulk payment creation
              lignes: (() => {
                const lines: any[] = [];
                const addLine = (desc: string, qte: number, price: number) => {
                  if (price > 0 || desc) {
                    lines.push({
                      description: desc || 'Article',
                      qte: qte || 1,
                      prixUnitaireTTC: price || 0,
                      remise: 0,
                      totalTTC: (qte || 1) * (price || 0),
                    });
                  }
                };

                // DEBUG LOGGING (Temporary)
                // if (f.numero.endsWith('50') || f.numero === 'FAC-81/2024') {
                //     console.log(`🔍 GENERATING LINES FOR ${f.numero}`);
                //     console.log('   Content Monture:', JSON.stringify(content.monture));
                //     console.log('   Content Verres:', JSON.stringify(content.verres));
                // }

                // 1. Monture
                if (content.monture && content.monture.marque) {
                  const desc =
                    `Monture ${content.monture.marque} ${content.monture.reference || ''}`.trim();
                  addLine(desc, 1, content.monture.prixMonture);
                }

                // 2. Verres
                if (content.verres) {
                  const prixVerres =
                    (content.verres.prixOD || 0) + (content.verres.prixOG || 0);
                  // Relax condition: even if price is 0, if marque exists, add it
                  if (prixVerres > 0 || content.verres.marque) {
                    const desc =
                      `Verres ${content.verres.type} ${content.verres.marque || ''}`.trim();
                    addLine(desc, 1, prixVerres);
                  }
                }

                // 3. Lentilles
                if (content.lentilles) {
                  const prixLentilles =
                    (content.lentilles.od?.prix || 0) +
                    (content.lentilles.og?.prix || 0);
                  if (
                    prixLentilles > 0 ||
                    content.lentilles.od?.marque ||
                    content.lentilles.og?.marque
                  ) {
                    addLine('Lentilles de contact', 1, prixLentilles);
                  }
                }

                // 4. Produits
                if (content.produits && Array.isArray(content.produits)) {
                  content.produits.forEach((p: any) => {
                    addLine(p.designation, p.quantite, p.prixUnitaire);
                  });
                }

                // 5. Autres Equipements
                if (content.equipements && Array.isArray(content.equipements)) {
                  content.equipements.forEach((eq: any, idx: number) => {
                    if (eq.monture) {
                      const desc =
                        `Equipement ${idx + 2} - Monture ${eq.monture.marque || ''}`.trim();
                      addLine(desc, 1, eq.monture.prixMonture);
                    }
                    if (eq.verres) {
                      const prixV =
                        (eq.verres.prixOD || 0) + (eq.verres.prixOG || 0);
                      const desc =
                        `Equipement ${idx + 2} - Verres ${eq.verres.marque || ''}`.trim();
                      addLine(desc, 1, prixV);
                    }
                  });
                }

                // Fallback: If no lines but total > 0, add a global line
                const currentTotal = lines.reduce(
                  (acc, l) => acc + l.totalTTC,
                  0,
                );
                if (lines.length === 0 && totalAmount > 0) {
                  addLine('Import Global - Détail manquant', 1, totalAmount);
                }

                return lines;
              })(),
              proprietes: {},
            });
          }

          results.success++;
        } catch (error) {
          results.failed++;
          if (results.errors.length < 100)
            results.errors.push(`Groupe ${key}: ${error.message} `);
        }
      }
    } catch (globalError) {
      console.error('CRITICAL IMPORT ERROR:', globalError);
      results.failed = data.length;
      results.errors.push(`Erreur Critique: ${globalError.message} `);
    }

    // Bulk insert OUTSIDE global catch — failures here are non-fatal to fiche creation
    if (fichesToCreate.length > 0) {
      console.log(
        `🚀 Bulk inserting ${fichesToCreate.length} fiches and ${facturesToCreate.length} factures...`,
      );
      for (let i = 0; i < fichesToCreate.length; i += 5000) {
        const ficheChunk = fichesToCreate.slice(i, i + 5000);
        const factureChunk = facturesToCreate.slice(i, i + 5000);

        try {
          await this.prisma.fiche.createMany({
            data: ficheChunk,
            skipDuplicates: true,
          });
        } catch (ficheErr) {
          console.error('Fiche chunk insert error:', (ficheErr as Error).message);
        }

        // DIRECT UPSERT LOOP: Force update to fix empty lines even if record exists
        // OPTIMIZATION: Process in parallel batches of 50 to drastically reduce DB latency
        const UPSERT_BATCH_SIZE = 50;
        for (let j = 0; j < factureChunk.length; j += UPSERT_BATCH_SIZE) {
          const concurrentChunk = factureChunk.slice(j, j + UPSERT_BATCH_SIZE);
          await Promise.all(
            concurrentChunk.map(async (f) => {
              try {
                // Exclude ID and _acompte from update data to avoid Prisma errors
                const { id, _acompte, ...updateData } = f;

                await this.prisma.facture.upsert({
                  where: { numero: f.numero },
                  update: updateData,
                  create: { ...updateData, id: f.id }, // Make sure _acompte is removed from create too
                });
              } catch (singleErr) {
                console.error(
                  `❌ Upsert FAILED for facture ${f.numero}: ${(singleErr as Error).message}`,
                );
              }
            }),
          );
        }
      }
    }

    // --- NEW: Process acompte into Paiement records for all created factures ---
    const paymentsToCreate: any[] = [];
    for (const f of facturesToCreate) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (f._acompte && f._acompte > 0) {
        paymentsToCreate.push({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
          factureId: f.id,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
          montant: f._acompte,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
          date: f.dateEmission || new Date(),
          mode: 'ESPECES', // Assuming cash for acompte import
          statut: 'ENCAISSE',
          notes: 'Acompte Import (Délivrance)',
        });
      }
    }

    if (paymentsToCreate.length > 0) {
      try {
        await this.prisma.paiement.createMany({
          data: paymentsToCreate,
          skipDuplicates: true,
        });
        console.log(`✅ Bulk created ${paymentsToCreate.length} acomptes.`);
      } catch (err) {
        console.error('❌ Error creating acompte payments in bulk:', (err as Error).message);
      }
    }

    return results;
  }

  async importProducts(data: any[], mapping: any, warehouseId: string) {
    const results = {
      success: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const [index, row] of data.entries()) {
      let productData: any = {}; // Declare outside try block for error logging scope
      try {
        productData = {
          typeArticle: 'MONTURE', // Default
          statut: 'ACTIF',
          entrepotId: warehouseId,
          utilisateurCreation: 'IMPORT_SYSTEM', // Required field for imports
          seuilAlerte: 1, // Default threshold for imported products
        };

        // Apply mapping
        const specificData: any = {}; // For fields that go into specificData JSON

        for (const [dbField, csvHeader] of Object.entries(mapping)) {
          if (csvHeader && row[csvHeader as string] !== undefined) {
            let value = row[csvHeader as string];

            // Type conversions for numeric fields
            if (
              [
                'prixAchatHT',
                'prixVenteHT',
                'prixVenteTTC',
                'quantiteActuelle',
                'seuilAlerte',
                'coefficient',
                'tauxTVA',
              ].includes(dbField)
            ) {
              value = parseFloat(value) || 0;
            }

            // Force string for text fields to avoid type errors (e.g. numeric barcodes/codes)
            if (
              [
                'codeInterne',
                'codeBarres',
                'designation',
                'marque',
                'modele',
                'couleur',
              ].includes(dbField)
            ) {
              value = String(value || '');
            }

            // Special handling for fields that go into specificData
            if (dbField === 'montage') {
              specificData.cerclage = value; // Store montage as cerclage in specificData
            } else {
              productData[dbField] = value;
            }
          }
        }

        // Add specificData if we have any special fields
        if (Object.keys(specificData).length > 0) {
          productData.specificData = specificData;
        }

        // Auto-generate designation if missing (Include Color for uniqueness!)
        if (
          !productData.designation &&
          (productData.marque || productData.modele)
        ) {
          productData.designation = [
            productData.marque,
            productData.modele,
            productData.couleur,
          ]
            .filter(Boolean)
            .join(' ');
        }

        // Basic validation
        if (!productData.designation) {
          const debugInfo = {
            row,
            mapping,
            productData,
          };
          require('fs').writeFileSync(
            'debug_import_error.json',
            JSON.stringify(debugInfo, null, 2),
          );

          console.error('❌ Designation Validation Fail:', debugInfo);
          throw new Error('Designation is required (Marque/Modèle missing?)');
        }
        if (!productData.codeInterne) {
          // Generate generic code if missing
          productData.codeInterne = 'IMP-' + Date.now() + '-' + index;
        }
        if (!productData.codeBarres) {
          productData.codeBarres = productData.codeInterne;
        }

        // Check for existence primarily by codeInterne or codeBarres (scoped to warehouse)
        const existingProduct = await this.prisma.product.findFirst({
          where: {
            entrepotId: warehouseId,
            OR: [
              { codeInterne: productData.codeInterne },
              { codeBarres: productData.codeBarres },
            ],
          },
        });

        if (existingProduct) {
          // Smart Update Logic
          const updates: any = {};
          let hasUpdates = false;

          for (const [key, value] of Object.entries(productData)) {
            // Skip system fields
            if (
              [
                'entrepotId',
                'utilisateurCreation',
                'createdAt',
                'updatedAt',
              ].includes(key)
            )
              continue;

            // If existing field is null/empty AND new value is present -> Update it
            const existingValue = (existingProduct as any)[key];
            if (
              existingValue == null ||
              existingValue === '' ||
              existingValue === 0
            ) {
              if (value != null && value !== '' && value !== 0) {
                updates[key] = value;
                hasUpdates = true;
              }
            }
          }

          if (hasUpdates) {
            await this.prisma.product.update({
              where: { id: existingProduct.id },
              data: updates,
            });
            results.updated++;
            results.success++; // Count update as success
          } else {
            results.success++; // Duplicate is a success
            this.logToFile(
              `Product Row ${index + 1}: Informative - Duplicate found.Counting as success.`,
            );
          }
        } else {
          // Start Create
          await this.prisma.product.create({
            data: productData,
          });
          results.success++;
        }
      } catch (error) {
        results.failed++;

        // Debug log for Prisma errors
        console.error('❌ Prisma Import Error:', {
          row: index + 1,
          error: error.message,
          code: error.code,
          productData, // <--- CRITICAL: See what we tried to save
        });

        // Write to debug file for inspection
        require('fs').writeFileSync(
          'debug_import_fail_row.json',
          JSON.stringify(
            {
              row: index + 1,
              productData,
              error: error.message,
            },
            null,
            2,
          ),
        );

        if (error.code === 'P2002') {
          // Unique constraint violation -> Duplicate -> Skip
          results.skipped++;
          // Optional: Log duplicate skipping
          // console.warn(`Duplicate skipped: ${ error.meta?.target?.join(', ') } `);
        } else {
          results.failed++;
          // ... (existing logging code) ...

          // Extract meaningful error message
          let errorMsg = error.message;
          if (error.code === 'P2003') {
            errorMsg = `Invalid reference: ${error.meta?.field_name || 'foreign key constraint'} `;
          } else if (error.message.includes('Argument')) {
            // ...
            const match = error.message.match(/Argument `(\w +)`/);
            if (match) {
              errorMsg = `Missing or invalid field: ${match[1]} `;
            }
          }
          results.errors.push(`Row ${index + 1}: ${errorMsg} `);
        }
      }
    }

    return results;
  }

  async importFournisseurs(data: any[], mapping: any) {
    const results = {
      success: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      errors: [] as string[],
    };
    for (let index = 0; index < data.length; index++) {
      const row = data[index];
      try {
        const nom = row[mapping.nom] ? String(row[mapping.nom]).trim() : null;
        if (!nom) {
          results.skipped++;
          results.errors.push(`Row ${index + 1}: Missing supplier name`);
          continue;
        }
        const code = row[mapping.code];
        let existingFournisseur: any = null;
        // Check if supplier exists by name (Fournisseur model doesn't have a code field)
        existingFournisseur = await this.prisma.fournisseur.findFirst({
          where: { nom },
        });
        const fournisseurData = {
          nom,
          contact: row[mapping.contact]
            ? String(row[mapping.contact]).trim()
            : null,
          email: row[mapping.email] ? String(row[mapping.email]).trim() : null,
          telephone: row[mapping.telephone]
            ? String(row[mapping.telephone]).trim()
            : null,
          adresse: row[mapping.adresse]
            ? String(row[mapping.adresse]).trim()
            : null,
          ville: row[mapping.ville] ? String(row[mapping.ville]).trim() : null,
          siteWeb: row[mapping.siteWeb]
            ? String(row[mapping.siteWeb]).trim()
            : null,
          ice: row[mapping.ice] ? String(row[mapping.ice]).trim() : null,
          rc: row[mapping.rc] ? String(row[mapping.rc]).trim() : null,
          identifiantFiscal: row[mapping.identifiantFiscal]
            ? String(row[mapping.identifiantFiscal]).trim()
            : null,
          patente: row[mapping.patente]
            ? String(row[mapping.patente]).trim()
            : null,
          cnss: row[mapping.cnss] ? String(row[mapping.cnss]).trim() : null,
          rib: row[mapping.rib] ? String(row[mapping.rib]).trim() : null,
          banque: row[mapping.banque]
            ? String(row[mapping.banque]).trim()
            : null,
          conditionsPaiement: row[mapping.conditionsPaiement]
            ? String(row[mapping.conditionsPaiement]).trim()
            : null,
        };
        if (existingFournisseur) {
          await this.prisma.fournisseur.update({
            where: { id: existingFournisseur.id },
            data: fournisseurData as any,
          });
          results.updated++;
        } else {
          await this.prisma.fournisseur.create({
            data: fournisseurData as any,
          });
          results.success++;
        }
      } catch (error) {
        results.failed++;
        results.errors.push(`Row ${index + 1}: ${error.message} `);
      }
    }
    return results;
  }

  async importFacturesFournisseurs(
    data: any[],
    mapping: any,
    centreId?: string,
    isBLOverride?: any,
  ) {
    // --- OPTIMIZATION: Pre-fetch Suppliers and Clients ---
    const [allSuppliers, allClients] = await Promise.all([
      this.prisma.fournisseur.findMany(),
      this.prisma.client.findMany({ select: { id: true, codeClient: true, nom: true, telephone: true } }),
    ]);

    const supplierMap = new Map<string, any>();
    allSuppliers.forEach((s: any) => {
      if (s.nom) supplierMap.set(s.nom.toUpperCase(), s);
      if (s.ice) supplierMap.set(s.ice.toUpperCase(), s);
    });

    const clientCodeMap = new Map<string, string>();
    const clientIdentityMap = new Map<string, string>();
    allClients.forEach((c) => {
      if (c.codeClient) clientCodeMap.set(c.codeClient.trim(), c.id);
      const nom = c.nom ? c.nom.trim().toUpperCase() : 'INCONNU';
      clientIdentityMap.set(`${nom}|${c.telephone?.trim()}`, c.id);
    });

    const results = { success: 0, updated: 0, skipped: 0, failed: 0, errors: [] as string[] };

    let lastSupplier: any = null;
    let lastDateEmission: Date | null = null;
    let lastNum: string | null = null;
    let lastRef: string | null = null;
    let lastIsBL = false;
    const sessionNumMap = new Map<string, number>(); // Tracking duplicates per supplier: "supplierId|invoiceNum" -> count

    // No longer tracking session invoices for merging as per user request (strict 1:1)

    // --- DIAGNOSTIC: Log session start with UNIQUE ID ---
    console.log(`[IMPORT-FF-STRICT-1:1] STARTING BATCH AT ${new Date().toISOString()}`);
    console.log(`[IMPORT-FF-STRICT-1:1] Current results.updated: ${results.updated}`);
    // --- END DIAGNOSTIC ---

    // --- ORIGINAL DIAGNOSTICS ---
    console.log(`[IMPORT-FF] Starting import of ${data.length} rows`);
    console.log('[IMPORT-FF] Mapping received:', JSON.stringify(mapping));
    if (data.length > 0) {
      console.log('[IMPORT-FF] First row preview:', JSON.stringify(data[0]).slice(0, 500));
    }
    // --- END DIAGNOSTIC ---

    for (let index = 0; index < data.length; index++) {
      if (index % 100 === 0) {
        console.log(`[IMPORT-FF] Processing row ${index}... Current results: ${JSON.stringify(results)}`);
      }
      const row = data[index];
      try {
        let nomFournisseur = row[mapping.nomFournisseur] || row[mapping.fournisseur] || row[mapping.nom];
        let codeFournisseur = row[mapping.codeFournisseur];

        // Only use columns specifically mapped to invoice number/facture for the primary ID.
        // nPiece should be referenceInterne, not the primary invoice number.
        let numeroFacture = this.normalizeInvoiceNum(
          row[mapping.numeroFacture] ||
          row[mapping.facture]
        );

        let referenceInterne = row[mapping.referenceInterne] || row[mapping.facture] || (numeroFacture || '');
        let dateEmissionInput = row[mapping.dateEmission];

        if (this.isRowEmpty(row, mapping)) {
          console.log(`[IMPORT-FF] Row ${index} skipped: EMPTY`);
          results.skipped++;
          continue;
        }

        // Only skip header if it truly looks like one and it's at the very top (index 0)
        // For index 1 and 2, we only skip if it also lacks an invoice number AND supplier info
        if (this.isHeaderRow(row, mapping, index)) {
          if (index === 0 || (!numeroFacture && !nomFournisseur && !codeFournisseur)) {
            console.log(`[IMPORT-FF] Row ${index} skipped: HEADER DETECTED`);
            results.skipped++;
            continue;
          }
        }

        let supplier: any = null;
        if (codeFournisseur || nomFournisseur) {
          supplier = supplierMap.get(String(codeFournisseur || '').toUpperCase()) ||
            supplierMap.get(String(nomFournisseur || '').toUpperCase());
          if (!supplier) {
            supplier = await this.findOrCreateFournisseur((nomFournisseur || codeFournisseur) as string, index);
            if (supplier) supplierMap.set(supplier.nom.toUpperCase(), supplier);
          }
        }

        // Use carry-over ONLY if this row is truly missing supplier info
        if (!supplier && !nomFournisseur && !codeFournisseur && lastSupplier) {
          supplier = lastSupplier;
        }

        // Final fallback to prevent global failure
        if (!supplier) {
          supplier = await this.findOrCreateFournisseur('FOURNISSEUR INCONNU', index);
          if (supplier) supplierMap.set(supplier.nom.toUpperCase(), supplier);
        }

        if (!supplier) {
          console.log(`[IMPORT-FF] Row ${index} failed: NO SUPPLIER FOUND`);
          results.failed++;
          results.errors.push(`Row ${index + 1}: Supplier not found`);
          continue;
        }

        // --- NO CARRY-OVER FOR INVOICE NUMBERS ---
        // As per user request: empty invoice number MUST be a standalone expense.
        // We do not carry over the number from the previous row anymore.

        const dateEmission = this.parseDate(dateEmissionInput) || (numeroFacture === lastNum ? lastDateEmission : null) || new Date();
        const dateEcheance = this.parseDate(row[mapping.dateEcheance]);
        const montantHT = this.parseAmount(row[mapping.montantHT]);
        const montantTVA = this.parseAmount(row[mapping.montantTVA]);
        let montantTTC = this.parseAmount(row[mapping.montantTTC]);
        if (!montantTTC && (montantHT || montantTVA)) montantTTC = (montantHT || 0) + (montantTVA || 0);

        let isBL = false;
        if (isBLOverride !== undefined && isBLOverride !== null) {
          isBL = isBLOverride === true || isBLOverride === 'true' || isBLOverride === 1;
        } else {
          const blVal = row[mapping.isBL];
          if (blVal !== undefined) {
            isBL = blVal === true || blVal === 'true' || blVal === 1 || String(blVal).toUpperCase() === 'BL';
          } else if (numeroFacture === lastNum) {
            isBL = lastIsBL;
          }
        }

        // Update context for next row
        lastSupplier = supplier;
        lastDateEmission = dateEmission;
        lastNum = numeroFacture;
        lastRef = referenceInterne || lastRef;
        lastIsBL = isBL;

        // If it's a BL import, we MUST use FactureFournisseur table even if numeroFacture is missing.
        // We will fallback to referenceInterne or a generated ID to satisfy the unique constraint.
        if (!numeroFacture && isBL) {
          numeroFacture = referenceInterne || `BL-AUTO-${index}-${new Date().getTime()}`;
          console.log(`[IMPORT-FF] Row ${index}: Missing numeroFacture for BL. Using fallback: ${numeroFacture}`);
        }

        if (!numeroFacture) {
          if (centreId && montantTTC > 0) {
            // Create new standalone expense (No more checking existingDepense for 1:1 mapping)
            const echeance = await this.prisma.echeancePaiement.create({
              data: {
                montant: montantTTC,
                dateEcheance: dateEmission,
                type: row[mapping.modePaiement] || 'ESPECES',
                statut: 'EN_ATTENTE',
              }
            });

            await (this.prisma.depense as any).create({
              data: {
                date: dateEmission,
                montant: montantTTC,
                categorie: this.inferExpenseCategory(referenceInterne || supplier.nom),
                description: `Achat sans facture (Fournisseur: ${supplier.nom})`,
                modePaiement: row[mapping.modePaiement] || 'ESPECES',
                statut: 'A_PAYER',
                fournisseurId: supplier.id,
                centreId: (centreId as any) || null,
                echeanceId: echeance.id,
              }
            });
            results.success++;
          } else {
            console.log(`[IMPORT-FF] Row ${index} skipped: missing both invoice number and valid amount.`);
            results.skipped++;
          }
          continue;
        }


        // --- UNIQUE CONSTRAINT WORKAROUND (1:1 MAPPING - v2) ---
        // Every row MUST be a separate record. If the number exists in DB, add suffix.
        let finalNum = numeroFacture;
        let dupIndex = 1;
        while (true) {
          const exists = isBL
            ? await this.prisma.bonLivraison.findUnique({
              where: {
                fournisseurId_numeroBL: {
                  fournisseurId: supplier.id,
                  numeroBL: finalNum,
                },
              },
            })
            : await this.prisma.factureFournisseur.findUnique({
              where: {
                fournisseurId_numeroFacture: {
                  fournisseurId: supplier.id,
                  numeroFacture: finalNum,
                },
              },
            });
          if (!exists) break;
          finalNum = `${numeroFacture}_${dupIndex++}`;
        }
        if (finalNum !== numeroFacture) {
          console.log(`[STRICT-1:1-v2] Adjusted duplicate: ${numeroFacture} -> ${finalNum} (Supplier: ${supplier.id})`);
        }
        numeroFacture = finalNum;

        // --- NO GROUPING LOGIC ---
        // User requested that every single line is a distinct record.
        // We skip all session-based and DB-level merging.
        {
          // --- NO MERGING ---
          // Every row creates a new record.
          const dbExisting = null;

          // Client & Fiche linking
          let clientId: string | null = null;
          let ficheId: string | null = null;

          // 1. Direct Fiche Linking (Most accurate)
          const fNumInput = row[mapping.ficheNumero];
          if (fNumInput) {
            const fNumParsed = parseInt(String(fNumInput).replace(/\D/g, ''));
            if (!isNaN(fNumParsed)) {
              const fiche = await this.prisma.fiche.findFirst({
                where: { numero: fNumParsed },
                include: { client: true }
              });
              const f = (fiche as any);
              if (f && f.client) {
                ficheId = f.id;
                clientId = f.clientId;
              }
            }
          }

          // 2. Client ID/Code Linking (Fallback for BLs)
          // The user confirmed the 'client' column is the unique ID
          if (!clientId) {
            const clientInput = row[mapping.client] || row[mapping.nomClient];
            if (clientInput) {
              const client = await this.prisma.client.findFirst({
                where: {
                  OR: [
                    { id: String(clientInput) },
                    { codeClient: String(clientInput) },
                    { nom: { contains: String(clientInput), mode: 'insensitive' } }
                  ]
                }
              });
              if (client) {
                const c = client as any;
                clientId = c.id;
                // Find the Fiche with the CLOSEST dateCreation to BL dateEmission
                const clientFiches = await this.prisma.fiche.findMany({
                  where: { clientId: c.id }
                });

                if (c && clientFiches.length > 0) {
                  const c = (client as any);
                  let closestFiche = clientFiches[0];
                  let minDiff = Math.abs(new Date(clientFiches[0].dateCreation).getTime() - dateEmission.getTime());

                  for (const f of (clientFiches as any[])) {
                    const diff = Math.abs(new Date(f.dateCreation).getTime() - dateEmission.getTime());
                    if (diff < minDiff) {
                      minDiff = diff;
                      closestFiche = f;
                    }
                  }
                  ficheId = closestFiche.id;
                }
              }
            }
          }

          if (!clientId) {
            const cCode = row[mapping.codeClient];
            const cNom = row[mapping.nomClient] || row[mapping.nom];
            const cTel = row[mapping.telephoneClient] || row[mapping.telephone];

            if (cCode) clientId = clientCodeMap.get(String(cCode).trim()) || null;
            if (!clientId && cNom && cTel) clientId = clientIdentityMap.get(`${String(cNom).trim().toUpperCase()}|${String(cTel).trim()}`) || null;

            if (clientId && !ficheId) {
              const bestFiche: any = await this.prisma.fiche.findFirst({
                where: { clientId: clientId ?? undefined, dateCreation: { lte: dateEmission } },
                orderBy: { dateCreation: 'desc' },
              });
              if (bestFiche) {
                ficheId = (bestFiche as any).id;
              }
            }
          }

          // Redirect creation to the correct table
          if (isBL) {
            const record = await this.prisma.bonLivraison.create({
              data: {
                numeroBL: numeroFacture,
                dateEmission,
                dateEcheance,
                montantHT: montantHT || 0,
                montantTVA: montantTVA || 0,
                montantTTC: montantTTC || 0,
                statut: 'VALIDEE',
                type: row[mapping.type] || 'ACHAT_STOCK',
                fournisseurId: supplier.id,
                centreId: centreId || null,
                clientId,
                ficheId,
                categorieBL: row[mapping.categorieBL] || null,
              },
            });

            await this.prisma.echeancePaiement.create({
              data: {
                bonLivraisonId: record.id,
                montant: montantTTC || 0,
                dateEcheance: dateEcheance || dateEmission,
                type: row[mapping.modePaiement] || 'ESPECES',
                statut: 'EN_ATTENTE',
              },
            });
          } else {
            const record = await this.prisma.factureFournisseur.create({
              data: {
                numeroFacture,
                dateEmission,
                dateEcheance,
                montantHT: montantHT || 0,
                montantTVA: montantTVA || 0,
                montantTTC: montantTTC || 0,
                quantite: this.parseAmount(row[mapping.quantite]),
                statut: 'A_PAYER',
                type: row[mapping.type] || 'ACHAT_STOCK',
                fournisseurId: supplier.id,
                centreId: centreId || null,
                referenceInterne,
                clientId,
                ficheId,
              } as any,
            });

            await this.prisma.echeancePaiement.create({
              data: {
                factureFournisseurId: record.id,
                montant: montantTTC || 0,
                dateEcheance: dateEcheance || dateEmission,
                type: row[mapping.modePaiement] || 'ESPECES',
                statut: 'EN_ATTENTE',
              },
            });
          }
          results.success++;

        }
      } catch (error) {
        results.failed++;
        results.errors.push(`Row ${index + 1}: ${error.message}`);
      }
    }
    return results;
  }

  async importPaiementsFournisseurs(data: any[], mapping: any) {
    const [allSuppliers] = await Promise.all([this.prisma.fournisseur.findMany()]);
    const supplierMap = new Map<string, any>();
    allSuppliers.forEach((s: any) => {
      if (s.nom) supplierMap.set(s.nom.toUpperCase(), s);
      if (s.ice) supplierMap.set(s.ice.toUpperCase(), s);
    });

    const results = { success: 0, updated: 0, skipped: 0, failed: 0, errors: [] as string[] };

    for (let index = 0; index < data.length; index++) {
      const row = data[index];
      try {
        if (this.isRowEmpty(row, mapping) || this.isHeaderRow(row, mapping, index)) continue;

        const nomFournisseur = row[mapping.nomFournisseur] || row[mapping.fournisseur] || row[mapping.nom];
        const codeFournisseur = row[mapping.codeFournisseur];
        const numeroFacture = this.normalizeInvoiceNum(row[mapping.numeroFacture] || row[mapping.npiece] || row[mapping.facture]);
        const referenceReglement = row[mapping.reference];
        const dateReglement = this.parseDate(row[mapping.datePaiement]) || new Date();
        const montant = this.parseAmount(row[mapping.montant] || row[mapping.montantTTC]);

        if (montant === 0) continue;

        let supplier = supplierMap.get(String(codeFournisseur || '').toUpperCase()) ||
          supplierMap.get(String(nomFournisseur || '').toUpperCase());
        if (!supplier) {
          supplier = await this.findOrCreateFournisseur((nomFournisseur || codeFournisseur || 'FOURNISSEUR_INCONNU') as string, index);
          if (supplier) supplierMap.set(supplier.nom.toUpperCase(), supplier);
        }

        if (!supplier) {
          results.failed++;
          results.errors.push(`Row ${index + 1}: Supplier not found`);
          continue;
        }

        // Find invoice to link with robust matching
        // Find invoice or expense to link
        let facture;
        let depense;

        let bl;
        if (numeroFacture && numeroFacture.length > 0) {
          // STRICT-1:1-v2 RECONCILIATION:
          // Search for EXACT match OR any version with suffix (e.g. "FA-100_1") 
          // created by the strict 1:1 import logic.
          facture = await this.prisma.factureFournisseur.findFirst({
            where: {
              fournisseurId: supplier.id,
              OR: [
                { numeroFacture: { equals: numeroFacture, mode: 'insensitive' } },
                { numeroFacture: { startsWith: numeroFacture + '_', mode: 'insensitive' } },
                { referenceInterne: { equals: numeroFacture, mode: 'insensitive' } },
                { referenceInterne: { startsWith: `AUTO-CREATED (nPiece: ${numeroFacture}`, mode: 'insensitive' } },
              ],
            },
            // CRITICAL: Prioritize invoices that still have pending installments
            orderBy: {
              statut: 'asc', // 'A_PAYER' or 'PARTIELLE' come before 'PAYEE'
            },
          });

          if (!facture) {
            bl = await this.prisma.bonLivraison.findFirst({
              where: {
                fournisseurId: supplier.id,
                OR: [
                  { numeroBL: { equals: numeroFacture, mode: 'insensitive' } },
                  { numeroBL: { startsWith: numeroFacture + '_', mode: 'insensitive' } },
                ],
              },
              orderBy: {
                statut: 'asc',
              },
            });
          }
        }

        // Fallback: match by exact amount among unpaid invoices if still not found
        if (!facture && montant > 0) {
          facture = await this.prisma.factureFournisseur.findFirst({
            where: {
              fournisseurId: supplier.id,
              montantTTC: montant,
              statut: { in: ['A_PAYER', 'PARTIELLE'] }
            },
            orderBy: { dateEmission: 'asc' }
          });
        }

        // Fallback: match by exact amount among unpaid expenses (Dépenses)
        if (!facture && montant > 0) {
          depense = await this.prisma.depense.findFirst({
            where: {
              fournisseurId: supplier.id,
              montant: montant,
              statut: { in: ['A_PAYER', 'NON_PAYEE', 'PARTIELLE'] }
            }
          });
        }

        const safeRef = referenceReglement && String(referenceReglement).trim().length > 0 ? String(referenceReglement).trim() : null;

        if (!facture && !bl && !depense) {
          if (numeroFacture) {
            // Create a fallback Invoice to allow multiple installments for the same nPiece (Facture)
            facture = await this.prisma.factureFournisseur.create({
              data: {
                numeroFacture,
                dateEmission: dateReglement,
                montantHT: 0,
                montantTVA: 0,
                montantTTC: montant,
                statut: 'PAYEE',
                fournisseurId: supplier.id,
                type: 'ACHAT_STOCK',
                centreId: supplier.centreId || (await this.getDefaultCentreId()),
                referenceInterne: `AUTO-CREATED (nPiece: ${numeroFacture})`,
              },
            });
            // Create the corresponding payment record
            await this.prisma.echeancePaiement.create({
              data: {
                factureFournisseurId: facture ? facture.id : undefined,
                bonLivraisonId: bl ? bl.id : undefined,
                montant,
                dateEncaissement: dateReglement,
                dateEcheance: dateReglement,
                reference: safeRef,
                statut: 'PAYEE',
                type: row[mapping.modePaiement] || 'PAIEMENT',
                remarque: `AUTO-CREATED FROM UNMATCHED PAYMENT (nPiece: ${numeroFacture})`,
              }
            });
            results.success++;
            continue;
          } else {
            // No nPiece provided, use standalone Depense fallback
            const newEcheance = await this.prisma.echeancePaiement.create({
              data: {
                montant,
                dateEncaissement: dateReglement,
                dateEcheance: dateReglement,
                reference: safeRef,
                statut: 'PAYEE',
                type: row[mapping.modePaiement] || 'ESPECES',
                remarque: `AUTO-CREATED FROM UNMATCHED PAYMENT (Row ${index + 1})`,
              },
            });

            depense = await this.prisma.depense.create({
              data: {
                date: dateReglement,
                montant,
                categorie: 'AUTRE',
                description: `Paiement sans facture: ${safeRef || 'Sans Ref'}`,
                modePaiement: row[mapping.modePaiement] || 'ESPECES',
                statut: 'PAYEE',
                centreId: supplier.centreId || (await this.getDefaultCentreId()),
                fournisseurId: supplier.id,
                echeanceId: newEcheance.id,
              },
            });
            results.success++;
            continue;
          }
        }

        // Safe Idempotency check: Only skip if we find a payment for THIS invoice with BOTH same amount/date AND same reference (if provided)
        const idempotencyWhere: any = {
          montant,
          dateEncaissement: dateReglement,
          statut: { in: ['PAYEE', 'ENCAISSE'] as any[] }
        };
        if (facture) idempotencyWhere.factureFournisseurId = facture.id;
        if (depense && depense.echeanceId) idempotencyWhere.id = depense.echeanceId;

        // If reference is provided, use it for strict deduplication
        if (safeRef) {
          idempotencyWhere.reference = safeRef;
          const existing = await this.prisma.echeancePaiement.findFirst({ where: idempotencyWhere });
          if (existing) {
            results.skipped++;
            continue;
          }
        } else {
          // If no reference, we allow multiple identical payments to be safe (legit multi-payments on same day)
          // UNLESS the user is re-running the exact same import, but we lack row-level tracking.
          // To prevent infinite duplicates, we check if EXACTLY such a payment exists (most likely already imported)
          const existing = await this.prisma.echeancePaiement.findFirst({ where: idempotencyWhere });
          if (existing) {
            // If it's a second run, we might want to skip, but how to distinguish from legit second payment?
            // For now, let's skip to avoid obvious duplicates on re-import.
            results.skipped++;
            continue;
          }
        }

        let echeanceIdToUpdate: string | null = null;

        if (facture) {
          // Reconcile with the placeholder EcheancePaiement created by importFacturesFournisseurs
          const pending = await this.prisma.echeancePaiement.findFirst({
            where: { factureFournisseurId: facture.id, statut: 'EN_ATTENTE' },
            orderBy: { dateEcheance: 'asc' }
          });

          if (pending) {
            echeanceIdToUpdate = pending.id;
          } else {
            // Secondary installment (Existing invoice already has a paid schedule)
            // CRITICAL: Idempotency check for additional payments
            const existingAdd = await this.prisma.echeancePaiement.findFirst({
              where: {
                factureFournisseurId: facture.id,
                montant,
                dateEncaissement: dateReglement,
                statut: { in: ['PAYEE', 'ENCAISSE'] as any[] },
                reference: safeRef
              }
            });

            if (existingAdd) {
              results.skipped++;
              continue;
            }

            await this.prisma.echeancePaiement.create({
              data: {
                factureFournisseurId: facture.id,
                montant,
                dateEncaissement: dateReglement,
                dateEcheance: dateReglement,
                reference: safeRef,
                statut: 'PAYEE',
                type: row[mapping.modePaiement] || 'PAIEMENT',
                remarque: `ADDITIONAL PAYMENT (nPiece: ${numeroFacture})`
              }
            });
          }
        } else if (depense) {
          // Reconcile with the expense's placeholder EcheancePaiement
          echeanceIdToUpdate = depense.echeanceId;
        }

        if (echeanceIdToUpdate) {
          await this.prisma.echeancePaiement.update({
            where: { id: echeanceIdToUpdate },
            data: {
              montant,
              dateEncaissement: dateReglement,
              reference: safeRef,
              statut: 'PAYEE',
              type: row[mapping.modePaiement] || 'PAIEMENT'
            }
          });
        }

        // Update Invoice/Expense status
        if (facture) {
          const agg = await this.prisma.echeancePaiement.aggregate({
            where: { factureFournisseurId: facture.id, statut: 'PAYEE' },
            _sum: { montant: true }
          });
          const paid = agg._sum.montant || 0;

          // Auto-adjust total for auto-created invoices to avoid "Overpaid" warnings
          const isAutoCreated = facture.referenceInterne?.includes('AUTO-CREATED');
          const targetTotal = isAutoCreated ? Math.max(facture.montantTTC, paid) : facture.montantTTC;

          await this.prisma.factureFournisseur.update({
            where: { id: facture.id },
            data: {
              statut: paid >= targetTotal ? 'PAYEE' : 'PARTIELLE',
              montantTTC: isAutoCreated ? targetTotal : undefined
            }
          });
        } else if (depense) {
          await this.prisma.depense.update({
            where: { id: depense.id },
            data: { statut: 'PAYEE' }
          });
        }

        results.success++;
      } catch (error) {
        results.failed++;
        results.errors.push(`Row ${index + 1}: ${error.message}`);
      }
    }
    return results;
  }


  async importFacturesVentes(data: any[], mapping: any, centreId?: string) {
    const results = {
      success: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      errors: [] as string[],
    };
    for (let index = 0; index < data.length; index++) {
      const row = data[index];
      try {
        const codeClient = row[mapping.codeClient]
          ? String(row[mapping.codeClient]).trim()
          : null;
        const nomClient = row[mapping.nomClient]
          ? String(row[mapping.nomClient]).trim()
          : null;

        if (
          this.isRowEmpty(row, mapping) ||
          (index === 0 && this.isHeaderRow(row, mapping, index))
        ) {
          results.skipped++;
          continue;
        }

        if (!codeClient && !nomClient) {
          const hasAmount = !!row[mapping.totalTTC];
          if (!hasAmount) {
            results.skipped++;
            continue;
          }
          results.skipped++;
          results.errors.push(`Row ${index + 1}: Missing client code or name`);
          continue;
        }
        let client: any = null;
        if (codeClient)
          client = await this.prisma.client.findFirst({
            where: { codeClient },
          });
        if (!client && nomClient)
          client = await this.prisma.client.findFirst({
            where: { nom: nomClient },
          });
        if (!client) {
          results.skipped++;
          results.errors.push(`Row ${index + 1}: Client not found`);
          continue;
        }
        let typeRaw = row[mapping.type];
        if (typeof typeRaw === 'boolean')
          typeRaw = typeRaw ? 'FACTURE' : 'DEVIS'; // Handle weird booleans
        const type = String(typeRaw || 'FACTURE')
          .trim()
          .toUpperCase();

        let statutRaw = row[mapping.statut];
        if (typeof statutRaw === 'boolean')
          statutRaw = statutRaw ? 'VALIDEE' : 'BROUILLON';
        const statut = String(statutRaw || 'BROUILLON')
          .trim()
          .toUpperCase();
        const dateEmission =
          this.parseDate(row[mapping.dateEmission]) || new Date();
        const dateEcheance = this.parseDate(row[mapping.dateEcheance]);
        const totalHT = parseFloat(row[mapping.totalHT]) || 0;
        const totalTVA = parseFloat(row[mapping.totalTVA]) || 0;

        // PRIORITY: Trust totalTTC from Excel. If it matches 9.4M while HT+TVA(20%) matches 10.6M, 
        // using totalTTC directly preserves the user's expected turnover.
        let totalTTC = parseFloat(row[mapping.totalTTC]);
        if (isNaN(totalTTC)) {
          totalTTC = totalHT + totalTVA;
        }
        let numero = row[mapping.numero];
        if (!numero) {
          const prefix =
            type === 'DEVIS' ? 'DEV' : type === 'BON_COMMANDE' ? 'BC' : 'FAC';
          const count = await this.prisma.facture.count({ where: { type } });
          numero = `${prefix} -${(count + 1).toString().padStart(6, '0')} `;
        }

        let ficheId: string | null = null;
        const ficheNumStr = row[mapping.fiche] || row['Fiche'];
        if (ficheNumStr) {
          // ROBUST PARSING: "98/2015" -> 98
          const parts = String(ficheNumStr)
            .split(/[^0-9]/)
            .filter((p) => p.length > 0);
          if (parts.length > 0) {
            const ficheNum = parseInt(parts[0]);
            if (!isNaN(ficheNum)) {
              const fiche = await this.prisma.fiche.findFirst({
                where: { numero: ficheNum },
                include: { facture: true },
              });
              if (fiche) {
                ficheId = fiche.id;
                // If the fiche already has an invoice (e.g. from Fiche Import), reuse it
                if (fiche.facture) {
                  const alreadyPaid =
                    fiche.facture.totalTTC - fiche.facture.resteAPayer;

                  // Check if the generated numero is already used by a DIFFERENT facture
                  // to avoid unique constraint violation on update
                  const numeroConflict =
                    fiche.facture.numero !== numero
                      ? await this.prisma.facture.findFirst({
                        where: { numero, NOT: { id: fiche.facture.id } },
                      })
                      : null;

                  await this.prisma.facture.update({
                    where: { id: fiche.facture.id },
                    data: {
                      // Only update numero if it won't cause a conflict
                      ...(numeroConflict ? {} : { numero }),
                      type,
                      dateEmission,
                      dateEcheance,
                      statut,
                      totalHT,
                      totalTVA,
                      totalTTC,
                      resteAPayer: Math.max(0, totalTTC - alreadyPaid),
                      centreId: centreId || null,
                    },
                  });
                  results.updated++;
                  continue;
                }
              }
            }
          }
        }

        const factureData = {
          numero,
          type,
          dateEmission,
          dateEcheance,
          statut,
          clientId: client.id,
          ficheId,
          totalHT,
          totalTVA,
          totalTTC,
          resteAPayer: totalTTC,
          lignes: [],
          centreId: centreId || null,
        };

        // MATCHING LOGIC: Be prefix-agnostic
        const existingFacture = await this.prisma.facture.findFirst({
          where: {
            OR: [
              { numero: numero },
              { numero: `FAC-${numero}` },
              { numero: numero.replace(/^FAC-/, '') },
            ],
          },
        });

        if (existingFacture) {
          // Update maintaining paid balance if it had any
          const alreadyPaid =
            existingFacture.totalTTC - existingFacture.resteAPayer;
          await this.prisma.facture.update({
            where: { id: existingFacture.id },
            data: {
              ...factureData,
              resteAPayer: Math.max(0, totalTTC - alreadyPaid),
            } as any,
          });
          results.updated++;
        } else {
          await this.prisma.facture.create({ data: factureData as any });
          results.success++;
        }
      } catch (error) {
        results.failed++;
        results.errors.push(`Row ${index + 1}: ${error.message} `);
      }
    }
    return results;
  }

  async importPaiementsClients(data: any[], mapping: any) {
    console.log('[ImportLog] PaiementsClients — OPTIMIZED BULK MODE');
    console.log(`[ImportLog] Total rows to process: ${data.length}`);

    const results = {
      success: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      errors: [] as string[],
    };

    try {
      // ════════════════════════════════════════════════
      // PHASE 1: BULK PRE-LOAD — 3 DB queries total
      // instead of N x 5 queries (N = 16182)
      // ════════════════════════════════════════════════
      console.log('[ImportLog] Phase 1: Pre-loading all fiches, factures, clients...');
      const t0 = Date.now();

      const [allFiches, allFactures, allClients] = await Promise.all([
        this.prisma.fiche.findMany({
          select: { id: true, numero: true, clientId: true, facture: { select: { id: true } } },
        }),
        this.prisma.facture.findMany({
          select: { id: true, ficheId: true, clientId: true, totalTTC: true, resteAPayer: true, type: true, statut: true, numero: true },
        }),
        this.prisma.client.findMany({
          select: { id: true, codeClient: true, nom: true, telephone: true },
        }),
      ]);

      // Build lookup Maps
      const ficheByNumero = new Map<number, any>();
      for (const f of allFiches) ficheByNumero.set(f.numero, f);

      const factureByFicheId = new Map<string, any>();
      const factureByNumero = new Map<string, any>();
      for (const f of allFactures) {
        if (f.ficheId) factureByFicheId.set(f.ficheId, f);
        if (f.numero) factureByNumero.set(f.numero.trim(), f);
      }

      const clientByCode = new Map<string, any>();
      const clientByNomLower = new Map<string, any>();
      for (const c of allClients) {
        if (c.codeClient) clientByCode.set(c.codeClient.trim(), c);
        if (c.nom) clientByNomLower.set(c.nom.toLowerCase().trim(), c);
      }

      console.log(`[ImportLog] Pre-load done in ${Date.now() - t0}ms. Fiches: ${allFiches.length}, Factures: ${allFactures.length}, Clients: ${allClients.length}`);

      // ════════════════════════════════════════════════
      // PHASE 2: PROCESS ROWS IN MEMORY — no DB queries
      // ════════════════════════════════════════════════
      console.log('[ImportLog] Phase 2: Processing rows in memory...');

      const paymentsToCreate: any[] = [];
      const factureUpdates = new Map<string, { totalPaid: number; totalTTC: number; type: string }>();

      for (let index = 0; index < data.length; index++) {
        const row = data[index];

        if (this.isRowEmpty(row, mapping) || (index === 0 && this.isHeaderRow(row, mapping, index))) {
          results.skipped++;
          continue;
        }

        const ficheNumeroRaw = row[mapping.fiche] || row['Fiche'];
        const codeClient = row[mapping.codeClient] ? String(row[mapping.codeClient]).trim() : null;
        const nomClientRaw = row[mapping.nomClient] ? String(row[mapping.nomClient]).trim() : null;
        const numeroFactureRaw = row[mapping.numeroFacture] ? String(row[mapping.numeroFacture]).trim() : null;

        let fiche: any = null;
        let facture: any = null;
        let client: any = null;

        // --- Resolve Fiche ---
        if (ficheNumeroRaw) {
          const ficheNum = parseInt(String(ficheNumeroRaw).replace(/[^0-9]/g, ''));
          if (!isNaN(ficheNum)) fiche = ficheByNumero.get(ficheNum) || null;
        }

        // --- Resolve Facture ---
        if (fiche?.facture?.id) {
          facture = factureByFicheId.get(fiche.id) || null;
        }
        if (!facture && numeroFactureRaw) {
          facture = factureByNumero.get(numeroFactureRaw) || null;
        }

        // --- Resolve Client ---
        if (fiche?.clientId) {
          client = allClients.find(c => c.id === fiche.clientId) || null;
        }
        if (!client && codeClient) {
          client = clientByCode.get(codeClient) || null;
        }
        if (!client && nomClientRaw) {
          client = clientByNomLower.get(nomClientRaw.toLowerCase()) || null;
        }

        if (!client) {
          results.skipped++;
          results.errors.push(`Row ${index + 1}: Client non trouvé (code: ${codeClient}, nom: ${nomClientRaw})`);
          continue;
        }

        if (!facture) {
          results.skipped++;
          results.errors.push(`Row ${index + 1}: Facture non trouvée pour client ${client.nom} (Fiche: ${ficheNumeroRaw}, Num: ${numeroFactureRaw})`);
          continue;
        }

        const montant = Math.abs(parseFloat(row[mapping.montant]) || 0);
        if (montant === 0) {
          results.skipped++;
          continue;
        }

        const datePaiement = this.parseDate(row[mapping.datePaiement]) || new Date();
        const modeSource = row[mapping.modePaiement] ? String(row[mapping.modePaiement]).trim().toUpperCase() : 'ESPECES';
        const reference = row[mapping.reference] ? String(row[mapping.reference]).substring(0, 100) : null;
        const notes = row[mapping.notes] ? String(row[mapping.notes]).substring(0, 500) : null;

        paymentsToCreate.push({
          factureId: facture.id,
          montant,
          date: datePaiement,
          mode: modeSource,
          reference,
          notes,
          statut: 'ENCAISSE',
        });

        // Accumulate payment totals per invoice for balance update
        if (!factureUpdates.has(facture.id)) {
          factureUpdates.set(facture.id, { totalPaid: 0, totalTTC: Number(facture.totalTTC || 0), type: facture.type });
        }
        factureUpdates.get(facture.id)!.totalPaid += montant;
        results.success++;
      }

      // ════════════════════════════════════════════════
      // PHASE 3: BULK INSERT payments (batches of 500)
      // ════════════════════════════════════════════════
      console.log(`[ImportLog] Phase 3: Bulk inserting ${paymentsToCreate.length} payments...`);
      const t1 = Date.now();
      const BATCH_SIZE = 500;

      for (let i = 0; i < paymentsToCreate.length; i += BATCH_SIZE) {
        const batch = paymentsToCreate.slice(i, i + BATCH_SIZE);
        await this.prisma.paiement.createMany({ data: batch, skipDuplicates: true });
        console.log(`[ImportLog] Inserted batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(paymentsToCreate.length / BATCH_SIZE)}`);
      }

      console.log(`[ImportLog] Bulk insert done in ${Date.now() - t1}ms`);

      // ════════════════════════════════════════════════
      // PHASE 4: BULK UPDATE invoice balances (batches)
      // ════════════════════════════════════════════════
      console.log(`[ImportLog] Phase 4: Updating ${factureUpdates.size} invoice balances...`);
      const t2 = Date.now();

      const updatePromises: Promise<any>[] = [];
      for (const [factureId, info] of factureUpdates) {
        const resteAPayer = Math.max(0, info.totalTTC - info.totalPaid);
        const statut = resteAPayer <= 0 ? 'PAYEE' : 'VALIDEE';
        const newType = info.type === 'DEVIS' ? 'BON_COMMANDE' : info.type;
        updatePromises.push(
          this.prisma.facture.update({
            where: { id: factureId },
            data: { resteAPayer, statut, ...(info.type === 'DEVIS' ? { type: newType } : {}) },
          })
        );
        // Run in batches to avoid overwhelming the connection pool
        if (updatePromises.length >= 100) {
          await Promise.all(updatePromises.splice(0, 100));
        }
      }
      if (updatePromises.length > 0) await Promise.all(updatePromises);

      console.log(`[ImportLog] Balance updates done in ${Date.now() - t2}ms`);
      console.log(`[ImportLog] TOTAL IMPORT TIME: ${Date.now() - t0}ms`);

    } catch (globalError) {
      console.error('CRITICAL IMPORT ERROR (PaiementsClients):', globalError);
      results.failed = data.length;
      results.errors.push(`Erreur Critique: ${globalError.message}`);
    }

    return results;
  }

  async importDepenses(data: any[], mapping: any, centreId?: string) {
    const results = {
      success: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      errors: [] as string[],
    };
    for (let index = 0; index < data.length; index++) {
      const row = data[index];
      try {
        if (this.isRowEmpty(row, mapping) || this.isHeaderRow(row, mapping, index)) {
          results.skipped++;
          continue;
        }

        const montant = this.parseAmount(row[mapping.montant]);
        const description = row[mapping.description]
          ? String(row[mapping.description]).trim()
          : '';
        const dateRaw = row[mapping.date];
        const hasDate = !!dateRaw && String(dateRaw).trim() !== '';
        const hasSupplier = !!row[mapping.fournisseur];

        if (!montant && !description && !hasDate && !hasSupplier) {
          results.skipped++;
          continue;
        }

        const date = this.parseDate(row[mapping.date]) || new Date();
        const categorie = row[mapping.categorie]
          ? String(row[mapping.categorie]).trim()
          : 'AUTRE_DEPENSE';
        const modePaiement = row[mapping.modePaiement]
          ? String(row[mapping.modePaiement]).trim()
          : 'ESPECES';
        const statut = row[mapping.statut]
          ? String(row[mapping.statut]).trim()
          : 'PAYEE';
        const fournisseurNom = row[mapping.fournisseur]
          ? String(row[mapping.fournisseur]).trim()
          : 'PERSONNEL';

        // Basic validation
        if (montant <= 0) {
          results.skipped++;
          results.errors.push(`Row ${index + 1}: Invalid amount`);
          continue;
        }

        if (!centreId) {
          results.skipped++;
          results.errors.push(`Row ${index + 1}: Missing centre ID`);
          continue;
        }

        let fournisseurId: string | null = null;
        // Try to link to supplier if provided
        if (fournisseurNom) {
          const fournisseur = await this.prisma.fournisseur.findFirst({
            where: { nom: fournisseurNom },
          });
          if (fournisseur) {
            fournisseurId = fournisseur.id;
          }
        }

        const finalDescription = fournisseurNom
          ? `${description || ''} (Fournisseur: ${fournisseurNom})`
          : description;

        const depenseData = {
          date,
          montant,
          categorie,
          description: finalDescription,
          modePaiement,
          statut,
          centreId,
          factureFournisseurId: null, // Explicitly set to null if not linked to an invoice
          echeanceId: null,
        };

        await this.prisma.depense.create({ data: depenseData as any });
        results.success++;
      } catch (error) {
        results.failed++;
        results.errors.push(`Row ${index + 1}: ${error.message} `);
      }
    }
    return results;
  }
  private async findOrCreateFournisseur(
    nameInput: string,
    index: number,
  ): Promise<any> {
    const log = (msg: string) => {
      try {
        require('fs').appendFileSync(
          'import_skips_factures.log',
          `[SUPPLIER_MATCH] Row ${index + 1}: ${msg} \n`,
        );
      } catch (e) { }
      console.log(`[SupplierMatch] ${msg} `);
    };

    if (!nameInput || nameInput.trim() === '') {
      const fallbackName = 'FOURNISSEUR INCONNU';
      let fallback = await this.prisma.fournisseur.findFirst({
        where: { nom: fallbackName },
      });
      if (!fallback) {
        fallback = await this.prisma.fournisseur.create({
          data: { nom: fallbackName },
        });
      }
      log(`Using global fallback supplier for empty name`);
      return fallback;
    }

    const manualMapping: { [key: string]: string } = {
      'L-0H': 'L-OH',
      'L-N': "L'N OPTIC",
      'O-N-A': 'O-N-A', // keep as is or map if needed
      'MAROC TELECO INTERNET': 'MAROC TELECOM',
      'ETUI BAKRIM': 'ETUI BAKRIM', // Example if needed
      '0-N-A': 'O-N-A',
    };

    if (manualMapping[nameInput.toUpperCase()]) {
      const mappedName = manualMapping[nameInput.toUpperCase()];
      const mappedSupplier = await this.prisma.fournisseur.findFirst({
        where: { nom: mappedName },
      });
      if (mappedSupplier) {
        log(`Manual mapping found: "${nameInput}" -> "${mappedName}"`);
        return mappedSupplier;
      }
    }

    const normalize = (n: string) => {
      if (!n) return '';
      return n
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove accents
        .replace(/0/g, 'O') // Replace 0 with O
        .replace(/[^a-zA-Z0-9]/g, '') // Keep only letters/numbers
        .toUpperCase();
    };

    const searchName = normalize(nameInput);
    if (!searchName) {
      const fallbackName = 'FOURNISSEUR INCONNU';
      let fallback = await this.prisma.fournisseur.findFirst({
        where: { nom: fallbackName },
      });
      if (!fallback) {
        fallback = await this.prisma.fournisseur.create({
          data: { nom: fallbackName },
        });
      }
      log(
        `Using global fallback supplier for non - normalizable name: "${nameInput}"`,
      );
      return fallback;
    }

    // 1. Try exact match first
    let fournisseur = await this.prisma.fournisseur.findFirst({
      where: { nom: { equals: nameInput.trim(), mode: 'insensitive' } },
    });
    if (fournisseur) {
      log(`Exact match found: "${fournisseur.nom}"`);
      return fournisseur;
    }

    // 2. Fetch all to perform smart matching
    const allSuppliers = await this.prisma.fournisseur.findMany({
      select: { id: true, nom: true },
    });
    const levenshtein = require('fast-levenshtein');

    const matchedS = allSuppliers.find((s) => {
      const dbName = normalize(s.nom);

      // A. Exact normalized match
      if (dbName === searchName) return true;

      // B. Inclusion Match
      if (searchName.length > 5 && dbName.length > 5) {
        if (searchName.includes(dbName) || dbName.includes(searchName))
          return true;
      }

      // C. Word-based Inclusion
      const searchWords = nameInput
        .toUpperCase()
        .split(/[^A-Z]/)
        .filter((w) => w.length > 3);
      const dbWords = s.nom
        .toUpperCase()
        .split(/[^A-Z]/)
        .filter((w) => w.length > 3);
      if (searchWords.length > 0 && dbWords.length > 0) {
        const commonWords = searchWords.filter((w) => dbWords.includes(w));
        if (
          commonWords.length >= Math.min(2, searchWords.length, dbWords.length)
        )
          return true;
      }

      // D. Fuzzy Match (Levenshtein)
      const len = Math.max(searchName.length, dbName.length);
      if (len > 2) {
        const distance = levenshtein.get(searchName, dbName);
        // For short names (3-4 chars), allow 1 edit. For longer, 33%.
        const tolerance = len <= 4 ? 1 : Math.floor(len / 3);
        if (distance <= tolerance) return true;
      }

      return false;
    });

    if (matchedS) {
      fournisseur = await this.prisma.fournisseur.findUnique({
        where: { id: matchedS.id },
      });
      if (fournisseur) {
        log(`Smart match found: "${fournisseur.nom}" for input "${nameInput}"`);
        return fournisseur;
      }
    }

    // 3. Create NEW if no match found
    const cleanName = nameInput.trim();
    log(`Creating NEW Supplier: "${cleanName}"`);
    return await this.prisma.fournisseur.create({ data: { nom: cleanName } });
  }
  async getDefaultCentreId(): Promise<string> {
    const centre = await this.prisma.centre.findFirst({
      orderBy: { createdAt: 'asc' },
    });
    return centre?.id || 'DEFAULT_CENTRE';
  }

  async clearData() {
    this.logToFile(
      'Starting database wipe (TRUNCATE CASCADE) for clean re-import...',
    );
    try {
      // Using TRUNCATE CASCADE to definitively wipe tables regardless of size or FK constraints
      await this.prisma.$executeRawUnsafe(`TRUNCATE TABLE "Paiement" CASCADE;`);
      await this.prisma.$executeRawUnsafe(
        `TRUNCATE TABLE "EcheancePaiement" CASCADE;`,
      );
      await this.prisma.$executeRawUnsafe(`TRUNCATE TABLE "Depense" CASCADE;`);
      await this.prisma.$executeRawUnsafe(`TRUNCATE TABLE "Facture" CASCADE;`);
      await this.prisma.$executeRawUnsafe(
        `TRUNCATE TABLE "FactureFournisseur" CASCADE;`,
      );
      await this.prisma.$executeRawUnsafe(
        `TRUNCATE TABLE "MouvementStock" CASCADE;`,
      );
      await this.prisma.$executeRawUnsafe(`TRUNCATE TABLE "Fiche" CASCADE;`);
      await this.prisma.$executeRawUnsafe(`TRUNCATE TABLE "Client" CASCADE;`);
      await this.prisma.$executeRawUnsafe(
        `TRUNCATE TABLE "Fournisseur" CASCADE;`,
      );

      this.logToFile('Database wipe successful (TRUNCATE CASCADE)');
      return { message: 'Data cleared successfully via TRUNCATE' };
    } catch (error) {
      this.logToFile(`Error wiping database: ${error.message}`);
      throw new BadRequestException('Failed to clear data: ' + error.message);
    }
  }
}
