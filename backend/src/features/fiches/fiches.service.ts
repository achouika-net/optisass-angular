import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma, Fiche } from '@prisma/client';
import { FacturesService } from '../factures/factures.service';
import { LoyaltyService } from '../loyalty/loyalty.service';
import { MailerService } from '../notifications/mailer.service';
import { PdfService } from '../notifications/pdf.service';

interface EyeData {
  sphere?: string | number;
  cylindre?: string | number;
  axe?: string | number;
  addition?: string | number;
  rayon?: string | number;
  diametre?: string | number;
  usage?: string;
  type?: string;
  mouvement?: string;
  centrage?: string;
  marque?: string;
  modele?: string;
  keratoH?: string | number;
  keratoV?: string | number;
  keratoAxe?: string | number;
  keratoMoy?: string | number;
  dp?: string | number;
  ht?: string | number;
  ep?: string | number;
  but?: string | number;
  secretionLacrimale?: string | number;
}

export interface BCItem {
  date: Date | string;
  numero: string;
  fournisseur: string;
  motive: string;
  isCurrent?: boolean;
}

export interface HistoryItem extends BCItem {
  ficheId: string;
  ficheNumero: number;
  ficheType: string;
  clientDisplayName: string;
  clientName: string;
}

interface FicheContent {
  suiviCommande?: {
    fournisseur?: string;
    referenceCommande?: string;
    dateCommande?: Date | string;
    nextBcMotive?: string;
    bcHistorique?: BCItem[];
  };
  ordonnance?: {
    od?: EyeData;
    og?: EyeData;
  };
  prescription?: {
    od?: EyeData;
    og?: EyeData;
    diffLentilles?: boolean;
  };
  lentilles?: {
    od?: EyeData;
    og?: EyeData;
    diffLentilles?: boolean;
    type?: string;
    usage?: string;
  };
  adaptation?: {
    od?: EyeData;
    og?: EyeData;
  };
  verres?: {
    differentODOG?: boolean;
    marqueOD?: string;
    matiereOD?: string;
    fournisseurOD?: string;
    marque?: string;
    matiere?: string;
    fournisseur?: string;
    marqueOG?: string;
    matiereOG?: string;
    fournisseurOG?: string;
    traitementOD?: string | string[] | null;
    traitementOG?: string | string[] | null;
    traitement?: string | string[] | null;
    traitements?: string | string[] | null;
    indiceOD?: string;
    indice?: string;
    indiceOG?: string;
    type?: string;
    usage?: string;
    preconisationIA_OD?: string;
    preconisationIA_OG?: string;
    prixOD?: number | string;
    prixOG?: number | string;
    prix?: number | string;
  };
  montage?: {
    od?: EyeData;
    og?: EyeData;
    ecartPupillaireOD?: number | string;
    hauteurOD?: number | string;
    ecartPupillaireOG?: number | string;
    hauteurOG?: number | string;
    diametreEffectif?: string | number;
    diagonalMm?: string | number;
    configImage?: string;
    remarques?: string;
  };
  monture?: {
    reference?: string;
    marque?: string;
    taille?: string;
    modele?: string;
    type?: string;
    prix?: number | string;
  };
  bcHistorique?: BCItem[];
  configImage?: string;
  virtualCenteringUrl?: string;
  observations?: string;
  remarques?: string;
  preconisationIA_OD?: string;
  preconisationIA_OG?: string;
  // Legacy fields
  OD_Sph1?: string | number | null;
  OD_Cyl1?: string | number | null;
  OD_Axe1?: string | number | null;
  OD_Add1?: string | number | null;
  prescOD_EP?: string | number | null;
  prescOD_H?: string | number | null;
  prescOD_Diam?: string | number | null;
  OG_Sph1?: string | number | null;
  OG_Cyl1?: string | number | null;
  OG_Axe1?: string | number | null;
  OG_Add1?: string | number | null;
  prescOG_EP?: string | number | null;
  prescOG_H?: string | number | null;
  prescOG_Diam?: string | number | null;
  Medecin?: string | null;
  Prescripteur?: string | null;
  Verre1D?: string | null;
  Verre1G?: string | null;
  PrixV1D?: number | string | null;
  PrixV1G?: number | string | null;
  MarqueM1?: string | null;
  Marque?: string | null;
  RefM1?: string | null;
  Modele?: string | null;
  PrixM1?: number | string | null;
}

@Injectable()
export class FichesService {
  constructor(
    private prisma: PrismaService,
    private facturesService: FacturesService,
    private loyaltyService: LoyaltyService,
    private mailerService: MailerService,
    private pdfService: PdfService,
  ) {}

