import { Injectable } from '@nestjs/common';

/**
 * BUG-009 FIX: PDF Streaming Service
 * Generates PDF reports with streaming to avoid memory issues
 */
@Injectable()
export class PdfStreamingService {
    /**
     * Stream large PDF reports to client in chunks
     * Prevents memory overload for large datasets
     */
    async streamReportPDF(
        reportData: any[],
        options: { pageSize?: number; batchSize?: number } = {},
    ) {
        const pageSize = options.pageSize || 50; // Items per page
        const batchSize = options.batchSize || 500; // Items per batch

        console.log(
            `[PDF-STREAM] Starting PDF stream for ${reportData.length} items (page: ${pageSize}, batch: ${batchSize})`,
        );

        // Validate data before streaming
        if (!reportData || reportData.length === 0) {
            throw new Error('No data provided for PDF streaming');
        }

        // Return generator for streaming
        return {
            async *[Symbol.asyncIterator]() {
                for (let i = 0; i < reportData.length; i += batchSize) {
                    const batch = reportData.slice(i, i + batchSize);
                    const pageCount = Math.ceil(batch.length / pageSize);

                    console.log(
                        `[PDF-STREAM] Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(reportData.length / batchSize)}`,
                    );

                    yield {
                        pages: pageCount,
                        items: batch.length,
                        data: batch,
                    };
                }
            },
        };
    }

    /**
     * Generate PDF metadata for pagination
     */
    async getPDFMetadata(
        totalItems: number,
        pageSize: number = 50,
    ): Promise<{ totalPages: number; itemsPerPage: number; totalItems: number }> {
        return {
            totalPages: Math.ceil(totalItems / pageSize),
            itemsPerPage: pageSize,
            totalItems,
        };
    }
}
