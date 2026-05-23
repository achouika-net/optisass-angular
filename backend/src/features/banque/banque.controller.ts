import { Controller, Get, Post, Delete, Body, Param, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { BanqueService } from './banque.service';
import { ReleveParserService } from './releve-parser.service';
import { extname } from 'path';

@Controller('banque')
export class BanqueController {
  constructor(
    private readonly banqueService: BanqueService,
    private readonly releveParser: ReleveParserService
  ) {}

  @Post('comptes')
  createCompte(@Body() data: any) {
    return this.banqueService.createCompte(data);
  }

  @Get('comptes')
  getComptes() {
    return this.banqueService.getComptes();
  }

  @Get('comptes/:id')
  getCompteById(@Param('id') id: string) {
    return this.banqueService.getCompteById(id);
  }

  @Post('releves/import')
  @UseInterceptors(FileInterceptor('file'))
  async importReleve(@UploadedFile() file: Express.Multer.File, @Body('compteId') compteId: string) {
    const ext = extname(file.originalname).toLowerCase();
    let transactions: any[] = [];
    
    if (ext === '.csv' || ext === '.xlsx' || ext === '.xls') {
      transactions = await this.releveParser.parseExcel(file.buffer);
    } else if (ext === '.pdf') {
      transactions = await this.releveParser.parsePdf(file.buffer);
    } else {
      throw new Error('Format non supporté');
    }
    
    return this.banqueService.importReleve(compteId, transactions);
  }




  @Post('releves/debug-pdf')
  @UseInterceptors(FileInterceptor('file'))
  async debugPdf(@UploadedFile() file: Express.Multer.File) {
    const pdf = require('pdf-parse');
    const data = await pdf(file.buffer);
    const lines = data.text.split('\n');
    return {
      numPages: data.numpages,
      totalLines: lines.length,
      rawLines: lines.map((l, i) => ({ lineNum: i + 1, text: l.trim() })).filter(l => l.text.length > 0),
      parsedTransactions: await this.releveParser.parsePdf(file.buffer)
    };
  }

  @Delete('releves/:id')
  deleteReleve(@Param('id') id: string) {
    return this.banqueService.deleteReleve(id);
  }

  @Get('transactions')
  getAllTransactions() {
    return this.banqueService.getAllTransactions();
  }

  @Get('rapprochement')
  getRapprochementData() {
    return this.banqueService.getTransactionsNonRapprochees();
  }

  @Post('rapprochement/valider')
  validerRapprochement(@Body() data: { transactionId: string, typeMatched: string, matchedId?: string }) {
    return this.banqueService.validerRapprochement(data);
  }
}