  async sendOrderEmail(id: string) {
    const [fiche, companySettings] = await Promise.all([
      this.prisma.fiche.findUnique({
        where: { id },
        include: { client: { include: { centre: true } } },
      }),
      this.prisma.companySettings.findFirst(),
    ]);

    if (!fiche) throw new BadRequestException('Fiche introuvable');

    const content = (fiche.content as unknown as FicheContent) || {};
    const suivi = content.suiviCommande || {};

    if (!suivi.fournisseur) {
      throw new BadRequestException(
        'Aucun fournisseur spécifié pour cette commande',
      );
    }

    const supplier = await this.prisma.fournisseur.findFirst({
      where: { nom: suivi.fournisseur },
    });

    if (!supplier || !supplier.email) {
      throw new BadRequestException(
        `Email introuvable pour le fournisseur: ${suivi.fournisseur}.`,
      );
    }

    const branding = {
      companyName: companySettings?.name || 'Optisaas',
      logoUrl: companySettings?.logoUrl || undefined,
      cachetUrl: companySettings?.cachetUrl || undefined,
    };

    const clientName = `${fiche.client.prenom || ''} ${
      fiche.client.nom || ''
    }`.trim();
    const bcNumber = suivi.referenceCommande || `BC-${fiche.numero}`;
    const date = new Date();

    const formatSigned = (val: any, fallback = '0.00') => {
      if (val === null || val === undefined || val === '') return fallback;
      const num = parseFloat(String(val).replace(/,/g, '.'));
      if (isNaN(num)) return String(val);
      return (num >= 0 ? '+' : '') + num.toFixed(2);
    };

    let bcPdf: Buffer;
    let techPdf: Buffer;
    let techFileName: string;

    if (fiche.type?.toUpperCase() === 'LENTILLES') {
      const lentilles = content.lentilles || {};
      const adaptation = content.adaptation || {};
      const ordonnance =
        content.ordonnance ||
        content.prescription ||
        ({} as Record<string, any>);

      const odL = lentilles.od || {};
      const ogL = lentilles.og || (lentilles.diffLentilles ? {} : odL);
      const odP = (ordonnance.od as EyeData) || {};
      const ogP = (ordonnance.og as EyeData) || {};

      [bcPdf, techPdf] = await Promise.all([
        this.pdfService.generateLensPurchaseOrder({
          bcNumber,
          date,
          supplierName: suivi.fournisseur,
          clientName,
          prescription: {
            od: {
              sphere: formatSigned(odP.sphere),
              cylindre: formatSigned(odP.cylindre),
              axe: String(odP.axe || '0') + '°',
              addition: formatSigned(odP.addition),
              rayon: String(odL.rayon || '-'),
              diametre: String(odL.diametre || '-'),
            },
            og: {
              sphere: formatSigned(ogP.sphere),
              cylindre: formatSigned(ogP.cylindre),
              axe: String(ogP.axe || '0') + '°',
              addition: formatSigned(ogP.addition),
              rayon: String(ogL.rayon || '-'),
              diametre: String(ogL.diametre || '-'),
            },
          },
          lensDetails: {
            marque: String(odL.marque || '-'),
            modele: String(odL.modele || '-'),
            type: String(lentilles.type || '-'),
          },
          branding,
          ficheNumber: String(fiche.numero),
        }),
        this.pdfService.generateLensTechnicalSheet({
          bcNumber,
          date,
          clientName,
          prescription: {
            od: {
              sphere: formatSigned(odP.sphere),
              cylindre: formatSigned(odP.cylindre),
              addition: formatSigned(odP.addition),
              axe: String(odP.axe || '0') + '°',
            },
            og: {
              sphere: formatSigned(ogP.sphere),
              cylindre: formatSigned(ogP.cylindre),
              addition: formatSigned(ogP.addition),
              axe: String(ogP.axe || '0') + '°',
            },
          },
          lentilles: {
            od: {
              marque: String(odL.marque || '-'),
              modele: String(odL.modele || '-'),
              rayon: String(odL.rayon || '-'),
              diametre: String(odL.diametre || '-'),
              mouvement: String(odL.mouvement || '-'),
              centrage: String(odL.centrage || '-'),
            },
            og: {
              marque: String(ogL.marque || '-'),
              modele: String(ogL.modele || '-'),
              rayon: String(ogL.rayon || '-'),
              diametre: String(ogL.diametre || '-'),
              mouvement: String(ogL.mouvement || '-'),
              centrage: String(ogL.centrage || '-'),
            },
            type: String(lentilles.type || '-'),
            usage: String(lentilles.usage || '-'),
          },
          adaptation: {
            od: {
              secretionLacrimale: String(
                adaptation.od?.secretionLacrimale || '-',
              ),
              but: String(adaptation.od?.but || '-'),
            },
            og: {
              secretionLacrimale: String(
                adaptation.og?.secretionLacrimale || '-',
              ),
              but: String(adaptation.og?.but || '-'),
            },
          },
          keratometrie: {
            od: {
              k1: String(odL.keratoH || '-'),
              k2: String(odL.keratoV || '-'),
              axe: String(odL.keratoAxe || '-'),
              kMoy: String(odL.keratoMoy || '-'),
            },
            og: {
              k1: String(ogL.keratoH || '-'),
              k2: String(ogL.keratoV || '-'),
              axe: String(ogL.keratoAxe || '-'),
              kMoy: String(ogL.keratoMoy || '-'),
            },
          },
          branding,
          ficheNumber: String(fiche.numero),
        }),
      ]);
      techFileName = `Fiche_Technique_${bcNumber}.pdf`;
    } else {
      const ordonnance = (content.ordonnance || {}) as Record<string, any>;
      const verres = content.verres || {};
      const montage = content.montage || {};
      const monture = content.monture || {};

      const cleanAxe = (val: any) => String(val || '0').replace(/°/g, '');
      const getStdDiam = (d: number) => {
        const standards = [50, 55, 60, 65, 70, 75, 80, 85];
        return standards.find((s) => s >= d) || 85;
      };
      const parseDualValue = (
        val: string | null,
      ): { od: number | null; og: number | null } => {
        if (!val || typeof val !== 'string') return { od: null, og: null };
        if (val.includes('/')) {
          const [od, og] = val.split('/').map((v) => parseFloat(v));
          return { od: isNaN(od) ? null : od, og: isNaN(og) ? null : og };
        }
        const num = parseFloat(val);
        return { od: isNaN(num) ? null : num, og: isNaN(num) ? null : num };
      };

      const measuredRaw = (montage.diametreEffectif ||
        montage.diagonalMm) as string;
      const measured = parseDualValue(measuredRaw);
      const safetyMargin = 3.0;
      const ordered = {
        od: measured.od ? getStdDiam(measured.od + safetyMargin) : 70,
        og: measured.og ? getStdDiam(measured.og + safetyMargin) : 75,
      };

      const getLensBrand = (
        marque?: string,
        matiere?: string,
        fournisseur?: string,
      ) => {
        const parts = [marque, matiere, fournisseur].filter(Boolean);
        return parts.length > 0 ? parts.join(' ').toUpperCase() : 'INCONNU';
      };

      const lensDetails = {
        od: verres.differentODOG
          ? getLensBrand(
              verres.marqueOD,
              verres.matiereOD,
              verres.fournisseurOD,
            )
          : getLensBrand(verres.marque, verres.matiere, verres.fournisseur),
        og: verres.differentODOG
          ? getLensBrand(
              verres.marqueOG,
              verres.matiereOG,
              verres.fournisseurOG,
            )
          : getLensBrand(verres.marque, verres.matiere, verres.fournisseur),
        treatments: (() => {
          const tOD =
            verres.traitementOD || verres.traitement || verres.traitements;
          const tOG =
            verres.traitementOG || verres.traitement || verres.traitements;
          const a1 = (Array.isArray(tOD) ? tOD : [tOD]) as string[];
          const a2 = (Array.isArray(tOG) ? tOG : [tOG]) as string[];
          const merged = Array.from(new Set([...a1, ...a2].filter(Boolean)));
          return merged.length > 0
            ? merged.join(', ').toUpperCase()
            : 'STANDARD';
        })(),
        indiceOD: verres.differentODOG
          ? verres.indiceOD || '-'
          : verres.indice || '-',
        indiceOG: verres.differentODOG
          ? verres.indiceOG || '-'
          : verres.indice || '-',
        matiereOD: verres.differentODOG
          ? verres.matiereOD || '-'
          : verres.matiere || '-',
        matiereOG: verres.differentODOG
          ? verres.matiereOG || '-'
          : verres.matiere || '-',
        typeVerre: verres.type || '-',
      };

      const odP = (ordonnance.od as EyeData) || {};
      const ogP = (ordonnance.og as EyeData) || {};

      [bcPdf, techPdf] = await Promise.all([
        this.pdfService.generatePurchaseOrder({
          bcNumber,
          date,
          supplierName: suivi.fournisseur,
          clientName,
          designation: branding.companyName,
          prescription: {
            od: {
              sphere: formatSigned(odP.sphere),
              cylindre: formatSigned(odP.cylindre),
              axe: cleanAxe(odP.axe),
              addition: formatSigned(odP.addition, '-'),
              ep: String(montage.ecartPupillaireOD || odP.ep || '-'),
              haut: String(montage.hauteurOD || '-'),
              diametre: String(ordered.od),
              diamUtile: measured.od ? String(measured.od) : '-',
            },
            og: {
              sphere: formatSigned(ogP.sphere),
              cylindre: formatSigned(ogP.cylindre),
              axe: cleanAxe(ogP.axe),
              addition: formatSigned(ogP.addition, '-'),
              ep: String(montage.ecartPupillaireOG || ogP.ep || '-'),
              haut: String(montage.hauteurOG || '-'),
              diametre: String(ordered.og),
              diamUtile: measured.og ? String(measured.og) : '-',
            },
          },
          ficheNumber: String(fiche.numero),
          lensDetails,
          frameDetails: {
            reference: monture.reference || '-',
            marque: monture.marque || '-',
            taille: monture.taille || '-',
          },
          branding,
        }),
        this.pdfService.generateFicheMontagePdf({
          bcNumber,
          date,
          clientName,
          magasinName: fiche.client?.centre?.nom || branding.companyName,
          prescription: {
            od: {
              sphere: formatSigned(odP.sphere),
              cylindre: formatSigned(odP.cylindre),
              axe: cleanAxe(odP.axe),
              addition: formatSigned(odP.addition, '-'),
            },
            og: {
              sphere: formatSigned(ogP.sphere),
              cylindre: formatSigned(ogP.cylindre),
              axe: cleanAxe(ogP.axe),
              addition: formatSigned(ogP.addition, '-'),
            },
          },
          ficheNumber: String(fiche.numero),
          centrage: {
            od: {
              dp: String(montage.ecartPupillaireOD || '0'),
              ht: String(montage.hauteurOD || '0'),
              diamUtile: measured.od ? String(measured.od) : '-',
            },
            og: {
              dp: String(montage.ecartPupillaireOG || '0'),
              ht: String(montage.hauteurOG || '0'),
              diamUtile: measured.og ? String(measured.og) : '-',
            },
          },
          verres: lensDetails,
          diametreConseille: `${ordered.od}/${ordered.og}`,
          technicalNote: {
            mesure:
              measuredRaw ||
              (measured.od && measured.og
                ? `${measured.od}/${measured.og}`
                : '65/70'),
            safety: safetyMargin,
            intermediate:
              measured.od && measured.og
                ? `${(measured.od + safetyMargin).toFixed(1)}/${(
                    measured.og + safetyMargin
                  ).toFixed(1)} mm`
                : '-',
            ordered: `${ordered.od}/${ordered.og}`,
          },
          virtualCenteringUrl:
            montage.configImage ||
            content.configImage ||
            content.virtualCenteringUrl ||
            undefined,
          preconisationsIA: {
            od:
              verres.preconisationIA_OD ||
              `${verres.marqueOD || ''} ${verres.matiereOD || ''}`.trim() ||
              '-',
            og:
              verres.preconisationIA_OG ||
              `${verres.marqueOG || ''} ${verres.matiereOG || ''}`.trim() ||
              '-',
          },
          observations: montage.remarques || content.observations || undefined,
          branding,
        }),
      ]);
      techFileName = `Fiche_de_Montage_${bcNumber}.pdf`;
    }

    const centreEmail = fiche.client?.centre?.email || undefined;
    const centreName = fiche.client?.centre?.nom || undefined;

    try {
      await this.mailerService.sendMailWithAttachment({
        to: supplier.email,
        cc: centreEmail,
        replyTo: centreEmail,
        fromName: branding.companyName,
        subject: `[${branding.companyName}] Commande Optique - ${bcNumber} - Client: ${clientName}`,
        text: `Bonjour,\n\nVeuillez trouver ci-joint les documents concernant la commande pour le client ${clientName} :\n- Le Bon de Commande (Réf: ${bcNumber})\n- ${
          fiche.type === 'LENTILLES'
            ? 'La Fiche Technique'
            : 'La Fiche de Montage'
        } avec les mesures techniques.\n\nCordialement,\nL'équipe ${
          branding.companyName
        }\n${centreName ? `(${centreName})` : ''}`,
        attachments: [
          { filename: `Bon_de_Commande_${bcNumber}.pdf`, content: bcPdf },
          { filename: techFileName, content: techPdf },
        ],
      });
    } catch (error) {
      throw new BadRequestException(
        `L'envoi de l'email a échoué: ${
          error instanceof Error ? error.message : 'Erreur inconnue'
        }`,
      );
    }

    return { success: true };
  }

