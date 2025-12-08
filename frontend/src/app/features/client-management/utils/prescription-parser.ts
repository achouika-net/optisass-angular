export interface ParsedPrescription {
    OD: { sph: number; cyl: number; axis?: number; add?: number; prism?: number; base?: string };
    OG: { sph: number; cyl: number; axis?: number; add?: number; prism?: number; base?: string };
    EP: { val: number; od?: number; og?: number };
}

export function parsePrescription(text: string): ParsedPrescription {
    // Helper to parse numbers " + 2.50 " => 2.5
    const parseNum = (val: string | undefined): number => {
        if (!val) return 0;
        return parseFloat(val.replace(/\s+/g, '').replace(',', '.'));
    };

    const parseOptNum = (val: string | undefined): number | undefined => {
        if (!val) return undefined;
        return parseFloat(val.replace(/\s+/g, '').replace(',', '.'));
    };

    // 1. Clean up text for easier regex
    // Normalize newlines to spaces to find "ADD" even if far, 
    // BUT we need to distinguish OD line from OG line. 
    // Usually OD and OG are on separate lines. 
    // Let's keep working with the full text but stricter regexes for lines.

    // Regex components
    const num = '([+-]?\\s*\\d+(?:[.,]\\d+)?)'; // Captures number, allows space " + 2.00"
    const sep = '[\\s]*'; // Flexible whitespace

    // AXE: 1. Degree symbol (90°), 2. @ symbol (@90), 3. Plain number (0-180)
    // We capture plain number cautiously (must be integer-ish).
    const axePattern = `(?:(\\d+)\\s*°|@\\s*(\\d+)|\\s+(\\d+)(?=\\s*(?:ADD|Prisme|Base|$)))`;

    // ADD: "ADD", "ADD:", "ADD/", "ADD=" possibly with spaces
    // Regex: ADD followed by optional separator [: / =], then number
    const addPattern = `(?:ADD(?:\\s*[:/=\\s]\\s*|\\s+)${num})`;

    // PRISM: "Prisme", "Prism", followed by optional sep, then number
    const prismPattern = `(?:(?:Prisme|Prism)(?:\\s*[:/=\\s]\\s*|\\s+)${num})`;

    // BASE: "Base" followed by string/number
    const basePattern = `(?:Base(?:\\s*[:/=\\s]\\s*|\\s+)([a-zA-Z0-9]+))`;

    // Positional Line Regex: SPH -> (CYL) -> AXE
    // Groups:
    // 1: SPH (Mandatory-ish)
    // 2: CYL (Parens)
    // 3: CYL (No Parens)
    // 4: AXE (deg)
    // 5: AXE (@)
    // 6: AXE (plain)
    // 7: ADD value
    // 8: PRISM value
    // 9: BASE value

    const mkRegex = (eye: string) => new RegExp(
        `${eye}[:\\s]*` +
        `${num}` + // 1. SPH
        `(?:` +
        `${sep}\\(\\s*${num}\\s*\\)` + // 2. CYL (Parens)
        `|` +
        `${sep}${num}` + // 3. CYL (Plain)
        `)?` +
        `${sep}` +
        `(?:` +
        `${axePattern}` + // 4, 5, 6. AXE
        `)?` +
        `(?:` +
        `.*${addPattern}` + // 7. ADD (Greedy match until ADD allows it to be far)
        `)?` +
        `(?:` +
        `.*${prismPattern}` + // 8. PRISM
        `)?` +
        `(?:` +
        `.*${basePattern}` + // 9. BASE
        `)?`,
        'i'
    );

    const regexOD = mkRegex('OD');
    const regexOG = mkRegex('OG');

    // Standalone ADD Line Regex (if not found in line)
    // Matches "ADD +2.00" on a line by itself or generally in text if not bound to OD/OG
    const regexGlobalADD = new RegExp(`ADD(?:\\s*[:/=\\s]\\s*|\\s+)${num}`, 'i');

    const odMatch = text.match(regexOD);
    const ogMatch = text.match(regexOG);

    // EP Parser
    const regexEP = /(?:EP|PD|Ecart|E\.P|P\.D)[:\s]*(\d+(?:[.,]\d+)?)(?:\s*\/\s*(\d+(?:[.,]\d+)?))?/i;
    const epMatch = text.match(regexEP);

    // Logic to unify ADD: 
    // 1. Use specific eye ADD if found.
    // 2. If not, use global ADD found elsewhere.
    const globalAddMatch = text.match(regexGlobalADD);
    const globalAdd = globalAddMatch ? parseOptNum(globalAddMatch[1]) : undefined;

    const extractValues = (match: RegExpMatchArray | null) => {
        if (!match) return { sph: 0, cyl: 0 };

        // SPH is Group 1
        const sph = parseNum(match[1]);

        // CYL is Group 2 (parens) OR Group 3 (plain)
        const cyl = parseNum(match[2] || match[3]);

        // AXE is Group 4 (deg) OR Group 5 (@) OR Group 6 (plain)
        // Note: For plain axe, we need to be careful it didn't capture a float. regex says \d+ so it's int.
        const axeVal = match[4] || match[5] || match[6];
        const axis = axeVal ? parseInt(axeVal) : undefined;

        // ADD is Group 7
        // Use local ADD if present, else global ADD
        const localAdd = parseOptNum(match[7]);
        const add = localAdd !== undefined ? localAdd : globalAdd;

        // PRISM is Group 8
        const prism = parseOptNum(match[8]);

        // BASE is Group 9
        const base = match[9];

        return { sph, cyl, axis, add, prism, base };
    };

    return {
        OD: extractValues(odMatch),
        OG: extractValues(ogMatch),
        EP: {
            val: parseNum(epMatch?.[1]),
            od: parseOptNum(epMatch?.[1]),
            og: parseOptNum(epMatch?.[2])
        }
    };
}
