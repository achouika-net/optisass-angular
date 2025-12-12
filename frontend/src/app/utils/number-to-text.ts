export function numberToFrench(num: number): string {
    if (num === 0) return 'zéro';
    const UNITS = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf'];
    const TEENS = ['dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
    const TENS = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante-dix', 'quatre-vingt', 'quatre-vingt-dix'];

    // Simplistic implementation for typical amounts
    // A robust library is better but sticking to strict user instructions and autonomous behavior without external networking for npm install if possible?
    // User environment has networking, but keeping it simple/no-deps is often safer. 
    // I'll implement a basic recursive version covering up to millions.

    const convertLessThanOneThousand = (n: number): string => {
        if (n === 0) return '';
        if (n < 10) return UNITS[n];
        if (n < 20) return TEENS[n - 10];
        if (n < 100) {
            const ten = Math.floor(n / 10);
            const remainder = n % 10;
            if (ten === 7 || ten === 9) {
                return TENS[ten - 1] + (remainder === 1 ? '-et-' : '-') + TEENS[remainder]; // 71 -> soixante-et-onze
            }
            return TENS[ten] + (remainder === 0 ? '' : (remainder === 1 && ten !== 8 ? '-et-' : '-') + UNITS[remainder]);
        }
        // Hundreds
        const hundred = Math.floor(n / 100);
        const rest = n % 100;
        let str = (hundred === 1 ? 'cent' : UNITS[hundred] + ' cent');
        if (hundred > 1 && rest === 0) str += 's'; // Deux cents
        if (rest > 0) str = (hundred === 1 ? 'cent' : UNITS[hundred] + ' cent') + ' ' + convertLessThanOneThousand(rest);
        return str;
    }

    // This is a quick implementation, ideally use a library like 'written-number'.
    // But for this task, I'll assume simple integers/decimals.

    // Fix 70-79, 90-99 and standard irregularities
    // Actually, let's use a simpler recursive component.

    const parts = [];
    let integerPart = Math.floor(num);
    const decimalPart = Math.round((num - integerPart) * 100); // 2 decimals

    if (integerPart === 0) parts.push('zéro');

    // Millions
    if (integerPart >= 1000000) {
        const millions = Math.floor(integerPart / 1000000);
        parts.push(convertLessThanOneThousand(millions) + (millions > 1 ? ' millions' : ' million'));
        integerPart %= 1000000;
    }

    // Thousands
    if (integerPart >= 1000) {
        const thousands = Math.floor(integerPart / 1000);
        if (thousands === 1) parts.push('mille');
        else parts.push(convertLessThanOneThousand(thousands) + ' mille');
        integerPart %= 1000;
    }

    if (integerPart > 0) {
        parts.push(convertLessThanOneThousand(integerPart));
    }

    let result = parts.join(' ');

    // Dirhams/Centimes
    result += ' Dirhams';

    if (decimalPart > 0) {
        result += ' et ' + convertLessThanOneThousand(decimalPart) + ' Centimes';
    }

    return result.charAt(0).toUpperCase() + result.slice(1);
}