  async create(
    data: Prisma.FicheCreateInput | Prisma.FicheUncheckedCreateInput,
    userId?: string,
  ) {
    let clientId: string | undefined;
    const d = data as Record<string, unknown>;
    if (d.clientId) {
      clientId = d.clientId as string;
    } else if (typeof d.client === 'object' && d.client) {
      const conn = (d.client as Record<string, unknown>).connect as
        | Record<string, string>
        | undefined;
      if (conn) clientId = conn.id;
    }

    if (!clientId) throw new BadRequestException('Client ID is required');

    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
    });
    if (!client) throw new BadRequestException('Client not found');

    if (client.statut === 'INACTIF' && client.typeClient !== 'anonyme') {
      this.validateRequiredFields(client);
    }

    const incomingContent = (d.content || d) as Record<string, unknown>;
    const content = {
      ...incomingContent,
      ordonnance: incomingContent.ordonnance || incomingContent.prescription,
      configImage:
        incomingContent.configImage || incomingContent.virtualCenteringUrl,
    };

    // Resolve employeeId from userId if provided
    let sellerId: string | undefined = undefined;
    if (userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { employee: true },
      });
      if (user?.employee) {
        sellerId = user.employee.id;
      }
    }

    const result = await this.prisma.fiche.create({
      data: {
        clientId: clientId,
        vendeurId: sellerId,
        statut: data.statut,
        type: data.type,
        montantTotal: data.montantTotal,
        montantPaye: data.montantPaye || 0,
        dateLivraisonEstimee: data.dateLivraisonEstimee,
        content: content as Prisma.JsonObject,
      },
    });

    // Trigger commission calculation for BC if configured
    try {
      const { CommissionService } = require('../personnel/commission.service');
      const commissionService = new CommissionService(this.prisma);
      await commissionService.calculateForFiche(result.id);
    } catch (e) {
      console.warn('Commission calculation for Fiche skipped or failed:', e.message);
    }

    if (client.statut === 'INACTIF') {
      await this.prisma.client.update({
        where: { id: clientId },
        data: { statut: 'ACTIF' },
      });
    }

    try {
      await this.loyaltyService.awardPointsForFolderCreation(
        clientId,
        result.id,
      );
    } catch (e) {
      console.error('Loyalty points error:', e);
    }

    if (['FACTURE', 'LIVRE'].includes(result.statut)) {
      await this.handleGlassStockExit(result, userId);
    }

    return this.unpackContent(result);
  }

  private validateRequiredFields(client: {
    id: string;
    dateNaissance?: Date | string | null;
    telephone?: string | null;
    ville?: string | null;
  }): void {
    const missing: string[] = [];
    if (!client.dateNaissance) missing.push('Date de naissance');
    if (!client.telephone) missing.push('Téléphone');
    if (!client.ville) missing.push('Ville');
    if (missing.length > 0) {
      throw new BadRequestException({
        message: 'Profil client incomplet.',
        missingFields: missing,
        clientId: client.id,
      });
    }
  }

  async findAllBcHistory(query: {
    startDate?: string;
    endDate?: string;
    centreId?: string;
    limit?: number;
    skip?: number;
  }) {
    const { startDate, endDate, centreId, limit = 50, skip = 0 } = query;
    const where: Prisma.FicheWhereInput = {};

    if (startDate || endDate) {
      where.dateCreation = {};
      if (startDate) where.dateCreation.gte = new Date(startDate);
      if (endDate) where.dateCreation.lte = new Date(endDate);
    }
    if (centreId) where.client = { centreId };

    const fiches = await this.prisma.fiche.findMany({
      where,
      select: {
        id: true,
        numero: true,
        dateCreation: true,
        type: true,
        statut: true,
        content: true,
        client: {
          select: { id: true, nom: true, prenom: true, raisonSociale: true },
        },
      },
      orderBy: { dateCreation: 'desc' },
      take: limit,
      skip: skip,
    });

    const allHistory: HistoryItem[] = [];
    for (const fiche of fiches) {
      const content = (fiche.content as unknown as FicheContent) || {};
      const suivi = content.suiviCommande || {};
      const clientData = (fiche.client || {}) as Record<string, unknown>;
      const displayName =
        (clientData.raisonSociale as string) ||
        `${(clientData.prenom as string) || ''} ${
          (clientData.nom as string) || ''
        }`.trim();

      const combined = [...(suivi.bcHistorique || [])];
      (content.bcHistorique || []).forEach((lh) => {
        if (
          !combined.find((sh) => sh.date === lh.date && sh.numero === lh.numero)
        )
          combined.push(lh);
      });

      if (
        suivi.referenceCommande &&
        suivi.referenceCommande !== 'N/A' &&
        !combined.find((h) => h.numero === suivi.referenceCommande)
      ) {
        combined.unshift({
          date: suivi.dateCommande || fiche.dateCreation,
          numero: suivi.referenceCommande,
          fournisseur: suivi.fournisseur || 'Non spécifié',
          motive: suivi.nextBcMotive || 'En cours',
          isCurrent: true,
        });
      }

      combined.forEach((bc) => {
        allHistory.push({
          date: bc.date,
          numero: bc.numero,
          fournisseur: bc.fournisseur,
          motive: bc.motive,
          isCurrent: bc.isCurrent || false,
          ficheId: fiche.id,
          ficheNumero: fiche.numero,
          ficheType: fiche.type,
          clientDisplayName: displayName,
          clientName: displayName,
        });
      });
    }
    return allHistory.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
  }

  async findAll(startDate?: string) {
    const where: Prisma.FicheWhereInput = {};
    if (startDate) where.dateCreation = { gte: new Date(startDate) };
    const fiches = await this.prisma.fiche.findMany({
      where,
      include: { client: true },
      orderBy: { dateCreation: 'desc' },
    });
    return fiches.map((f: Fiche) => this.unpackContent(f, true));
  }

  async findAllByClient(clientId: string, startDate?: string) {
    const where: Prisma.FicheWhereInput = { clientId };
    if (startDate) where.dateCreation = { gte: new Date(startDate) };
    const fiches = await this.prisma.fiche.findMany({
      where,
      orderBy: { dateCreation: 'desc' },
    });
    return fiches.map((f: Fiche) => this.unpackContent(f, true));
  }

  async findOne(id: string) {
    const fiche = await this.prisma.fiche.findUnique({ where: { id } });
    return fiche
      ? (this.unpackContent(fiche) as Record<string, unknown>)
      : null;
  }

  async update(
    id: string,
    updateFicheDto: Record<string, unknown>,
    userId?: string,
  ) {
    const existingFiche = await this.prisma.fiche.findUnique({ where: { id } });
    if (!existingFiche) throw new Error(`Fiche with ID ${id} not found`);

    const { content: incomingContent, ...rest } = updateFicheDto;
    const currentContent =
      (existingFiche.content as Record<string, unknown>) || {};
    const contentToMerge =
      incomingContent && typeof incomingContent === 'object'
        ? (incomingContent as Record<string, unknown>)
        : (rest as Record<string, unknown>);
    const mergedContent = { ...currentContent, ...contentToMerge };

    const updated = await this.prisma.fiche.update({
      where: { id },
      data: { content: mergedContent as Prisma.JsonObject, ...rest },
      include: { client: true, facture: true },
    });

    if (['FACTURE', 'LIVRE'].includes(updated.statut)) {
      await this.handleGlassStockExit(updated, userId);
    }
    return this.unpackContent(updated) as Record<string, unknown>;
  }

  private async handleGlassStockExit(
    fiche: Fiche & {
      facture?: {
        id: string;
        lignes: Prisma.JsonValue;
        numero: string;
        statut: string;
      } | null;
    },
    userId?: string,
  ) {
    const f = fiche;
    const content = (f.content as unknown as FicheContent) || {};
    const verres = content.verres;
    const monture = content.monture || {};

    console.log(
      `[FichesService] 🎬 Processing stock exit for Fiche ${f.numero}...`,
    );

    let userDisplayName = 'Système';
    if (userId) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (user) userDisplayName = `${user.prenom} ${user.nom}`;
    }

    const itemsToProcess: Array<{
      type: 'index' | 'treatment' | 'product';
      id?: string;
      label: string;
      productId?: string;
    }> = [];

    // Safety: Check if the monture is already handled by FacturesService
    let frameAlreadyInInvoice = false;
    if (f.facture?.lignes) {
      try {
        const rawLines = f.facture.lignes;
        const lines = (
          typeof rawLines === 'string' ? JSON.parse(rawLines) : rawLines
        ) as Record<string, unknown>[];

        if (Array.isArray(lines)) {
          frameAlreadyInInvoice = lines.some((l) => {
            const lineProdId = l.productId as string | undefined;
            const lineRef = l.reference as string | undefined;
            const lineDesignation = l.designation as string | undefined;

            const matchesRef =
              lineProdId && monture.reference && lineRef === monture.reference;
            const matchesDesignation =
              lineDesignation &&
              monture.marque &&
              lineDesignation.includes(monture.marque);

            return matchesRef || matchesDesignation;
          });
        }
      } catch (e) {
        console.error('Error parsing invoice lines for duplicate check:', e);
      }
    }

    if (verres) {
      const findIndex = async (val?: string, mat?: string) => {
        if (!val) return null;
        return this.prisma.glassIndex.findFirst({
          where: {
            OR: [{ value: val }, { label: val }],
            material: mat ? { name: mat } : undefined,
          },
        });
      };
      const findTreatment = async (name?: string) => {
        if (!name) return null;
        return this.prisma.glassTreatment.findUnique({ where: { name } });
      };

      const processGlass = async (
        indice?: string,
        matiere?: string,
        treatment?: string | string[] | null,
      ) => {
        const idx = await findIndex(indice, matiere);
        if (idx) {
          // Check for existing movement for THIS index
          const exists = await this.prisma.mouvementStock.findFirst({
            where: {
              glassIndexId: idx.id,
              motif: { contains: `Fiche n° ${f.numero}` },
              type: 'SORTIE_VENTE',
            },
          });
          if (!exists) {
            itemsToProcess.push({
              type: 'index',
              id: idx.id,
              label: idx.label || idx.value,
            });
          }
        }
        const treats = Array.isArray(treatment)
          ? treatment
          : treatment
            ? [treatment]
            : [];
        for (const tName of treats) {
          if (typeof tName !== 'string') continue;
          const treat = await findTreatment(tName);
          if (treat) {
            // Check for existing movement for THIS treatment
            const exists = await this.prisma.mouvementStock.findFirst({
              where: {
                glassTreatmentId: treat.id,
                motif: { contains: `Fiche n° ${f.numero}` },
                type: 'SORTIE_VENTE',
              },
            });
            if (!exists) {
              itemsToProcess.push({
                type: 'treatment',
                id: treat.id,
                label: treat.name,
              });
            }
          }
        }
      };

      if (verres.differentODOG) {
        await processGlass(
          verres.indiceOD,
          verres.matiereOD,
          verres.traitementOD,
        );
        await processGlass(
          verres.indiceOG,
          verres.matiereOG,
          verres.traitementOG,
        );
      } else {
        await processGlass(verres.indice, verres.matiere, verres.traitement);
        // Duplicate for both eyes if same
        const currentCount = itemsToProcess.length;
        for (let i = 0; i < currentCount; i++) {
          itemsToProcess.push({ ...itemsToProcess[i] });
        }
      }
    }

    if (monture && monture.reference) {
      // PER-ITEM DEDUPLICATION: Only skip if THIS SPECIFIC MONTURE already has a movement for this fiche/facture
      const existingMontureMove = await this.prisma.mouvementStock.findFirst({
        where: {
          OR: [
            { motif: { contains: `Fiche n° ${f.numero}` } },
            { factureId: f.facture?.id },
          ],
          type: 'SORTIE_VENTE',
          produit: {
            OR: [
              { codeInterne: monture.reference },
              { codeBarres: monture.reference },
            ],
          },
        },
      });

      if (!existingMontureMove && !frameAlreadyInInvoice) {
        const product = await this.prisma.product.findFirst({
          where: {
            OR: [
              { codeInterne: monture.reference },
              { codeBarres: monture.reference },
            ],
          },
        });
        if (product) {
          itemsToProcess.push({
            type: 'product',
            productId: product.id,
            label:
              `Monture ${monture.marque || ''} ${monture.reference}`.trim(),
          });
        }
      }
    }

    for (const item of itemsToProcess) {
      if (item.type === 'index' && item.id) {
        await this.prisma.glassIndex.update({
          where: { id: item.id },
          data: { quantite: { decrement: 1 } },
        });
      } else if (item.type === 'treatment' && item.id) {
        await this.prisma.glassTreatment.update({
          where: { id: item.id },
          data: { quantite: { decrement: 1 } },
        });
      } else if (item.type === 'product' && item.productId) {
        await this.prisma.product.update({
          where: { id: item.productId },
          data: { quantiteActuelle: { decrement: 1 } },
        });
      }
      await this.prisma.mouvementStock.create({
        data: {
          type: 'SORTIE_VENTE',
          quantite: -1,
          glassIndexId: item.type === 'index' ? item.id : null,
          glassTreatmentId: item.type === 'treatment' ? item.id : null,
          produitId: item.type === 'product' ? item.productId : null,
          motif: `Sortie Stock - Fiche n° ${fiche.numero} (${item.label})`,
          utilisateur: userDisplayName,
          userId: userId || null,
          dateMovement: new Date(),
        },
      });
    }
  }

  async remove(id: string) {
    const fiche = await this.prisma.fiche.findUnique({ where: { id } });
    if (!fiche) throw new Error('Fiche introuvable');
    if (['FACTURE', 'LIVRE', 'COMMANDE'].includes(fiche.statut)) {
      throw new Error('Action refusée: Fiche validée.');
    }
    return this.prisma.fiche.delete({ where: { id } });
  }

  private unpackContent(fiche: Fiche, summaryOnly = false): unknown {
    if (!fiche || !fiche.content) return fiche;
    let content: FicheContent;
    try {
      content = (typeof fiche.content === 'string'
        ? JSON.parse(fiche.content)
        : fiche.content) as unknown as FicheContent;
    } catch {
      return fiche;
    }

    if (summaryOnly) {
      const mappedOrdonnance = {
        od: {
          sphere: content.OD_Sph1,
          cylindre: content.OD_Cyl1,
          axe: content.OD_Axe1,
          addition: content.OD_Add1,
          dp: content.prescOD_EP || '',
          ht: content.prescOD_H || '',
          diamUtile: content.prescOD_Diam || '-',
        },
        og: {
          sphere: content.OG_Sph1,
          cylindre: content.OG_Cyl1,
          axe: content.OG_Axe1,
          addition: content.OG_Add1,
          dp: content.prescOG_EP || '',
          ht: content.prescOG_H || '',
          diamUtile: content.prescOG_Diam || '-',
        },
        prescripteur: content.Medecin || content.Prescripteur,
      };
      const mappedVerres = {
        differentODOG: true,
        marqueOD: content.Verre1D,
        marqueOG: content.Verre1G,
        prixOD: content.PrixV1D,
        prixOG: content.PrixV1G,
      };
      const mappedMonture = {
        marque: content.MarqueM1 || content.Marque,
        modele: content.RefM1 || content.Modele,
        prix: content.PrixM1,
      };
      content = {
        ...content,
        ordonnance:
          content.ordonnance ||
          (mappedOrdonnance as unknown as { od: EyeData; og: EyeData }),
        verres:
          content.verres || (mappedVerres as unknown as FicheContent['verres']),
        monture:
          content.monture ||
          (mappedMonture as unknown as FicheContent['monture']),
      };
    }

    if (content?.montage) {
      if (content.montage.diametreEffectif)
        content.montage.diametreEffectif = Number(
          content.montage.diametreEffectif,
        );
      if (content.montage.diagonalMm)
        content.montage.diagonalMm = Number(content.montage.diagonalMm);
    }

    const ficheAny = fiche as Record<string, unknown>;
    const finalFiche = {
      ...(content as Record<string, unknown>),
      ...fiche,
      ordonnance: content.ordonnance || ficheAny.ordonnance,
      lentilles: content.lentilles || ficheAny.lentilles,
      adaptation: content.adaptation || ficheAny.adaptation,
      monture: content.monture || ficheAny.monture,
      verres: content.verres || ficheAny.verres,
      montage: content.montage || ficheAny.montage,
      suiviCommande: content.suiviCommande || ficheAny.suiviCommande,
      configImage: content.configImage || ficheAny.configImage,
      content: undefined,
    } as Record<string, unknown>;

    const purgeBase64 = (obj: unknown): unknown => {
      if (!obj || typeof obj !== 'object') return obj;
      if (obj instanceof Date) return obj;
      if (Array.isArray(obj)) return obj.map((item) => purgeBase64(item));
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'string') {
          result[key] =
            value.startsWith('data:image/') ||
            value.startsWith('data:application/pdf') ||
            value.length > 30000
              ? '[FICHIER_ATTACHE_MASQUE_EN_VUE_LISTE]'
              : value;
        } else {
          result[key] = purgeBase64(value);
        }
      }
      return result;
    };
    return purgeBase64(finalFiche);
  }
}
