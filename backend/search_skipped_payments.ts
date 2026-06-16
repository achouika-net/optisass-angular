import * as fs from 'fs';
import * as readline from 'readline';

async function main() {
  const fileStream = fs.createReadStream('c:/Users/ASUS/.gemini/antigravity/playground/golden-cluster/backend/server.log');
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  console.log('Searching server.log for skipped/failed payment rows...');
  let lineCount = 0;
  let inSession = false;
  let lines: string[] = [];

  for await (const line of rl) {
    lineCount++;
    if (line.includes('Executing importPaiementsClients...')) {
      inSession = true;
      lines = [];
    }
    if (inSession) {
      lines.push(line);
      if (line.includes('Paiements clients import completed') || lines.length > 500) {
        inSession = false;
        // Search inside these lines for any mention of skipped, error, or specific amounts
        const skips = lines.filter(l => l.includes('Row') && (l.includes('non trouvé') || l.includes('non trouvée') || l.includes('skipped') || l.includes('failed') || l.includes('Error')));
        console.log(`=== Import Session ending at line ${lineCount} ===`);
        console.log(`Total lines in session: ${lines.length}`);
        console.log(`Skips/Errors count: ${skips.length}`);
        skips.slice(0, 30).forEach(s => console.log('  ' + s));
        if (skips.length > 30) console.log('  ... and more');
      }
    }
  }
}

main().catch(console.error);
