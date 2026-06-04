import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class BanqueService {
  constructor(private prisma: PrismaService) {}

  async createCompte(data: any) {
    // Ensure numeric fields are correctly formatted
    const formattedData = {
      nom: data.nom,
      banque: data.banque,
      numeroCompte: data.numeroCompte || null,
      type: data.type || 'STE',
      soldeInitial: typeof data.soldeInitial === 'number' ? data.soldeInitial : 0,
      soldeActuel: typeof data.soldeActuel === 'number' ? data.soldeActuel : 0,
      centreId: data.centreId || null
    };
    return this.prisma.compteBancaire.create({ data: formattedData });
  }

  async updateCompte(id: string, data: any) {
    const formattedData = {
      nom: data.nom,
      banque: data.banque,
      numeroCompte: data.numeroCompte || null,
      type: data.type || 'STE',
      soldeInitial: typeof data.soldeInitial === 'number' ? data.soldeInitial : undefined,
      soldeActuel: typeof data.soldeActuel === 'number' ? data.soldeActuel : undefined,
      centreId: data.centreId || undefined
    };
    return this.prisma.compteBancaire.update({
      where: { id },
      data: formattedData
    });
  }

  async deleteCompte(id: string) {
    // Manually delete all associated statements (releves) in cascade first
    const releves = await this.prisma.releveBancaire.findMany({
      where: { compteBancaireId: id }
    });
    for (const rel of releves) {
      await this.deleteReleve(rel.id);
    }
    // Now delete the bank account safely
    return this.prisma.compteBancaire.delete({
      where: { id }
    });
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

  async importReleve(parsedResult: any, compteBancaireId?: string) {
    const { transactions: parsedData, detectedAccountInfo } = parsedResult;
    if (!parsedData || parsedData.length === 0) return null;

    let finalCompteId = compteBancaireId;
    let autoCreated = false;

    // Si on n'a pas forcé de compteId, on essaie de détecter ou créer
    if (!finalCompteId && detectedAccountInfo && detectedAccountInfo.rib) {
      const rib = detectedAccountInfo.rib;
      let existingCompte = await this.prisma.compteBancaire.findFirst({
        where: { numeroCompte: { contains: rib } }
      });

      if (!existingCompte) {
        // Auto-création
        existingCompte = await this.prisma.compteBancaire.create({
          data: {
            nom: detectedAccountInfo.bankName || 'Nouveau compte détecté',
            banque: detectedAccountInfo.bankName || 'Banque inconnue',
            numeroCompte: rib,
            type: 'STE',
            soldeInitial: 0,
            soldeActuel: 0
          }
        });
        autoCreated = true;

        // Synchroniser avec CompanySettings si vide
        const settings = await this.prisma.companySettings.findFirst();
        if (settings && !settings.rib) {
          await this.prisma.companySettings.update({
            where: { id: settings.id },
            data: { rib: rib, bank: detectedAccountInfo.bankName || 'Banque inconnue' }
          });
        }
      }
      finalCompteId = existingCompte.id;
    }

    if (!finalCompteId) {
      const allComptes = await this.prisma.compteBancaire.findMany();
      if (allComptes.length === 1) {
        finalCompteId = allComptes[0].id;
      } else if (allComptes.length > 1) {
        throw new BadRequestException("Impossible d'associer ce releve automatiquement (plusieurs comptes existants et aucun RIB detecte). Veuillez selectionner le compte manuellement.");
      } else {
        throw new BadRequestException("Impossible d'associer ce releve a un compte (aucun compte existant et aucun RIB detecte pour la creation automatique).");
      }
    }
    
    // Sort by date
    parsedData.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    const dateDebut = new Date(parsedData[0].date);
    const dateFin = new Date(parsedData[parsedData.length - 1].date);
    
    const releve = await this.prisma.releveBancaire.create({
      data: {
        compteBancaireId: finalCompteId,
        dateDebut,
        dateFin,
        soldeDebut: 0,
        soldeFin: 0,
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
      where: { id: finalCompteId },
      data: { soldeActuel: { increment: soldeVariation } }
    });

    // Auto-Rapprochement
    await this.autoRapprochement(releve.id);
    
    return { releve, autoCreated, finalCompteId, nbTransactions: parsedData.length };
  }
  
  guessTransactionType(description: string, type: string) {
    const desc = description.toLowerCase();
    if (desc.includes('agios') || desc.includes('frais') || desc.includes('timbre') || desc.includes('commission') || desc.includes('operation au debit') || desc.includes('au debit')) {
      return 'FRAIS_BANCAIRES';
    }
    if (desc.includes('cheque') || desc.includes('chq')) return 'CHEQUE';
    if (desc.includes('virement') || desc.includes('vir.') || desc.includes('vir ')) return 'VIREMENT';
    if (desc.includes('carte') || desc.includes('tpe') || desc.includes('/cb ') || desc.includes(' cb ') || desc.includes('paiment/cb') || desc.includes('cd cmi') || desc.includes('cd ap') || desc.includes('cmi')) {
      return 'CARTE';
    }
    if (desc.includes('lcn') || desc.includes('effet')) return 'LCN';
    if (desc.includes('prelevement') || desc.includes('prlv')) return 'PRELEVEMENT';
    if (desc.includes('versement') || desc.includes('espece')) return 'ESPECES';
    
    // Auto mobile application payment mapping
    if (desc.includes('paiement') || desc.includes('paiment')) {
      return 'APPLICATION_MOBILE';
    }
    return 'AUTRE';
  }

  async autoRapprochement(releveId: string) {
    const releve = await this.prisma.releveBancaire.findUnique({
      where: { id: releveId }
    });
    if (releve) {
      await this.runAutoRapprochement(releve.compteBancaireId);
    }
  }

  async runAutoRapprochement(compteBancaireId?: string) {
    const whereClause: any = { statutRapprochement: 'NON_RAPPROCHE' };
    if (compteBancaireId) {
      whereClause.releveBancaire = { compteBancaireId };
    }
    const transactions = await this.prisma.transactionBancaire.findMany({
      where: whereClause,
      include: { releveBancaire: true }
    });

    let matchedCount = 0;

    const isReferenceMatch = (desc: string, ref: string): boolean => {
      if (!ref || !desc) return false;
      const cleanDesc = desc.replace(/[\s\-_]/g, '').toLowerCase();
      const cleanRef = ref.replace(/[\s\-_]/g, '').toLowerCase();
      if (cleanDesc.includes(cleanRef) || cleanRef.includes(cleanDesc)) return true;
      const refNoZeros = cleanRef.replace(/^0+/, '');
      if (refNoZeros.length >= 4 && cleanDesc.includes(refNoZeros)) return true;
      return false;
    };

    for (const t of transactions) {
      if (t.typeTransaction === 'FRAIS_BANCAIRES' && t.type === 'DEBIT') {
        const releve = await this.prisma.releveBancaire.findUnique({
          where: { id: t.releveBancaireId },
          include: { compteBancaire: true }
        });
        if (!releve) continue;
        
        const existingFee = await this.prisma.depense.findFirst({
          where: { transactionBancaireId: t.id }
        });
        if (!existingFee) {
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
        }
        await this.prisma.transactionBancaire.update({
          where: { id: t.id },
          data: { statutRapprochement: 'RAPPROCHE' }
        });
        matchedCount++;
        continue;
      }

      if (t.type === 'CREDIT') {
        const payments = await this.prisma.paiement.findMany({
          where: {
            statut: { in: ['REMIS_EN_BANQUE', 'EN_ATTENTE'] },
            transactionBancaireId: null
          }
        });

        let matchedPayment = payments.find(p => 
          Math.abs(p.montant - t.montant) < 0.05 && p.reference && isReferenceMatch(t.description, p.reference)
        );

        if (!matchedPayment) {
          const amtMatches = payments.filter(p => Math.abs(p.montant - t.montant) < 0.05);
          if (amtMatches.length === 1) {
            matchedPayment = amtMatches[0];
          }
        }

        if (matchedPayment) {
          await this.prisma.paiement.update({
            where: { id: matchedPayment.id },
            data: { statut: 'ENCAISSE', transactionBancaireId: t.id }
          });
          await this.prisma.transactionBancaire.update({
            where: { id: t.id },
            data: { statutRapprochement: 'RAPPROCHE' }
          });
          matchedCount++;
        }
      }

      if (t.type === 'DEBIT') {
        const echeances = await this.prisma.echeancePaiement.findMany({
          where: { statut: { in: ['REMIS_EN_BANQUE', 'EN_ATTENTE', 'VALIDEE'] } }
        });

        const depenses = await this.prisma.depense.findMany({
          where: {
            statut: { in: ['REMIS_EN_BANQUE', 'EN_ATTENTE', 'VALIDEE'] },
            transactionBancaireId: null,
            modePaiement: {
              notIn: ['ESPECES', 'Liquide', 'LIQUIDE', 'CASH', 'Especes', 'Caisse', 'CAISSE']
            }
          }
        });

        let matchedEcheance = echeances.find(e => 
          Math.abs(e.montant - t.montant) < 0.05 && e.reference && isReferenceMatch(t.description, e.reference)
        );

        if (matchedEcheance) {
          await this.prisma.echeancePaiement.update({
            where: { id: matchedEcheance.id },
            data: { statut: 'ENCAISSE', dateEncaissement: t.dateTransaction }
          });

          const linkedDepense = await this.prisma.depense.findFirst({
            where: { echeanceId: matchedEcheance.id }
          });
          if (linkedDepense) {
            await this.prisma.depense.update({
              where: { id: linkedDepense.id },
              data: { statut: 'PAYE', transactionBancaireId: t.id }
            });
          }

          await this.prisma.transactionBancaire.update({
            where: { id: t.id },
            data: { statutRapprochement: 'RAPPROCHE' }
          });
          matchedCount++;
          continue;
        }

        let matchedDepense = depenses.find(d => 
          Math.abs(d.montant - t.montant) < 0.05 && d.reference && isReferenceMatch(t.description, d.reference)
        );

        if (matchedDepense) {
          await this.prisma.depense.update({
            where: { id: matchedDepense.id },
            data: { statut: 'PAYE', transactionBancaireId: t.id }
          });

          if (matchedDepense.echeanceId) {
            await this.prisma.echeancePaiement.update({
              where: { id: matchedDepense.echeanceId },
              data: { statut: 'ENCAISSE', dateEncaissement: t.dateTransaction }
            });
          }

          await this.prisma.transactionBancaire.update({
            where: { id: t.id },
            data: { statutRapprochement: 'RAPPROCHE' }
          });
          matchedCount++;
          continue;
        }

        const amtEchMatches = echeances.filter(e => Math.abs(e.montant - t.montant) < 0.05);
        const amtDepMatches = depenses.filter(d => Math.abs(d.montant - t.montant) < 0.05);

        if (amtEchMatches.length === 1 && amtDepMatches.length === 0) {
          const matchedE = amtEchMatches[0];
          await this.prisma.echeancePaiement.update({
            where: { id: matchedE.id },
            data: { statut: 'ENCAISSE', dateEncaissement: t.dateTransaction }
          });
          const linkedDepense = await this.prisma.depense.findFirst({
            where: { echeanceId: matchedE.id }
          });
          if (linkedDepense) {
            await this.prisma.depense.update({
              where: { id: linkedDepense.id },
              data: { statut: 'PAYE', transactionBancaireId: t.id }
            });
          }
          await this.prisma.transactionBancaire.update({
            where: { id: t.id },
            data: { statutRapprochement: 'RAPPROCHE' }
          });
          matchedCount++;
        } else if (amtDepMatches.length === 1 && amtEchMatches.length === 0) {
          const matchedD = amtDepMatches[0];
          await this.prisma.depense.update({
            where: { id: matchedD.id },
            data: { statut: 'PAYE', transactionBancaireId: t.id }
          });
          if (matchedD.echeanceId) {
            await this.prisma.echeancePaiement.update({
              where: { id: matchedD.echeanceId },
              data: { statut: 'ENCAISSE', dateEncaissement: t.dateTransaction }
            });
          }
          await this.prisma.transactionBancaire.update({
            where: { id: t.id },
            data: { statutRapprochement: 'RAPPROCHE' }
          });
          matchedCount++;
        }
      }
    }

    return { matchedCount };
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
      const matchedPaiements = await this.prisma.paiement.findMany({
        where: { transactionBancaire: { releveBancaireId: id } }
      });
      for (const p of matchedPaiements) {
        await this.prisma.paiement.update({
          where: { id: p.id },
          data: { statut: 'REMIS_EN_BANQUE', transactionBancaireId: null }
        });
      }

      // Rétablir les dépenses manuelles rapprochées
      const matchedDepenses = await this.prisma.depense.findMany({
        where: {
          transactionBancaire: { releveBancaireId: id },
          categorie: { not: 'Frais Bancaires' }
        }
      });
      for (const d of matchedDepenses) {
        await this.prisma.depense.update({
          where: { id: d.id },
          data: { statut: 'REMIS_EN_BANQUE', transactionBancaireId: null }
        });
          // Synchroniser l'echeance liee
          if (d.echeanceId) {
            await this.prisma.echeancePaiement.update({
              where: { id: d.echeanceId },
              data: { statut: 'REMIS_EN_BANQUE', dateEncaissement: null }
            });
          }
      }
      
      // Supprimer uniquement les frais bancaires générés automatiquement
      await this.prisma.depense.deleteMany({
        where: {
          transactionBancaire: { releveBancaireId: id },
          categorie: 'Frais Bancaires'
        }
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
      where: {
        OR: [
          { statut: 'REMIS_EN_BANQUE' },
          // Include CARTE payments that are ENCAISSE but not yet linked to a bank transaction
          { statut: 'ENCAISSE', mode: { in: ['CARTE', 'CARTE_BANCAIRE', 'CB', 'TPE'] }, transactionBancaireId: null }
        ]
      }
    });

    // 1. Get raw expenses eligible for manual bank reconciliation (non-cash, not already linked)
    const directDepenses = await this.prisma.depense.findMany({
      where: {
        statut: { in: ['REMIS_EN_BANQUE', 'EN_ATTENTE', 'A_PAYER', 'VALIDEE'] },
        transactionBancaireId: null,
        modePaiement: {
          notIn: ['ESPECES', 'Liquide', 'LIQUIDE', 'CASH', 'Especes', 'Prelevement', 'PRELEVEMENT', 'Caisse', 'CAISSE']
        }
      },
      include: { fournisseur: true }
    });

    // 2. Get active echeances (installments/scheduled payments) linked to supplier invoices or BLs
    // that represent a DEBIT (outgoing flow)
    const echeances = await this.prisma.echeancePaiement.findMany({
      where: {
        statut: { in: ['REMIS_EN_BANQUE', 'EN_ATTENTE'] },
        type: {
          notIn: ['ESPECES', 'Liquide', 'LIQUIDE', 'CASH', 'Especes', 'Espèces', 'ESPÈCES', 'Caisse', 'CAISSE']
        }
      },
      include: {
        factureFournisseur: { include: { fournisseur: true } },
        bonLivraison: { include: { fournisseur: true } }
      }
    });

    // Combine both: map echeances as virtual depenses so the frontend can display and match them seamlessly
    const mappedEcheances = echeances.map(e => ({
      id: e.id, // Using echeanceId as primary matched ID
      isEcheance: true,
      date: e.dateEcheance,
      montant: e.montant,
      categorie: e.factureFournisseur ? 'Facture Fournisseur' : 'Bon de Livraison',
      description: `Échéance ${e.reference || ''} (${e.type})`.trim(),
      modePaiement: e.type,
      statut: e.statut,
      reference: e.reference,
      fournisseur: e.factureFournisseur?.fournisseur || e.bonLivraison?.fournisseur || null,
      factureFournisseurId: e.factureFournisseurId,
      bonLivraisonId: e.bonLivraisonId,
      echeanceId: e.id
    }));

    const combinedDepenses = [
      ...directDepenses,
      ...mappedEcheances
    ];

    return { transactions, paiements, depenses: combinedDepenses };
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
      // Check if this matchedId is an echeance or a depense
      const isEcheance = await this.prisma.echeancePaiement.findUnique({
        where: { id: data.matchedId }
      });

      if (isEcheance) {
        // Matched target is an echeance (Installment)
        await this.prisma.echeancePaiement.update({
          where: { id: data.matchedId },
          data: { statut: 'ENCAISSE', dateEncaissement: new Date() }
        });

        // If there's a linked Depense, mark it as PAYE
        const linkedDepense = await this.prisma.depense.findFirst({
          where: { echeanceId: data.matchedId }
        });
        if (linkedDepense) {
          await this.prisma.depense.update({
            where: { id: linkedDepense.id },
            data: { statut: 'PAYE', transactionBancaireId: data.transactionId }
          });
        }
      } else {
        // Matched target is a standard direct Depense
        await this.prisma.depense.update({
          where: { id: data.matchedId },
          data: { statut: 'PAYE', transactionBancaireId: data.transactionId }
        });
        
        // Synchroniser l'echeance liee si elle existe
        const matchedDep = await this.prisma.depense.findUnique({ where: { id: data.matchedId } });
        if (matchedDep?.echeanceId) {
          await this.prisma.echeancePaiement.update({
            where: { id: matchedDep.echeanceId },
            data: { statut: 'ENCAISSE', dateEncaissement: new Date() }
          });
        }
      }
    }
    return { success: true };
  }
}

