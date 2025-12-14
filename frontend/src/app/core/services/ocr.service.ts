import { Injectable } from '@angular/core';
import { createWorker } from 'tesseract.js';

@Injectable({
    providedIn: 'root'
})
export class OcrService {

    constructor() { }

    async recognizeText(imageUrl: string): Promise<string> {
        try {
            const worker = await createWorker('fra'); // French language
            const ret = await worker.recognize(imageUrl);
            const text = ret.data.text;
            await worker.terminate();
            return text;
        } catch (error) {
            console.error('OCR Error:', error);
            return '';
        }
    }
}
