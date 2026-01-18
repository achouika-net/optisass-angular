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

/**
 * Maximum number of workers to keep in the pool.
 * Prevents memory issues with too many language workers.
 */
const MAX_POOL_SIZE = 3;

@Injectable()
export class TesseractProvider implements IOcrEngine, OnDestroy {
  readonly name = 'tesseract';
  readonly isAvailable = true;

  /**
   * Pool of workers indexed by language code.
   * Reuses workers for the same language instead of recreating.
   */
  readonly #workerPool = new Map<string, Worker>();

  /**
   * Track language access order for LRU eviction.
   */
  readonly #accessOrder: string[] = [];

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
      const worker = await this.#getWorker(language);
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
   * Releases all Tesseract workers.
   */
  async dispose(): Promise<void> {
    const workers = Array.from(this.#workerPool.values());
    await Promise.all(workers.map((worker) => worker.terminate()));
    this.#workerPool.clear();
    this.#accessOrder.length = 0;
  }

  ngOnDestroy(): void {
    this.dispose();
  }

  /**
   * Gets a worker for the specified language from pool or creates a new one.
   */
  async #getWorker(language: string): Promise<Worker> {
    let worker = this.#workerPool.get(language);

    if (worker) {
      this.#updateAccessOrder(language);
      return worker;
    }

    if (this.#workerPool.size >= MAX_POOL_SIZE) {
      await this.#evictLeastRecentlyUsed();
    }

    worker = await createWorker(language);
    this.#workerPool.set(language, worker);
    this.#updateAccessOrder(language);

    return worker;
  }

  /**
   * Updates the access order for LRU tracking.
   */
  #updateAccessOrder(language: string): void {
    const index = this.#accessOrder.indexOf(language);
    if (index !== -1) {
      this.#accessOrder.splice(index, 1);
    }
    this.#accessOrder.push(language);
  }

  /**
   * Evicts the least recently used worker from the pool.
   */
  async #evictLeastRecentlyUsed(): Promise<void> {
    if (this.#accessOrder.length === 0) return;

    const lruLanguage = this.#accessOrder.shift();
    if (lruLanguage) {
      const worker = this.#workerPool.get(lruLanguage);
      if (worker) {
        await worker.terminate();
        this.#workerPool.delete(lruLanguage);
      }
    }
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
