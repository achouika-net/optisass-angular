const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');

function parseStyleToTailwind(styleStr) {
    styleStr = styleStr.toLowerCase().replace(/\s*:\s*/g, ':').replace(/\s*;\s*/g, ';').trim();
    if (styleStr.endsWith(';')) styleStr = styleStr.slice(0, -1);
    
    const directMatch = {
        'margin:20px 0': 'my-5',
        'margin:15px 0': 'my-4',
        'margin:10px 0': 'my-2.5',
        'width:100%': 'w-full',
        'color:red': 'text-red-500',
        'display:flex': 'flex',
        'display:none': 'hidden',
        'text-align:center': 'text-center',
        'text-align:right': 'text-right',
        'font-weight:bold': 'font-bold',
        'cursor:pointer': 'cursor-pointer',
        'display:block': 'block',
        'vertical-align:middle;margin-right:5px': 'align-middle mr-1',
        'color:#2e7d32;font-weight:500': 'text-green-800 font-medium',
        'color:green': 'text-green-500',
        'margin-top:10px': 'mt-2',
        'margin-bottom:10px': 'mb-2',
        'margin-top:20px': 'mt-5',
        'margin-bottom:20px': 'mb-5',
    };

    if (directMatch[styleStr]) return { classes: directMatch[styleStr], fallback: false };

    const rules = styleStr.split(';').filter(r => r);
    const classes = [];
    let needsFallback = false;

    for (const rule of rules) {
        const [prop, val] = rule.split(':');
        if (!prop || !val) continue;
        
        switch (prop) {
            case 'width': if (val === '100%') classes.push('w-full'); else classes.push(`w-[${val}]`); break;
            case 'height': if (val === '100%') classes.push('h-full'); else classes.push(`h-[${val}]`); break;
            case 'display':
                if (val === 'flex') classes.push('flex');
                else if (val === 'block') classes.push('block');
                else if (val === 'none') classes.push('hidden');
                else if (val === 'inline-block') classes.push('inline-block');
                else needsFallback = true;
                break;
            case 'text-align':
                if (val === 'center') classes.push('text-center');
                else if (val === 'left') classes.push('text-left');
                else if (val === 'right') classes.push('text-right');
                else needsFallback = true;
                break;
            case 'font-weight':
                if (val === 'bold' || val === '700') classes.push('font-bold');
                else if (val === '500') classes.push('font-medium');
                else if (val === 'normal') classes.push('font-normal');
                else needsFallback = true;
                break;
            case 'cursor': if (val === 'pointer') classes.push('cursor-pointer'); else needsFallback = true; break;
            case 'margin':
                if (val === '20px 0') classes.push('my-5');
                else if (val === '15px 0') classes.push('my-4');
                else if (val === '10px 0') classes.push('my-2');
                else if (val === '0') classes.push('m-0');
                else classes.push(`m-[${val}]`);
                break;
            case 'margin-top':
                if (val === '20px') classes.push('mt-5');
                else if (val === '10px') classes.push('mt-2.5');
                else if (val === '5px') classes.push('mt-1');
                else classes.push(`mt-[${val}]`);
                break;
            case 'margin-bottom':
                if (val === '20px') classes.push('mb-5');
                else if (val === '10px') classes.push('mb-2.5');
                else if (val === '5px') classes.push('mb-1');
                else classes.push(`mb-[${val}]`);
                break;
            case 'margin-right':
                if (val === '5px') classes.push('mr-1');
                else if (val === '10px') classes.push('mr-2.5');
                else classes.push(`mr-[${val}]`);
                break;
            case 'margin-left':
                if (val === '5px') classes.push('ml-1');
                else if (val === '10px') classes.push('ml-2.5');
                else classes.push(`ml-[${val}]`);
                break;
            case 'color':
                if (val === 'red') classes.push('text-red-500');
                else if (val === 'green') classes.push('text-green-500');
                else if (val === 'blue') classes.push('text-blue-500');
                else if (val === '#2e7d32') classes.push('text-green-800');
                else classes.push(`text-[${val}]`);
                break;
            case 'background-color':
            case 'background':
                if (val.startsWith('#') || val.startsWith('rgb')) classes.push(`bg-[${val}]`);
                else needsFallback = true;
                break;
            case 'font-size':
                if (val === '12px') classes.push('text-xs');
                else if (val === '14px') classes.push('text-sm');
                else if (val === '16px') classes.push('text-base');
                else if (val === '18px') classes.push('text-lg');
                else classes.push(`text-[${val}]`);
                break;
            case 'vertical-align':
                if (val === 'middle') classes.push('align-middle');
                else if (val === 'top') classes.push('align-top');
                else if (val === 'bottom') classes.push('align-bottom');
                else needsFallback = true;
                break;
            default:
                needsFallback = true;
        }
    }
    
    if (classes.length === 0) return null;
    return { classes: classes.join(' '), fallback: needsFallback };
}

function processDirectory(directory) {
    const files = fs.readdirSync(directory);
    
    for (const file of files) {
        const fullPath = path.join(directory, file);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
            processDirectory(fullPath);
        } else if (file.endsWith('.html')) {
            processHtmlFile(fullPath);
        }
    }
}

function processHtmlFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let originalContent = content;
    
    // We match HTML tags with style attributes
    // Use a function replacer to handle merging with existing class attributes
    const styleRegex = /<([a-zA-Z0-9\-]+)([^>]*)style="([^"]+)"([^>]*)>/gi;
    let count = 0;
    
    content = content.replace(styleRegex, (match, tag, beforeStyle, styleContent, afterStyle) => {
        const result = parseStyleToTailwind(styleContent);
        if (!result) return match; // skip if unmappable entirely
        
        count++;
        // Check if class attribute already exists in beforeStyle or afterStyle
        const classRegex = /class="([^"]*)"/i;
        let newMatch = match;
        
        if (classRegex.test(beforeStyle) || classRegex.test(afterStyle)) {
            // Append to existing class
            newMatch = newMatch.replace(classRegex, (classMatch, existingClasses) => {
                const sep = existingClasses.trim().length > 0 ? ' ' : '';
                return `class="${existingClasses}${sep}${result.classes}"`;
            });
            // Remove style attribute
            newMatch = newMatch.replace(/\s*style="[^"]*"/i, '');
        } else {
            // Create new class attribute, replace style with class
            newMatch = `<${tag}${beforeStyle}class="${result.classes}"${afterStyle}>`;
        }
        
        if (result.fallback) {
            console.warn(`[Partial mapping] in ${path.basename(filePath)}: "${styleContent}" -> "${result.classes}"`);
        }
        
        return newMatch;
    });
    
    if (content !== originalContent) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`✅ Updated ${count} styles in ${path.basename(filePath)}`);
    }
}

console.log('🚀 Starting style migration...');
processDirectory(srcDir);
console.log('🎉 Migration complete!');
