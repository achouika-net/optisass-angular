import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCommissionRuleDto } from './dto/create-commission-rule.dto';
import { UpdateCommissionRuleDto } from './dto/update-commission-rule.dto';

@Injectable()
export class CommissionService {
  constructor(private prisma: PrismaService) {}

  async createRule(dto: CreateCommissionRuleDto) {
    return this.prisma.commissionRule.create({ data: dto });
  }

  async getRules(centreId?: string) {
    return this.prisma.commissionRule.findMany({
      where: centreId ? { centreId } : {},
    });
  }

  async updateRule(id: string, dto: UpdateCommissionRuleDto) {
    return this.prisma.commissionRule.update({
      where: { id },
      data: dto,
    });
  }

  async deleteRule(id: string) {
    return this.prisma.commissionRule.delete({
      where: { id },
    });
  }

  async deleteRulesByPoste(poste: string) {
    return this.prisma.commissionRule.deleteMany({
      where: { poste },
    });
  }

  async upsertBulkRules(rules: any[]) {
    return this.prisma.$transaction(async (tx) => {
      const results: any[] = [];
      for (const rule of rules) {
        // Find existing rule for this poste, typeProduit, and centreId
        const existing = await tx.commissionRule.findFirst({
          where: {
            poste: rule.poste,
            typeProduit: rule.typeProduit,
            centreId: rule.centreId || null,
          },
        });

        if (existing) {
          const updated = await tx.commissionRule.update({
            where: { id: existing.id },
            data: { taux: rule.taux },
          });
          results.push(updated);
        } else {
          const created = await tx.commissionRule.create({
            data: {
              poste: rule.poste,
              typeProduit: rule.typeProduit,
              taux: rule.taux,
              centreId: rule.centreId || null,
            },
          });
          results.push(created);
        }
      }
      return results;
    });
  }

  async getConfig() {
    let config = await this.prisma.commissionConfig.findFirst();
    if (!config) {
      config = await this.prisma.commissionConfig.create({
        data: {
          triggerType: 'FACTURE',
          paymentCondition: 'SOLDE',
          paymentConditionFacture: 'SOLDE',
        },
      });
    }
    return config;
  }

  async updateConfig(dto: {
    triggerType?: string;
    paymentCondition?: string;
    paymentConditionFacture?: string;
  }) {
    const config = await this.getConfig();
    return this.prisma.commissionConfig.update({
      where: { id: config.id },
      data: dto,
    });
  }

  /**
   * Calculates commissions for a specific fiche (BC).
   */
  async calculateForFiche(ficheId: string, tx?: any) {
    const prisma = tx || this.prisma;
    const config = await this.getConfig();

    // If config says trigger on FACTURE, we don't calculate on Fiche unless explicitly called
    if (config.triggerType !== 'BC') return null;

    const fiche = await prisma.fiche.findUnique({
      where: { id: ficheId },
      include: { vendeur: true },
    });

    if (!fiche || !fiche.vendeurId || !fiche.vendeur) return null;

    // Payment condition check
    if (
      config.paymentCondition === 'SOLDE' &&
      fiche.montantPaye < fiche.montantTotal
    )
      return null;
    if (config.paymentCondition === 'PARTIEL' && fiche.montantPaye <= 0)
      return null;

    const employee = fiche.vendeur;
    const mois = fiche.dateCreation.toISOString().substring(0, 7);

    // Get rules
    const rules = await prisma.commissionRule.findMany({
      where: {
        poste: employee.poste,
        OR: [{ centreId: null }], // Can be extended for center-specific rules
      },
    });

    const lines =
      typeof fiche.content === 'string'
        ? JSON.parse(fiche.content)
        : fiche.content.lignes || [];
    if (!Array.isArray(lines)) return null;

    return this.processLines(
      lines,
      employee,
      null,
      fiche.id,
      mois,
      rules,
      prisma,
    );
  }

  /**
   * Calculates commissions for a specific invoice.
   */
  async calculateForInvoice(factureId: string, tx?: any) {
    const prisma = tx || this.prisma;
    const config = await this.getConfig();

    const facture = await prisma.facture.findUnique({
      where: { id: factureId },
      include: { vendeur: true },
    });

    if (!facture || !facture.vendeurId || !facture.vendeur) return null;

    // If config says trigger on BC, we might want to skip Invoice to avoid duplicates
    // unless the Invoice is the only place where final amounts are known.
    // For now, let's respect the triggerType.
    if (config.triggerType === 'BC') {
      console.log(
        `[COMMISSION] Skipping Invoice ${factureId} because trigger is set to BC`,
      );
      return null;
    }

    // Payment condition check
    if (
      config.paymentCondition === 'SOLDE' &&
      !['VALIDE', 'PAYEE', 'SOLDEE'].includes(facture.statut)
    )
      return null;
    if (
      config.paymentCondition === 'PARTIEL' &&
      !['VALIDE', 'PAYEE', 'SOLDEE', 'PARTIEL'].includes(facture.statut)
    )
      return null;

    if (!isFinite(facture.totalHT) || facture.totalHT <= 0) return null;

    const employee = facture.vendeur;
    const mois = facture.dateEmission.toISOString().substring(0, 7);

    const rules = await prisma.commissionRule.findMany({
      where: {
        poste: employee.poste,
        OR: [{ centreId: facture.centreId }, { centreId: null }],
      },
    });

    const lines =
      typeof facture.lignes === 'string'
        ? JSON.parse(facture.lignes)
        : (facture.lignes as any[]);
    if (!Array.isArray(lines)) return null;

    return this.processLines(
      lines,
      employee,
      facture.id,
      null,
      mois,
      rules,
      prisma,
    );
  }

