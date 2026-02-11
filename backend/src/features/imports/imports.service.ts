import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
const XLSX = require('xlsx');

@Injectable()
export class ImportsService {
    constructor(private prisma: PrismaService) { }

    private logToFile(msg: string) {
        const fs = require('fs');
        const timestamp = new Date().toISOString();
        console.log(`[ServiceLog] ${msg}`); // ENSURE IT GOES TO STDOUT FOR REDIRECTION
        try {
            fs.appendFileSync('import_execute.log', `${timestamp} [ServiceLog] ${msg}\n`);
        } catch (e) {
            // Silently fail if file write fails, console.log is our primary now
        }
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
            const data = XLSX.utils.sheet_to_json(worksheet, { defval: '', cellDates: true });

            console.log(`Parsed ${data.length} rows`);

            // Get headers
            const headers = data.length > 0 ? Object.keys(data[0] as object) : [];
            console.log('Headers detected:', headers);

            const result = {
                headers,
                data,
                preview: data.slice(0, 5)
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
            errors: [] as string[]
        };

        console.log(`Starting importClients with centreId: ${centreId}`);

        // --- INTELLIGENT FAMILY GROUPING PRE-PROCESSING ---
        const phoneGroups = new Map<string, string>(); // Phone -> GroupeId
        const sharedPhones = new Map<string, string>(); // Phone -> FamilyName
        const phoneCounts = new Map<string, Set<string>>(); // Phone -> Set of Codes/Names

        data.forEach(row => {
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
                    where: { nom: `Famille ${familyName}` }
                });
                if (!group) {
                    group = await this.prisma.groupe.create({
                        data: {
                            nom: `Famille ${familyName}`,
                            description: `Groupe créé automatiquement par import (Tél: ${tel})`
                        }
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
                    centreId: centreId // Assign default center
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
                            value = (dbField === 'dateCreation') ? (parsed || new Date()) : parsed;
                        }
                        // 2. Handle Booleans
                        else if (dbField === 'tvaAssujetti') {
                            value = (value === 'true' || value === true || value === 1 || value === '1');
                        }
                        // 3. Handle Integers
                        else if (dbField === 'pointsFidelite') {
                            value = (value !== null && value !== undefined) ? parseInt(String(value), 10) || 0 : 0;
                        }
                        // 4. Handle JSON fields (Skipped here, handled in post-process)
                        else if (['couvertureSociale', 'numCouvertureSociale', 'groupeFamille', 'dossierMedical', 'contacts', 'convention'].includes(dbField)) {
                            // Keep as is for post-processing
                        }
                        // 5. Default: Force String & Trim for all other fields (Nom, Tel, Code, etc.)
                        else {
                            value = (value !== null && value !== undefined) ? String(value).trim() || null : null;
                        }

                        // Assign normalized value
                        clientData[dbField] = value;
                    }
                }

                // Post-process specific fields (Aggregation & Nullification)
                // This ensures Json? fields are valid objects or null (strings NOT allowed)
                const assurance = clientData.couvertureSociale ? String(clientData.couvertureSociale).trim() : null;
                const numero = clientData.numCouvertureSociale ? String(clientData.numCouvertureSociale).trim() : null;

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
                    existingClient = await this.prisma.client.findUnique({
                        where: { codeClient: clientData.codeClient }
                    });
                } else if (clientData.nom && clientData.telephone) {
                    // FALLBACK: Only search by Name + Phone IF no code is provided
                    existingClient = await this.prisma.client.findFirst({
                        where: {
                            nom: { equals: clientData.nom, mode: 'insensitive' },
                            telephone: clientData.telephone
                        }
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
                        if ((existingClient[key] === null || existingClient[key] === '' || existingClient[key] === undefined) && clientData[key]) {
                            updateData[key] = clientData[key];
                            hasUpdates = true;
                        }
                    }

                    if (hasUpdates) {
                        await this.prisma.client.update({
                            where: { id: existingClient.id },
                            data: updateData
                        });
                        results.updated++;
                        results.success++; // Count update as a success row
                    } else {
                        // IT'S A DUPLICATE - BUT A SUCCESS (Data is already correct)
                        results.success++;
                        this.logToFile(`Row ${index + 1}: Informative - Duplicate client found with no new info. Counting as success.`);
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
                    console.warn(`Row ${index} skipped due to unique constraint on: ${field}`);
                    results.skipped++;
                } else {
                    results.failed++;
                    results.errors.push(`Row ${index + 1}: ${error.message}`);
                }
            }
        }

