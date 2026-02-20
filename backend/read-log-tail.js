
const fs = require('fs');
const readline = require('readline');

async function tail(filePath, numLines) {
    if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        return;
    }

    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    const lines = [];
    for await (const line of rl) {
        lines.push(line);
        if (lines.length > numLines * 5) { // Keep buffer reasonable but larger than target
            lines.shift();
        }
    }

    // Output only last N lines
    const start = Math.max(0, lines.length - numLines);
    for (let i = start; i < lines.length; i++) {
        const line = lines[i];
        try {
            const jsonStart = line.indexOf('{');
            const jsonEnd = line.lastIndexOf('}');
            if (jsonStart !== -1 && jsonEnd !== -1) {
                const jsonStr = line.substring(jsonStart, jsonEnd + 1);
                const obj = JSON.parse(jsonStr);
                console.log(`\n--- Log Line ${i} ---`);
                console.log(line.substring(0, jsonStart)); // Log prefix
                console.log(JSON.stringify(obj, null, 2)); // Unknown columns might be here
            } else {
                console.log(line);
            }
        } catch (e) {
            console.log(line);
        }
    }
}

tail('./skipped_rows.log', 20); // Check last 20 to see samples
