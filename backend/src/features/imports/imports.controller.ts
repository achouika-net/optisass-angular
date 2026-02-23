import {
    Controller,
    Post,
    UseInterceptors,
    UploadedFile,
    Body,
    BadRequestException
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ImportsService } from './imports.service';
import { Express } from 'express';
import * as multer from 'multer';
import { ExecuteImportDto } from './dto/execute-import.dto';

@Controller('imports')
export class ImportsController {
    constructor(private readonly importsService: ImportsService) { }

    @Post('upload')
    @UseInterceptors(FileInterceptor('file', {
        storage: multer.memoryStorage(),
    }))
    async uploadFile(@UploadedFile() file: any) {
        const fs = require('fs');
        const log = (msg) => fs.appendFileSync('import_debug.log', new Date().toISOString() + ' ' + msg + '\n');

        log('Upload request received');
        if (!file) {
            log('No file in request');
            throw new BadRequestException('No file uploaded');
        }
        log(`File received: ${file.originalname}, Size: ${file.size}, Mimetype: ${file.mimetype}`);
        try {
            const result = await this.importsService.parseFile(file.buffer);
            log('File parsed successfully');
            log('Result structure: ' + JSON.stringify({
                hasHeaders: !!result.headers,
                headersCount: result.headers?.length || 0,
                hasData: !!result.data,
                dataCount: result.data?.length || 0,
                hasPreview: !!result.preview,
                previewCount: result.preview?.length || 0,
                resultKeys: Object.keys(result)
            }));
            log('First 3 headers: ' + JSON.stringify(result.headers?.slice(0, 3)));
            return result;
        } catch (error) {
            log('Error parsing file: ' + JSON.stringify(error));
            throw error;
        }
    }

    @Post('execute')
    async executeImport(@Body() body: ExecuteImportDto) {
        console.log('📥 EXECUTE IMPORT REQUEST RECEIVED');
        console.log('Type:', body.type);
        console.log('Data Rows:', body.data?.length);
        console.log('Mapping Keys:', body.mapping ? Object.keys(body.mapping) : 'NONE');

        const fs = require('fs');
        const log = (msg) => {
            const timestamp = new Date().toISOString();
            console.log(`[ImportLog] ${msg}`);
            try {
                fs.appendFileSync('import_execute.log', `${timestamp} ${msg}\n`);
                fs.appendFileSync('import_debug.log', `${timestamp} ${msg}\n`);
            } catch (e) {
                console.error('Failed to write to log file:', e.message);
            }
        };

        log(`Execute import request START: Type=${body.type}, DataRows=${body.data?.length}`);

        if (!body.data || !Array.isArray(body.data)) {
            log('Error: Invalid or missing data array');
            throw new BadRequestException('Invalid or missing data array');
        }

        const data: any[] = body.data;
        const mapping = body.mapping || {};

        try {
            if (body.type === 'clients') {
                log('Executing importClients...');
                const res = await this.importsService.importClients(data, mapping, body.centreId);
                log('Client import completed successfully');
                return res;
            } else if (body.type === 'products') {
                log('Executing importProducts...');
                if (!body.warehouseId) {
                    log('Error: Warehouse ID missing');
                    throw new BadRequestException('Warehouse ID is required for product import');
                }
                const res = await this.importsService.importProducts(data, mapping, body.warehouseId);
                log('Product import completed successfully');
                return res;
            } else if (body.type && typeof body.type === 'string' && body.type.startsWith('fiches')) {
                log(`Executing importFiches (${body.type})...`);
                const res = await this.importsService.importFiches(data, mapping, body.centreId, body.type);
                log(`Fiches import completed: ${JSON.stringify({
                    success: res.success,
                    skipped: res.skipped,
                    failed: res.failed,
                    errorCount: res.errors?.length
                })}`);
                return res;
            } else if (body.type === 'fournisseurs') {
                log('Executing importFournisseurs...');
                const res = await this.importsService.importFournisseurs(data, mapping);
                log('Fournisseurs import completed successfully');
                return res;
            } else if (body.type === 'factures_fournisseurs') {
                log('Executing importFacturesFournisseurs...');
                const res = await this.importsService.importFacturesFournisseurs(data, mapping, body.centreId, body.isBL);
                log('Factures fournisseurs import completed successfully');
                return res;
            } else if (body.type === 'paiements_fournisseurs') {
                log('Executing importPaiementsFournisseurs...');
                const res = await this.importsService.importPaiementsFournisseurs(data, mapping);
                log('Paiements fournisseurs import completed successfully');
                return res;
            } else if (body.type === 'factures_ventes') {
                log('Executing importFacturesVentes...');
                const res = await this.importsService.importFacturesVentes(data, mapping, body.centreId);
                log('Factures ventes import completed successfully');
                return res;
            } else if (body.type === 'paiements_clients') {
                log('Executing importPaiementsClients...');
                const res = await this.importsService.importPaiementsClients(data, mapping);
                log('Paiements clients import completed successfully');
                return res;
            } else if (body.type === 'depenses') {
                log('Executing importDepenses...');
                const res = await this.importsService.importDepenses(data, mapping, body.centreId);
                log('Depenses import completed successfully');
                return res;
            }

            log(`Error: Invalid import type detected: "${body.type}" (Type: ${typeof body.type})`);
            throw new BadRequestException('Invalid import type');
        } catch (error) {
            log('Error executing import: ' + error.message);
            console.error('Import Execution Error:', error);
            throw error;
        }
    }
}