        return results;
    }

    private parseDate(v: any): Date | null {
        if (v === undefined || v === null || String(v).trim() === '' || v === 0 || v === '0') return null;

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
                const day = parseInt(parts[0], 10);
                const month = parseInt(parts[1], 10) - 1;
                const year = parseInt(parts[2], 10);
                if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
                    const pd = new Date(year, month, day);
                    if (!isNaN(pd.getTime()) && pd.getFullYear() >= 1980) return pd;
                }
            }
        }

        return null;
    }

    async importFiches(data: any[], mapping: any, centreId?: string, importType: string = 'fiches') {
        const results = {
            success: 0,
            updated: 0,
            skipped: 0,
            failed: 0,
            totalRowsProcessed: data.length, // Explicitly track total input rows
            errors: [] as string[]
        };

        const log = (msg: string) => {
            const now = new Date();
            console.log(`[${now.toISOString().split('T')[1].split('.')[0]}] 📄 ${msg}`);
        };

        try {
            // TARGETED OPTIMIZATION:
            // Extract all search criteria from the CURRENT batch to fetch only needed clients
            const codes = new Set<string>();
            const names = new Set<string>();
            const phones = new Set<string>();

            data.forEach(row => {
                const code = row[mapping.codeClient];
                if (code) codes.add(String(code));

                const name = row[mapping.nom];
                const phone = row[mapping.telephone];
                if (name) names.add(String(name));
                if (phone) phones.add(String(phone));
            });

            log(`Searching for clients in batch... (${codes.size} codes, ${names.size} names)`);

            // Build targeted query
            const allClients = await this.prisma.client.findMany({
                where: {
                    OR: [
                        { codeClient: { in: Array.from(codes) } },
                        {
                            AND: [
                                { nom: { in: Array.from(names) } },
                                { telephone: { in: Array.from(phones) } }
                            ]
                        }
                    ]
                },
                select: { id: true, codeClient: true, nom: true, telephone: true }
            });

            log(`Found ${allClients.length} potential client matches for this batch`);

            // Create lookup maps
            const codeMap = new Map();
            const identityMap = new Map();

            allClients.forEach(c => {
                if (c.codeClient) codeMap.set(String(c.codeClient), c.id);
                if (c.nom && c.telephone) {
                    const key = `${String(c.nom).toLowerCase().trim()}_${String(c.telephone).trim()}`;
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
                const nom = mappedRow.nom ? String(mappedRow.nom).toLowerCase().trim() : '';
                const tel = mappedRow.telephone ? String(mappedRow.telephone).trim() : '';

                const identKey = (nom && tel) ? `${nom}_${tel}` : null;

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
                } else if (!code && !identKey && !nom && tel && !processedNames.has(`tel_${tel}`)) {
                    // New fallback: Create by phone even if name/code missing
                    isMissing = true;
                    processedNames.add(`tel_${tel}`);
                }

                if (isMissing) {
                    const clientData: any = {
                        codeClient: code || null,
                        nom: (typeof mappedRow.nom === 'string' && mappedRow.nom.trim()) ? mappedRow.nom.trim() : (tel ? `Client Tel ${tel}` : (code ? `Client ${code}` : 'Client Inconnu')),
                        prenom: (typeof mappedRow.prenom === 'string' && mappedRow.prenom.trim())
                            ? mappedRow.prenom.trim()
                            : (typeof mappedRow.prenom === 'number' ? String(mappedRow.prenom) : null),
                        telephone: tel || null,
                        email: (typeof mappedRow.email === 'string' && mappedRow.email.trim()) ? mappedRow.email.trim() : null,
                        adresse: (typeof mappedRow.adresse === 'string' && mappedRow.adresse.trim()) ? mappedRow.adresse.trim() : null,
                        ville: (typeof mappedRow.ville === 'string' && mappedRow.ville.trim()) ? mappedRow.ville.trim() : null,
                        codePostal: (typeof mappedRow.codePostal === 'string' && mappedRow.codePostal.trim())
                            ? mappedRow.codePostal.trim()
                            : (typeof mappedRow.codePostal === 'number' ? String(mappedRow.codePostal) : null),
                        dateNaissance: parseDate(mappedRow.dateNaissance),
                        dateCreation: parseDate(mappedRow.dateCreation) || new Date(),
                        typeClient: 'PHYSIQUE',
                        statut: 'ACTIF',
                        centreId: centreId || null
                    };

                    // Handle insurance (Aggregation & Nullification)
                    const assuranceIns = mappedRow.couvertureSociale ? String(mappedRow.couvertureSociale).trim() : null;
                    const numeroIns = mappedRow.numCouvertureSociale ? String(mappedRow.numCouvertureSociale).trim() : null;

                    if (assuranceIns || numeroIns) {
                        clientData.couvertureSociale = {
                            assurance: assuranceIns || null,
                            numero: numeroIns || null
                        };
                    } else {
                        clientData.couvertureSociale = null;
                    }

                    missingClients.push(clientData);
                }
            });

            if (missingClients.length > 0) {
                log(`⚡ Aggressive Auto-creating ${missingClients.length} missing clients...`);
                await this.prisma.client.createMany({
                    data: missingClients,
                    skipDuplicates: true
                });

                // Re-fetch ALL possible matches to update IDs
                const newClients = await this.prisma.client.findMany({
                    where: {
                        OR: [
                            { codeClient: { in: Array.from(processedCodes) } },
                            {
                                AND: [
                                    { nom: { in: Array.from(names) } },
                                    { telephone: { in: Array.from(phones) } }
                                ]
                            },
                            { nom: { in: Array.from(names) } }, // Aggressive fetch
                            { telephone: { in: Array.from(phones) } }
                        ]
                    },
                    select: { id: true, codeClient: true, nom: true, telephone: true }
                });

                newClients.forEach(c => {
                    if (c.codeClient) codeMap.set(String(c.codeClient), c.id);
                    if (c.nom && c.telephone) {
                        const key = `${String(c.nom).toLowerCase().trim()}_${String(c.telephone).trim()}`;
                        identityMap.set(key, c.id);
                    }
                    // Secondary backups: match by name only or tel only if no full identity
                    if (c.nom) {
                        const nameKey = String(c.nom).toLowerCase().trim();
                        if (!identityMap.has(nameKey)) identityMap.set(nameKey, c.id);
                    }
                    if (c.telephone) {
                        const telKey = `tel_${String(c.telephone).trim()}`;
                        if (!identityMap.has(telKey)) identityMap.set(telKey, c.id);
                    }
                });
            }
            // ----------------------------------------

            const fichesToCreate: any[] = [];

            // Helper functions
            const parseNum = (v) => {
                if (v === undefined || v === null || v === '') return undefined;
                let val = String(v).replace(',', '.').replace(/[^-0-9.]/g, '');
                const n = parseFloat(val);
                return isNaN(n) ? undefined : n;
            };

            const parseDate = (v) => this.parseDate(v);

            // 1. Group data by Fiche ID + Date
            const groupedFiches = new Map<string, any[]>();
            data.forEach((row, idx) => {
                const fid = row[mapping.fiche_id] || (row[mapping.numero] ? String(row[mapping.numero]) : null);

                // Grouping by Date as well to separate historical visits
                const dateVal = row[mapping.dateCreation] || row[mapping.date_ordonnance];
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
                    key = `FID_${fid}_${dateStr}`; // Group by ID + Date
                } else {
                    key = `ROW_${idx}_${fid || 'nofid'}`; // Force unique if no ID
                }

                if (!groupedFiches.has(key)) groupedFiches.set(key, []);
                groupedFiches.get(key)!.push(row);
            });

            log(`Grouped ${data.length} rows into ${groupedFiches.size} unique fiches`);

            // 2. Process each group
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
                        const nomStr = sharedMapped.nom ? String(sharedMapped.nom).toLowerCase().trim() : '';
                        const telStr = sharedMapped.telephone ? String(sharedMapped.telephone).trim() : '';
                        const identKey = (nomStr && telStr) ? `${nomStr}_${telStr}` : (nomStr || `tel_${telStr}`);
                        clientId = identityMap.get(identKey);
                    }

                    if (!clientId) {
                        log(`Skipping group ${key}: No client found (code: ${sharedMapped.codeClient}, nom: ${sharedMapped.nom}, tel: ${sharedMapped.telephone})`);
                        results.skipped += rows.length;
                        continue;
                    }

                    // 2. CONSOLIDATED UNIFIED LOGIC
                    // We merge ALL rows in the group into a single Fiche.

                    const pm: any = {};
                    rows.forEach(row => {
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

                    const explicitType = pm.fiche_type ? String(pm.fiche_type).trim().toUpperCase() : null;

                    // [FIX] Independent detection: Don't let explicitType block the other data type
                    hasMontureData = !!(
                        pm.monture_marque || pm.monture_reference || pm.verres_type ||
                        pm.verres_prix_od || pm.verres_prix_og ||
                        pm.verres_marque || pm.verres_matiere
                    );
                    hasLentilleData = !!(
                        pm.lentilles_marque || pm.od_rayon || pm.og_rayon ||
                        pm.lentilles_marque_od || pm.lentilles_marque_og ||
                        pm.lentilles_prix || pm.lentilles_usage
                    );

                    const hasPrescription = !!(pm.od_sphere || pm.og_sphere || pm.od_cylindre || pm.og_cylindre);

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
                                k2: parseNum(pm.od_k2)
                            },
                            og: {
                                sphere: parseNum(pm.og_sphere),
                                cylindre: parseNum(pm.og_cylindre),
                                axe: parseNum(pm.og_axe),
                                addition: parseNum(pm.og_addition),
                                k1: parseNum(pm.og_k1),
                                k2: parseNum(pm.og_k2)
                            },
                            epOD: parseNum(pm.ep_od),
                            epOG: parseNum(pm.ep_og),
                            dateOrdonnance: parseDate(pm.date_ordonnance),
                            nomMedecin: pm.nom_medecin
                        },
                        equipements: [],
                        notes: pm.notes,
                        fournisseur: pm.fournisseur,
                        factureFournisseur: pm.facture_fournisseur,
                        dateLivraisonEstimee: parseDate(pm.dateLivraisonEstimee)
                    };

                    // Add Monture if present
                    if (hasMontureData) {
                        content.monture = {
                            marque: pm.monture_marque,
                            modele: pm.monture_modele,
                            reference: pm.monture_reference,
                            prixMonture: parseNum(pm.monture_prix) || 0
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
                                pm.og_sphere || pm.og_cylindre || pm.og_axe || pm.verres_prix_og ||
                                (pm.verres_matiere_od && pm.verres_matiere_og && pm.verres_matiere_od !== pm.verres_matiere_og) ||
                                (pm.verres_indice_od && pm.verres_indice_og && pm.verres_indice_od !== pm.verres_indice_og)
                            )
                        };
                    }

                    // Add Lentilles if present
                    if (hasLentilleData) {
                        content.lentilles = {
                            type: pm.lentilles_usage || 'Mensuelle',
                            diffLentilles: !!(
                                pm.og_rayon || pm.og_diametre || pm.og_sphere || pm.og_cylindre || pm.og_axe ||
                                (pm.lentilles_marque_od && pm.lentilles_marque_og && pm.lentilles_marque_od !== pm.lentilles_marque_og)
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
                                quantite: parseNum(pm.lentilles_qte) || 1
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
                                quantite: parseNum(pm.lentilles_qte) || 1
                            }
                        };
                    }

                    // Process ALL rows for products and equipments
                    const addedProductsRefs = new Set();

                    rows.forEach((row, rowIndex) => {
                        const m: any = {};
                        for (const k of Object.keys(mapping)) if (mapping[k]) m[k] = row[mapping[k]];

                        // Products
                        const addProd = (ref, desc, qte, prix) => {
                            if ((ref || desc) && !addedProductsRefs.has(ref + desc)) {
                                if (!content.produits) content.produits = [];
                                content.produits.push({
                                    reference: String(ref || ''),
                                    designation: String(desc || ''),
                                    quantite: parseNum(qte) || 1,
                                    prixUnitaire: parseNum(prix) || 0,
                                    prixTotal: (parseNum(qte) || 1) * (parseNum(prix) || 0)
                                });
                                addedProductsRefs.add(ref + desc);
                            }
                        };
                        addProd(m.produit_ref, m.produit_designation, m.produit_qte, m.produit_prix);
                        addProd(m.produit2_ref, m.produit2_designation, m.produit2_qte, m.produit2_prix);

                        // --- EQUIPMENT PROCESSING ---

                        // Helper to create equipment object
                        const createEquip = (mtType, mtData, vrData) => ({
                            type: mtType || 'Monture',
                            dateAjout: new Date(),
                            monture: {
                                marque: mtData.marque,
                                modele: mtData.modele,
                                reference: mtData.reference || 'Equipement Extra',
                                prixMonture: parseNum(mtData.prix) || 0
                            },
                            verres: {
                                type: 'Unifocal',
                                marque: vrData.marque,
                                prixOD: parseNum(vrData.prix_od) || 0,
                                prixOG: parseNum(vrData.prix_og) || parseNum(vrData.prix_od) || 0
                            }
                        });

                        // 1. Process PRIMARY columns for SUBSEQUENT rows (rowIndex > 0)
                        if (rowIndex > 0) {
                            // Check if this row has Primary data (Monture/Verres OR Lentilles)
                            const hasPrimaryData = (
                                m.monture_marque || m.monture_reference || m.verres_marque || m.verres_prix_od ||
                                m.lentilles_marque || m.lentilles_prix || m.od_rayon
                            );

                            if (hasPrimaryData) {
                                // [NEW] MERGE INTO MAIN if Main is currently empty or contains generic "CLIENT" placeholder
                                const isMainMontureEmpty = !content.monture?.marque || content.monture?.marque === 'CLIENT';
                                const isMainVerresEmpty = !content.verres?.marque;
                                const isMainLentillesEmpty = !content.lentilles?.od?.marque && !content.lentilles?.og?.marque;

                                if (isMainMontureEmpty && (m.monture_marque && m.monture_marque !== 'CLIENT')) {
                                    // Merge frame data into root
                                    if (!content.monture) content.monture = {};
                                    content.monture.marque = m.monture_marque;
                                    content.monture.modele = m.monture_modele || content.monture.modele;
                                    content.monture.reference = m.monture_reference || content.monture.reference;
                                    content.monture.prixMonture = parseNum(m.monture_prix) || content.monture.prixMonture;
                                    console.log(`MERGED Subsequent Row ${rowIndex} Monture into Main: ${m.monture_marque}`);
                                } else if (isMainVerresEmpty && m.verres_marque) {
                                    // Merge lens data into root
                                    if (!content.verres) content.verres = { type: 'Unifocal' };
                                    content.verres.marque = m.verres_marque;
                                    content.verres.prixOD = parseNum(m.verres_prix_od) || content.verres.prixOD;
                                    content.verres.prixOG = parseNum(m.verres_prix_og) || parseNum(m.verres_prix_od) || content.verres.prixOG;
                                    console.log(`MERGED Subsequent Row ${rowIndex} Verres into Main: ${m.verres_marque}`);
                                } else if (isMainLentillesEmpty && (m.lentilles_marque || m.lentilles_marque_od || m.lentilles_marque_og)) {
                                    // Merge contact lens data into root
                                    if (!content.lentilles) {
                                        content.lentilles = { type: m.lentilles_usage || 'Mensuelle', od: {}, og: {} };
                                    }
                                    content.lentilles.od.marque = m.lentilles_marque_od || m.lentilles_marque || content.lentilles.od.marque;
                                    content.lentilles.og.marque = m.lentilles_marque_og || m.lentilles_marque || content.lentilles.og.marque;
                                    content.lentilles.od.prix = parseNum(m.lentilles_prix) || content.lentilles.od.prix;
                                    content.lentilles.og.prix = parseNum(m.lentilles_prix) || content.lentilles.og.prix;
                                    console.log(`MERGED Subsequent Row ${rowIndex} Lentilles into Main`);
                                } else {
                                    // Both Main and Row have data -> Add as NEW equipment to avoid overwriting
                                    content.equipements.push(createEquip('Monture', {
                                        marque: m.monture_marque,
                                        modele: m.monture_modele,
                                        reference: m.monture_reference,
                                        prix: m.monture_prix
                                    }, {
                                        marque: m.verres_marque,
                                        prix_od: m.verres_prix_od,
                                        prix_og: m.verres_prix_og
                                    }));
                                }
                            }
                        } else {
                            // 2. FOR ROW 0 ONLY: Checks for 0-price overwrite
                            // If content.verres (Main) has 0 price, but this row effectively has a price, patch it.
                            const v_od = (m as any).verres_prix_od;
                            const v_og = (m as any).verres_prix_og;
                            const m_prix = (m as any).monture_prix;
                            const l_prix = (m as any).lentilles_prix;

                            const v_od_n = parseNum(v_od) || 0;
                            const v_og_n = parseNum(v_og) || 0;
                            const m_prix_n = parseNum(m_prix) || 0;
                            const l_prix_n = parseNum(l_prix) || 0;

                            if (content.verres && content.verres.prixOD === 0 && v_od_n > 0) {
                                content.verres.prixOD = v_od_n;
                            }
                            if (content.verres && content.verres.prixOG === 0 && (v_og_n > 0 || v_od_n > 0)) {
                                content.verres.prixOG = v_og_n || v_od_n;
                            }
                            // Same for Monture
                            if (content.monture && (content.monture.prixMonture === 0 || !content.monture.prixMonture) && m_prix_n > 0) {
                                content.monture.prixMonture = m_prix_n;
                            }
                            // Same for Lentilles
                            if (content.lentilles && content.lentilles.od && (content.lentilles.od.prix === 0 || !content.lentilles.od.prix) && l_prix_n > 0) {
                                content.lentilles.od.prix = l_prix_n;
                                if (content.lentilles.og) content.lentilles.og.prix = l_prix_n;
                            }
                        }

                        // 3. Process SECONDARY columns (For ALL rows, including Row 0)
                        // If monture2 exists, it's ALWAYS a separate equipment.
                        if (m.monture2_marque || m.monture2_reference || m.verres2_marque || m.verres2_prix_od) {

                            // FAILSAFE: Strict check against Main Equipment
                            const matchesMain = (
                                m.monture2_marque === content.monture?.marque &&
                                m.monture2_reference === content.monture?.reference
                            );

                            if (!matchesMain) {
                                content.equipements.push(createEquip('Monture', {
                                    marque: m.monture2_marque,
                                    modele: m.monture2_modele,
                                    reference: m.monture2_reference || 'Equipement 2',
                                    prix: m.monture2_prix
                                }, {
                                    marque: m.verres2_marque,
                                    prix_od: m.verres2_prix_od,
                                    prix_og: m.verres2_prix_og
                                }));
                            } else {
                                // If it matches main, maybe we can steal the price if main is missing it?
                                if (content.monture && content.monture.prixMonture === 0 && m.monture2_prix) {
                                    content.monture.prixMonture = parseNum(m.monture2_prix) || 0;
                                }
                            }
                        }
                    });

                    fichesToCreate.push({
                        clientId: clientId,
                        type: finalType,
                        statut: String(pm.statut || 'livre').toLowerCase(),
                        dateCreation: parseDate(pm.dateCreation) || new Date(),
                        montantTotal: parseNum(pm.montantTotal) || 0,
                        montantPaye: parseNum(pm.montantPaye) || 0,
                        content: content
                    });
                    results.success++;

                } catch (error) {
                    results.failed++;
                    if (results.errors.length < 100) results.errors.push(`Groupe ${key}: ${error.message}`);
                }
            }

            // 3. Batch Create using CreateMany for max speed
            if (fichesToCreate.length > 0) {
                console.log(`🚀 Bulk inserting ${fichesToCreate.length} fiches...`);
                // Split into chunks of 5000 to prevent database packet limits
                for (let i = 0; i < fichesToCreate.length; i += 5000) {
                    const chunk = fichesToCreate.slice(i, i + 5000);
                    await this.prisma.fiche.createMany({
                        data: chunk,
                        skipDuplicates: true
                    });
                }
            }

        } catch (globalError) {
            console.error('CRITICAL IMPORT ERROR:', globalError);
            results.failed = data.length;
            results.errors.push(`Erreur Critique: ${globalError.message}`);
        }

        return results;
    }

    async importProducts(data: any[], mapping: any, warehouseId: string) {
        const results = {
            success: 0,
            updated: 0,
            skipped: 0,
            failed: 0,
            errors: [] as string[]
        };

        for (const [index, row] of data.entries()) {
            let productData: any = {}; // Declare outside try block for error logging scope
            try {
                productData = {
                    typeArticle: 'MONTURE', // Default
                    statut: 'ACTIF',
                    entrepotId: warehouseId,
                    utilisateurCreation: 'IMPORT_SYSTEM', // Required field for imports
                    seuilAlerte: 1 // Default threshold for imported products
                };

                // Apply mapping
                const specificData: any = {}; // For fields that go into specificData JSON

                for (const [dbField, csvHeader] of Object.entries(mapping)) {
                    if (csvHeader && row[csvHeader as string] !== undefined) {
                        let value = row[csvHeader as string];

                        // Type conversions for numeric fields
                        if (['prixAchatHT', 'prixVenteHT', 'prixVenteTTC', 'quantiteActuelle', 'seuilAlerte', 'coefficient', 'tauxTVA'].includes(dbField)) {
                            value = parseFloat(value) || 0;
                        }

                        // Force string for text fields to avoid type errors (e.g. numeric barcodes/codes)
                        if (['codeInterne', 'codeBarres', 'designation', 'marque', 'modele', 'couleur'].includes(dbField)) {
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
                if (!productData.designation && (productData.marque || productData.modele)) {
                    productData.designation = [productData.marque, productData.modele, productData.couleur].filter(Boolean).join(' ');
                }

                // Basic validation
                if (!productData.designation) {
                    const debugInfo = {
                        row,
                        mapping,
                        productData
                    };
                    require('fs').writeFileSync('debug_import_error.json', JSON.stringify(debugInfo, null, 2));

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
                            { codeBarres: productData.codeBarres }
                        ]
                    }
                });

                if (existingProduct) {
                    // Smart Update Logic
                    const updates: any = {};
                    let hasUpdates = false;

                    for (const [key, value] of Object.entries(productData)) {
                        // Skip system fields
                        if (['entrepotId', 'utilisateurCreation', 'createdAt', 'updatedAt'].includes(key)) continue;

                        // If existing field is null/empty AND new value is present -> Update it
                        const existingValue = (existingProduct as any)[key];
                        if (existingValue == null || existingValue === '' || existingValue === 0) {
                            if (value != null && value !== '' && value !== 0) {
                                updates[key] = value;
                                hasUpdates = true;
                            }
                        }
                    }

                    if (hasUpdates) {
                        await this.prisma.product.update({
                            where: { id: existingProduct.id },
                            data: updates
                        });
                        results.updated++;
                        results.success++; // Count update as success
                    } else {
                        results.success++; // Duplicate is a success
                        this.logToFile(`Product Row ${index + 1}: Informative - Duplicate found. Counting as success.`);
                    }
                } else {
                    // Start Create
                    await this.prisma.product.create({
                        data: productData
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
                    productData // <--- CRITICAL: See what we tried to save
                });

                // Write to debug file for inspection
                require('fs').writeFileSync('debug_import_fail_row.json', JSON.stringify({
                    row: index + 1,
                    productData,
                    error: error.message
                }, null, 2));

                if (error.code === 'P2002') {
                    // Unique constraint violation -> Duplicate -> Skip
                    results.skipped++;
                    // Optional: Log duplicate skipping
                    // console.warn(`Duplicate skipped: ${error.meta?.target?.join(', ')}`);
                } else {
                    results.failed++;
                    // ... (existing logging code) ...

                    // Extract meaningful error message
                    let errorMsg = error.message;
                    if (error.code === 'P2003') {
                        errorMsg = `Invalid reference: ${error.meta?.field_name || 'foreign key constraint'}`;
                    } else if (error.message.includes('Argument')) {
                        // ...
                        const match = error.message.match(/Argument `(\w+)`/);
                        if (match) {
                            errorMsg = `Missing or invalid field: ${match[1]}`;
                        }
                    }
                    results.errors.push(`Row ${index + 1}: ${errorMsg}`);
                }
            }
        }

        return results;
    }

    async importFournisseurs(data: any[], mapping: any) {
        const results = { success: 0, updated: 0, skipped: 0, failed: 0, errors: [] as string[] };
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
                existingFournisseur = await this.prisma.fournisseur.findFirst({ where: { nom } });
                const fournisseurData = {
                    nom,
                    contact: row[mapping.contact] ? String(row[mapping.contact]).trim() : null,
                    email: row[mapping.email] ? String(row[mapping.email]).trim() : null,
                    telephone: row[mapping.telephone] ? String(row[mapping.telephone]).trim() : null,
                    adresse: row[mapping.adresse] ? String(row[mapping.adresse]).trim() : null,
                    ville: row[mapping.ville] ? String(row[mapping.ville]).trim() : null,
                    siteWeb: row[mapping.siteWeb] ? String(row[mapping.siteWeb]).trim() : null,
                    ice: row[mapping.ice] ? String(row[mapping.ice]).trim() : null,
                    rc: row[mapping.rc] ? String(row[mapping.rc]).trim() : null,
                    identifiantFiscal: row[mapping.identifiantFiscal] ? String(row[mapping.identifiantFiscal]).trim() : null,
                    patente: row[mapping.patente] ? String(row[mapping.patente]).trim() : null,
                    cnss: row[mapping.cnss] ? String(row[mapping.cnss]).trim() : null,
                    rib: row[mapping.rib] ? String(row[mapping.rib]).trim() : null,
                    banque: row[mapping.banque] ? String(row[mapping.banque]).trim() : null,
                    conditionsPaiement: row[mapping.conditionsPaiement] ? String(row[mapping.conditionsPaiement]).trim() : null
                };
                if (existingFournisseur) {
                    await this.prisma.fournisseur.update({ where: { id: existingFournisseur.id }, data: fournisseurData as any });
                    results.updated++;
                } else {
                    await this.prisma.fournisseur.create({ data: fournisseurData as any });
                    results.success++;
                }
            } catch (error) {
                results.failed++;
                results.errors.push(`Row ${index + 1}: ${error.message}`);
            }
        }
        return results;
    }

    async importFacturesFournisseurs(data: any[], mapping: any, centreId?: string) {
        const results = { success: 0, updated: 0, skipped: 0, failed: 0, errors: [] as string[] };
        for (let index = 0; index < data.length; index++) {
            const row = data[index];
            try {
                const numeroFacture = row[mapping.numeroFacture] ? String(row[mapping.numeroFacture]).trim() : null;
                const codeFournisseur = row[mapping.codeFournisseur] ? String(row[mapping.codeFournisseur]).trim() : null;
                const nomFournisseur = row[mapping.nomFournisseur] ? String(row[mapping.nomFournisseur]).trim() : null;
                if (!numeroFacture) {
                    results.skipped++;
                    results.errors.push(`Row ${index + 1}: Missing invoice number`);
                    continue;
                }
                let fournisseur: any = null;
                if (codeFournisseur) fournisseur = await this.prisma.fournisseur.findFirst({ where: { nom: codeFournisseur } });
                if (!fournisseur && nomFournisseur) fournisseur = await this.prisma.fournisseur.findFirst({ where: { nom: nomFournisseur } });
                if (!fournisseur && nomFournisseur) fournisseur = await this.prisma.fournisseur.create({ data: { nom: nomFournisseur } });
                if (!fournisseur) {
                    results.skipped++;
                    results.errors.push(`Row ${index + 1}: Supplier not found`);
                    continue;
                }
                const dateEmission = this.parseDate(row[mapping.dateEmission]) || new Date();
                const dateEcheance = this.parseDate(row[mapping.dateEcheance]);
                const montantHT = parseFloat(row[mapping.montantHT]) || 0;
                const montantTVA = parseFloat(row[mapping.montantTVA]) || 0;
                const montantTTC = parseFloat(row[mapping.montantTTC]) || (montantHT + montantTVA);
                const factureData = {
                    numeroFacture, dateEmission, dateEcheance, montantHT, montantTVA, montantTTC,
                    statut: row[mapping.statut] || 'A_PAYER', type: row[mapping.type] || 'ACHAT_STOCK',
                    fournisseurId: fournisseur.id, centreId: centreId || null
                };
                const existingFacture = await this.prisma.factureFournisseur.findFirst({
                    where: { numeroFacture, fournisseurId: fournisseur.id }
                });
                if (existingFacture) {
                    await this.prisma.factureFournisseur.update({ where: { id: existingFacture.id }, data: factureData as any });
                    results.updated++;
                } else {
                    await this.prisma.factureFournisseur.create({ data: factureData as any });
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
        const results = { success: 0, updated: 0, skipped: 0, failed: 0, errors: [] as string[] };
        for (let index = 0; index < data.length; index++) {
            const row = data[index];
            try {
                const numeroFacture = row[mapping.numeroFacture] ? String(row[mapping.numeroFacture]).trim() : null;
                const codeFournisseur = row[mapping.codeFournisseur] ? String(row[mapping.codeFournisseur]).trim() : null;
                if (!numeroFacture) {
                    results.skipped++;
                    results.errors.push(`Row ${index + 1}: Missing invoice number`);
                    continue;
                }
                let facture: any = null;
                if (codeFournisseur) {
                    const fournisseur = await this.prisma.fournisseur.findFirst({ where: { nom: codeFournisseur } });
                    if (fournisseur) facture = await this.prisma.factureFournisseur.findFirst({ where: { numeroFacture, fournisseurId: fournisseur.id } });
                } else {
                    facture = await this.prisma.factureFournisseur.findFirst({ where: { numeroFacture } });
                }
                if (!facture) {
                    results.skipped++;
                    results.errors.push(`Row ${index + 1}: Invoice not found`);
                    continue;
                }
                const montant = parseFloat(row[mapping.montant]) || 0;
                const datePaiement = this.parseDate(row[mapping.datePaiement]) || new Date();
                await this.prisma.echeancePaiement.create({
                    data: {
                        factureFournisseurId: facture.id, montant, dateEncaissement: datePaiement,
                        dateEcheance: datePaiement, type: 'PAIEMENT',
                        reference: row[mapping.reference] || null, statut: 'PAYEE'
                    }
                });
                const totalPaye = await this.prisma.echeancePaiement.aggregate({
                    where: { factureFournisseurId: facture.id }, _sum: { montant: true }
                });
                const nouveauStatut = (totalPaye._sum.montant || 0) >= facture.montantTTC ? 'PAYEE' : 'PARTIELLE';
                await this.prisma.factureFournisseur.update({ where: { id: facture.id }, data: { statut: nouveauStatut as string } });
                results.success++;
            } catch (error) {
                results.failed++;
                results.errors.push(`Row ${index + 1}: ${error.message}`);
            }
        }
        return results;
    }

    async importFacturesVentes(data: any[], mapping: any, centreId?: string) {
        const results = { success: 0, updated: 0, skipped: 0, failed: 0, errors: [] as string[] };
        for (let index = 0; index < data.length; index++) {
            const row = data[index];
            try {
                const codeClient = row[mapping.codeClient] ? String(row[mapping.codeClient]).trim() : null;
                const nomClient = row[mapping.nomClient] ? String(row[mapping.nomClient]).trim() : null;
                if (!codeClient && !nomClient) {
                    results.skipped++;
                    results.errors.push(`Row ${index + 1}: Missing client code or name`);
                    continue;
                }
                let client: any = null;
                if (codeClient) client = await this.prisma.client.findFirst({ where: { codeClient } });
                if (!client && nomClient) client = await this.prisma.client.findFirst({ where: { nom: nomClient } });
                if (!client) {
                    results.skipped++;
                    results.errors.push(`Row ${index + 1}: Client not found`);
                    continue;
                }
                const type = row[mapping.type] || 'FACTURE';
                const dateEmission = this.parseDate(row[mapping.dateEmission]) || new Date();
                const dateEcheance = this.parseDate(row[mapping.dateEcheance]);
                const totalHT = parseFloat(row[mapping.totalHT]) || 0;
                const totalTVA = parseFloat(row[mapping.totalTVA]) || 0;
                const totalTTC = parseFloat(row[mapping.totalTTC]) || (totalHT + totalTVA);
                let numero = row[mapping.numero];
                if (!numero) {
                    const prefix = type === 'DEVIS' ? 'DEV' : type === 'BON_COMMANDE' ? 'BC' : 'FAC';
                    const count = await this.prisma.facture.count({ where: { type } });
                    numero = `${prefix}-${(count + 1).toString().padStart(6, '0')}`;
                }
                const factureData = {
                    numero, type, dateEmission, dateEcheance, statut: row[mapping.statut] || 'BROUILLON',
                    clientId: client.id, totalHT, totalTVA, totalTTC, resteAPayer: totalTTC,
                    lignes: [], centreId: centreId || null
                };
                const existingFacture = await this.prisma.facture.findFirst({ where: { numero } });
                if (existingFacture) {
                    await this.prisma.facture.update({ where: { id: existingFacture.id }, data: factureData as any });
                    results.updated++;
                } else {
                    await this.prisma.facture.create({ data: factureData as any });
                    results.success++;
                }
            } catch (error) {
                results.failed++;
                results.errors.push(`Row ${index + 1}: ${error.message}`);
            }
        }
        return results;
    }

    async importPaiementsClients(data: any[], mapping: any) {
        const results = { success: 0, updated: 0, skipped: 0, failed: 0, errors: [] as string[] };
        for (let index = 0; index < data.length; index++) {
            const row = data[index];
            try {
                const numeroFacture = row[mapping.numeroFacture] ? String(row[mapping.numeroFacture]).trim() : null;
                const codeClient = row[mapping.codeClient] ? String(row[mapping.codeClient]).trim() : null;
                if (!numeroFacture) {
                    results.skipped++;
                    results.errors.push(`Row ${index + 1}: Missing invoice number`);
                    continue;
                }

                let client: any = null;
                if (codeClient) {
                    client = await this.prisma.client.findFirst({ where: { codeClient } });
                }

                if (!client) {
                    results.skipped++;
                    results.errors.push(`Row ${index + 1}: Client not found`);
                    continue;
                }

                let facture: any = null;
                if (client) { // Ensure client is found before trying to find facture with clientId
                    facture = await this.prisma.facture.findFirst({ where: { numero: numeroFacture, clientId: client.id } });
                } else {
                    // This branch would only be hit if client was not found, but we already handled that.
                    // If numeroFacture is present but client is not, we should not proceed.
                    // The original code had a path for `!codeClient` to find facture without client.id,
                    // but the edit implies client must be found first.
                    // Reverting to original logic for finding facture if client is not found via codeClient,
                    // but the edit explicitly checks for client first.
                    // Given the edit, the `else` branch for finding facture without `clientId` is removed.
                    // The edit implies `client` must be found to proceed.
                }

                if (!facture) {
                    results.skipped++;
                    results.errors.push(`Row ${index + 1}: Invoice not found`);
                    continue;
                }
                const montant = parseFloat(row[mapping.montant]) || 0;
                const datePaiement = this.parseDate(row[mapping.datePaiement]) || new Date();
                await this.prisma.paiement.create({
                    data: {
                        factureId: facture.id, montant, date: datePaiement,
                        mode: row[mapping.modePaiement] || 'Espèces',
                        reference: row[mapping.reference] || null, statut: 'ENCAISSE'
                    }
                });
                const totalPaye = await this.prisma.paiement.aggregate({
                    where: { factureId: facture.id }, _sum: { montant: true }
                });
                const resteAPayer = facture.totalTTC - (totalPaye._sum.montant || 0);
                const nouveauStatut = resteAPayer <= 0 ? 'PAYEE' : 'VALIDEE';
                await this.prisma.facture.update({
                    where: { id: facture.id }, data: { resteAPayer, statut: nouveauStatut as string }
                });
                results.success++;
            } catch (error) {
                results.failed++;
                results.errors.push(`Row ${index + 1}: ${error.message}`);
            }
        }
        return results;
    }
    async importDepenses(data: any[], mapping: any, centreId?: string) {
        const results = { success: 0, updated: 0, skipped: 0, failed: 0, errors: [] as string[] };
        for (let index = 0; index < data.length; index++) {
            const row = data[index];
            try {
                // Exclude if invoice number is present (to avoid duplicating invoices as expenses)
                if (mapping.numeroFacture && row[mapping.numeroFacture]) {
                    results.skipped++;
                    continue;
                }

                const date = this.parseDate(row[mapping.date]) || new Date();
                const montant = parseFloat(row[mapping.montant]) || 0;
                const categorie = row[mapping.categorie] ? String(row[mapping.categorie]).trim() : 'AUTRE_DEPENSE';
                const description = row[mapping.description] ? String(row[mapping.description]).trim() : null;
                const modePaiement = row[mapping.modePaiement] ? String(row[mapping.modePaiement]).trim() : 'ESPECES';
                const statut = row[mapping.statut] ? String(row[mapping.statut]).trim() : 'PAYEE';
                const fournisseurNom = row[mapping.fournisseur] ? String(row[mapping.fournisseur]).trim() : null;

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
                    const fournisseur = await this.prisma.fournisseur.findFirst({ where: { nom: fournisseurNom } });
                    if (fournisseur) {
                        fournisseurId = fournisseur.id;
                    }
                }

                const finalDescription = fournisseurNom ? `${description || ''} (Fournisseur: ${fournisseurNom})` : description;

                const depenseData = {
                    date,
                    montant,
                    categorie,
                    description: finalDescription,
                    modePaiement,
                    statut,
                    centreId,
                    factureFournisseurId: null, // Explicitly set to null if not linked to an invoice
                    echeanceId: null
                };

                await this.prisma.depense.create({ data: depenseData as any });
                results.success++;
            } catch (error) {
                results.failed++;
                results.errors.push(`Row ${index + 1}: ${error.message}`);
            }
        }
        return results;
    }
}