  private async processLines(
    lines: any[],
    employee: any,
    factureId: string | null,
    ficheId: string | null,
    mois: string,
    rules: any[],
    prisma: any,
  ) {
    // Delete existing to avoid duplicates
    if (factureId) {
      await prisma.commission.deleteMany({ where: { factureId } });
    } else if (ficheId) {
      await prisma.commission.deleteMany({ where: { ficheId } });
    }

    const results: any[] = [];
    for (const line of lines) {
      let typeArticle: string | null = null;
      if (line.productId) {
        const product = await prisma.product.findUnique({
          where: { id: line.productId },
        });
        if (product) typeArticle = product.typeArticle;
      }

      if (!typeArticle && line.description) {
        const desc = line.description.toUpperCase();
        if (desc.includes('MONTURE')) typeArticle = 'MONTURE';
        else if (desc.includes('VERRE')) typeArticle = 'VERRE';
        else if (desc.includes('LENTILLE')) typeArticle = 'LENTILLE';
        else if (desc.includes('ACCESSOIRE')) typeArticle = 'ACCESSOIRE';
      }

      const rule =
        rules.find((r) => {
          if (!typeArticle) return false;
          const rType = r.typeProduit.toUpperCase();
          const pType = typeArticle.toUpperCase();
          return rType === pType || pType.startsWith(rType + '_');
        }) || rules.find((r) => r.typeProduit === 'GLOBAL');

      if (rule) {
        const lineAmount = line.totalTTC || 0;
        const montantCom = Number((lineAmount * (rule.taux / 100)).toFixed(2));

        if (montantCom > 0) {
          await prisma.commission.create({
            data: {
              employeeId: employee.id,
              factureId: factureId || undefined,
              ficheId: ficheId || undefined,
              type: typeArticle || 'INCONNU',
              montant: montantCom,
              mois: mois,
            },
          });
          results.push({ type: typeArticle, montant: montantCom });
        }
      }
    }
    return results;
  }

  async getEmployeeCommissions(
    employeeId: string,
    mois: string,
    annee?: number,
  ) {
    const fullMois = annee ? `${annee}-${mois}` : mois;
    return this.prisma.commission.findMany({
      where: { employeeId, mois: fullMois },
      include: {
        facture: {
          select: { numero: true, totalTTC: true, dateEmission: true },
        },
        fiche: {
          select: { numero: true, montantTotal: true, dateCreation: true },
        },
      },
    });
  }

  async getTotalCommissions(employeeId: string, mois: string, annee?: number) {
    const fullMois = annee ? `${annee}-${mois}` : mois;
    const aggregations = await this.prisma.commission.aggregate({
      where: { employeeId, mois: fullMois },
      _sum: { montant: true },
    });
    return aggregations._sum.montant || 0;
  }

  async recalculateForPeriod(mois: string) {
    const config = await this.getConfig();
    let totalCreated = 0;
    let itemsProcessed = 0;

    if (config.triggerType === 'FACTURE') {
      const factures = await this.prisma.facture.findMany({
        where: {
          statut: { in: ['VALIDE', 'PAYEE', 'PARTIEL', 'SOLDEE'] },
          dateEmission: {
            gte: new Date(`${mois}-01`),
            lt: new Date(
              new Date(`${mois}-01`).setMonth(
                new Date(`${mois}-01`).getMonth() + 1,
              ),
            ),
          },
        },
      });
      itemsProcessed = factures.length;
      for (const f of factures) {
        const results = await this.calculateForInvoice(f.id);
        if (results) totalCreated += results.length;
      }
    } else {
      const fiches = await this.prisma.fiche.findMany({
        where: {
          dateCreation: {
            gte: new Date(`${mois}-01`),
            lt: new Date(
              new Date(`${mois}-01`).setMonth(
                new Date(`${mois}-01`).getMonth() + 1,
              ),
            ),
          },
        },
      });
      itemsProcessed = fiches.length;
      for (const f of fiches) {
        const results = await this.calculateForFiche(f.id);
        if (results) totalCreated += results.length;
      }
    }

    return { itemsProcessed, commissionsCreated: totalCreated };
  }
}
