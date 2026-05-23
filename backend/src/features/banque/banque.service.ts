import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class BanqueService {
  constructor(private prisma: PrismaService) {}

  async createCompte(data: any) {
    return this.prisma.compteBancaire.create({ data });
  }

  async getComptes() {
    return this.prisma.compteBancaire.findMany({
      include: {
        releves: true
      }
    });
  }

  async getCompteById(id: string) {
    return this.prisma.compteBancaire.findUnique({
      where: { id },
      include: {
        releves: {
          include: { transactions: true }
        }
      }
    });
  }

  async importReleve(compteBancaireId: string, parsedData: any[]) {
    // Calcul date debut et fin Ã  partir des transactions
    if (!parsedData || parsedData.length === 0) return null;
    
    // Sort by date
    parsedData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    const dateDebut = new Date(parsedData[0].date);
    const dateFin = new Date(parsedData[parsedData.length - 1].date);
    
    const releve = await this.prisma.releveBancaire.create({
      data: {
        compteBancaireId,
        dateDebut,
        dateFin,
        soldeDebut: 0, // A calculer ou extraire si possible
        soldeFin: 0, // A calculer ou extraire
        statut: 'VALIDE'
      }
    });

    for (const item of parsedData) {
      await this.prisma.transactionBancaire.create({
        data: {
          releveBancaireId: releve.id,
          dateTransaction: new Date(item.date),
          description: item.description,
          type: item.type, // DEBIT ou CREDIT
          montant: Math.abs(item.montant),
          reference: item.reference || null,
          statutRapprochement: 'NON_RAPPROCHE',
          typeTransaction: this.guessTransactionType(item.description, item.type)
        }
      });
    }
    
    // Calcul variation solde
    let soldeVariation = 0;
    for (const item of parsedData) {
      soldeVariation += item.type === 'CREDIT' ? Math.abs(item.montant) : -Math.abs(item.montant);
    }
    await this.prisma.compteBancaire.update({
      where: { id: compteBancaireId },
      data: { soldeActuel: { increment: soldeVariation } }
    });

    // Auto-Rapprochement
    await this.autoRapprochement(releve.id);
    
    return releve;
  }
  
  guessTransactionType(description: string, type: string) {
    const desc = description.toLowerCase();
    if (desc.includes('agios') || desc.includes('frais') || desc.includes('timbre') || desc.includes('commission')) {
      return 'FRAIS_BANCAIRES';
    }
    if (desc.includes('cheque') || desc.includes('chq')) return 'CHEQUE';
    if (desc.includes('virement') || desc.includes('vir')) return 'VIREMENT';
    if (desc.includes('carte') || desc.includes('tpe')) return 'CARTE';
    return 'AUTRE';
  }

  async autoRapprochement(releveId: string) {
    const transactions = await this.prisma.transactionBancaire.findMany({
      where: { releveBancaireId: releveId, statutRapprochement: 'NON_RAPPROCHE' }
    });
    
    for (const t of transactions) {
      if (t.typeTransaction === 'FRAIS_BANCAIRES' && t.type === 'DEBIT') {
        // Auto-create a Depense for bank fees
        const releve = await this.prisma.releveBancaire.findUnique({ where: { id: t.releveBancaireId }, include: { compteBancaire: true } });
        if (!releve) continue;
        await this.prisma.depense.create({
          data: {
            date: t.dateTransaction,
            montant: t.montant,
            categorie: 'Frais Bancaires',
            description: t.description,
            modePaiement: 'Prelevement',
            statut: 'PAYE',
            centreId: releve.compteBancaire.centreId || (await this.prisma.centre.findFirst())?.id || '',
            transactionBancaireId: t.id
          }
        });
        await this.prisma.transactionBancaire.update({
          where: { id: t.id },
          data: { statutRapprochement: 'RAPPROCHE' }
        });
      } else if (t.type === 'CREDIT') {
        // Match payment
        const payments = await this.prisma.paiement.findMany({
          where: {
            statut: 'REMISE_EN_BANQUE',
            montant: t.montant,
            transactionBancaireId: null
          }
        });
        if (payments.length === 1) {
          await this.prisma.paiement.update({
            where: { id: payments[0].id },
            data: { statut: 'ENCAISSE', transactionBancaireId: t.id }
          });
          await this.prisma.transactionBancaire.update({
            where: { id: t.id },
            data: { statutRapprochement: 'RAPPROCHE' }
          });
        }
      }
    }
  }

  

  async deleteReleve(id: string) {
    const transactions = await this.prisma.transactionBancaire.findMany({ where: { releveBancaireId: id } });
    let soldeVariation = 0;
    for (const t of transactions) {
      soldeVariation += t.type === 'CREDIT' ? t.montant : -t.montant;
    }
    const releve = await this.prisma.releveBancaire.findUnique({ where: { id } });
    if (releve) {
      await this.prisma.compteBancaire.update({
        where: { id: releve.compteBancaireId },
        data: { soldeActuel: { decrement: soldeVariation } }
      });
      // Handle un-linking payments if any were rapproche
      // For simplicity, prisma Cascade handles deletion of transaction, but we must reset Paiement to REMISE_EN_BANQUE
      const matchedPaiements = await this.prisma.paiement.findMany({
        where: { transactionBancaire: { releveBancaireId: id } }
      });
      for (const p of matchedPaiements) {
        await this.prisma.paiement.update({
          where: { id: p.id },
          data: { statut: 'REMISE_EN_BANQUE', transactionBancaireId: null }
        });
      }
      
      // Delete Depenses created automatically
      await this.prisma.depense.deleteMany({
        where: { transactionBancaire: { releveBancaireId: id } }
      });

      await this.prisma.transactionBancaire.deleteMany({ where: { releveBancaireId: id } });
      return this.prisma.releveBancaire.delete({ where: { id } });
    }
    return null;
  }

  async getAllTransactions() {
    return this.prisma.transactionBancaire.findMany({
      include: { releveBancaire: { include: { compteBancaire: true } } },
      orderBy: { dateTransaction: 'desc' }
    });
  }

  async getTransactionsNonRapprochees() {
    const transactions = await this.prisma.transactionBancaire.findMany({
      where: { statutRapprochement: 'NON_RAPPROCHE' },
      include: { releveBancaire: { include: { compteBancaire: true } } }
    });
    const paiements = await this.prisma.paiement.findMany({
      where: { statut: 'REMISE_EN_BANQUE' }
    });
    const depenses = await this.prisma.depense.findMany({
      where: { statut: { not: 'PAYE' } }
    });
    return { transactions, paiements, depenses };
  }

  async validerRapprochement(data: { transactionId: string, typeMatched: string, matchedId?: string }) {
    await this.prisma.transactionBancaire.update({
      where: { id: data.transactionId },
      data: { statutRapprochement: 'RAPPROCHE' }
    });
    
    if (data.typeMatched === 'PAIEMENT' && data.matchedId) {
      await this.prisma.paiement.update({
        where: { id: data.matchedId },
        data: { statut: 'ENCAISSE', transactionBancaireId: data.transactionId }
      });
    } else if (data.typeMatched === 'DEPENSE' && data.matchedId) {
      await this.prisma.depense.update({
        where: { id: data.matchedId },
        data: { statut: 'PAYE', transactionBancaireId: data.transactionId }
      });
    }
    return { success: true };
  }
}

