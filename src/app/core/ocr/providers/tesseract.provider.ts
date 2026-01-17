import { Injectable, OnDestroy } from '@angular/core';
import { createWorker, Worker, Block, Word } from 'tesseract.js';
import {
  IOcrEngine,
  IOcrResult,
  IOcrOptions,
  IOcrBlock,
  IOcrLine,
  IOcrWord,
} from '@optisaas/opti-saas-lib';

@Injectable()
export class TesseractProvider implements IOcrEngine, OnDestroy {
  readonly name = 'tesseract';

  #worker: Worker | null = null;
  #currentLanguage: string | null = null;

  readonly isAvailable = true;

  /**
   * Processes an image with Tesseract.js.
   * @param image Image file to process
   * @param options Processing options
   * @returns OCR result
   */
  async process(image: File, options?: IOcrOptions): Promise<IOcrResult> {
    const startTime = performance.now();
    const language = options?.language ?? 'fra';

    try {
      const worker = await this.#getOrCreateWorker(language);
      const { data } = await worker.recognize(image);

      return {
        rawText: data.text,
        confidence: data.confidence / 100,
        blocks: this.#mapBlocks(data.blocks),
        provider: this.name,
        processingTime: performance.now() - startTime,
      };
    } catch (error) {
      throw new Error(
        `Tesseract OCR failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Releases the Tesseract worker.
   */
  async dispose(): Promise<void> {
    if (this.#worker) {
      await this.#worker.terminate();
      this.#worker = null;
      this.#currentLanguage = null;
    }
  }

  ngOnDestroy(): void {
    this.dispose();
  }

  /**
   * Gets or creates a worker for the specified language.
   */
  async #getOrCreateWorker(language: string): Promise<Worker> {
    if (this.#worker && this.#currentLanguage !== language) {
      await this.dispose();
    }

    if (!this.#worker) {
      this.#worker = await createWorker(language);
      this.#currentLanguage = language;
    }

    return this.#worker;
  }

  /**
   * Converts Tesseract blocks to our format.
   */
  #mapBlocks(blocks: Block[]): IOcrBlock[] {
    if (!blocks) return [];

    return blocks.map((block) => ({
      text: block.text,
      confidence: block.confidence / 100,
      lines: this.#mapLines(block),
      boundingBox: block.bbox
        ? {
            x: block.bbox.x0,
            y: block.bbox.y0,
            width: block.bbox.x1 - block.bbox.x0,
            height: block.bbox.y1 - block.bbox.y0,
          }
        : null,
    }));
  }

  /**
   * Converts Tesseract lines to our format.
   */
  #mapLines(block: Block): IOcrLine[] {
    const lines: IOcrLine[] = [];

    block.paragraphs?.forEach((paragraph) => {
      paragraph.lines?.forEach((line) => {
        lines.push({
          text: line.text,
          confidence: line.confidence / 100,
          words: this.#mapWords(line.words),
          boundingBox: line.bbox
            ? {
                x: line.bbox.x0,
                y: line.bbox.y0,
                width: line.bbox.x1 - line.bbox.x0,
                height: line.bbox.y1 - line.bbox.y0,
              }
            : null,
        });
      });
    });

    return lines;
  }

  /**
   * Converts Tesseract words to our format.
   */
  #mapWords(words: Word[] | undefined): IOcrWord[] {
    if (!words) return [];

    return words.map((word) => ({
      text: word.text,
      confidence: word.confidence / 100,
      boundingBox: word.bbox
        ? {
            x: word.bbox.x0,
            y: word.bbox.y0,
            width: word.bbox.x1 - word.bbox.x0,
            height: word.bbox.y1 - word.bbox.y0,
          }
        : null,
    }));
  }
}
