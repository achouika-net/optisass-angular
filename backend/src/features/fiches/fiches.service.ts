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

interface FicheContent {
  suiviCommande?: {
    fournisseur?: string;
    referenceCommande?: string;
    dateCommande?: Date | string;
    nextBcMotive?: string;
    bcHistorique?: any[];
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
    traitementOD?: any;
    traitementOG?: any;
    traitement?: any;
    traitements?: any;
    indiceOD?: string;
    indice?: string;
    indiceOG?: string;
    type?: string;
    usage?: string;
    preconisationIA_OD?: string;
    preconisationIA_OG?: string;
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
  };
  bcHistorique?: any[];
  configImage?: string;
  virtualCenteringUrl?: string;
  observations?: string;
  remarques?: string;
  preconisationIA_OD?: string;
  preconisationIA_OG?: string;
  // Legacy fields for Excel imports
  OD_Sph1?: any;
  OD_Cyl1?: any;
  OD_Axe1?: any;
  OD_Add1?: any;
  prescOD_EP?: any;
  prescOD_H?: any;
  prescOD_Diam?: any;
  OG_Sph1?: any;
  OG_Cyl1?: any;
  OG_Axe1?: any;
  OG_Add1?: any;
  prescOG_EP?: any;
  prescOG_H?: any;
  prescOG_Diam?: any;
  Medecin?: any;
  Prescripteur?: any;
  Verre1D?: any;
  Verre1G?: any;
  PrixV1D?: any;
  PrixV1G?: any;
  MarqueM1?: any;
  Marque?: any;
  RefM1?: any;
  Modele?: any;
  PrixM1?: any;
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
    // [FIX 5] Parallelize DB queries — all independent fetches run simultaneously
    const [fiche, companySettings] = await Promise.all([
      this.prisma.fiche.findUnique({
        where: { id },
        include: { client: { include: { centre: true } } },
      }),
      this.prisma.companySettings.findFirst(),
    ]);

    if (!fiche) throw new BadRequestException('Fiche introuvable');
    console.log(
      `📧 [FichesService] Preparing order email for Fiche #${fiche.numero} (ID: ${id}) Type: ${fiche.type}`,
    );

    const content = (fiche.content as unknown as FicheContent) || {};
    const suivi = content.suiviCommande || {};

    if (!suivi.fournisseur) {
      throw new BadRequestException(
        'Aucun fournisseur spécifié pour cette commande',
      );
    }

    // [FIX 5] Supplier lookup can only happen after we have fournisseur name
    const supplier = await this.prisma.fournisseur.findFirst({
      where: { nom: suivi.fournisseur },
    });

    if (!supplier || !supplier.email) {
      throw new BadRequestException(
        `Email introuvable pour le fournisseur: ${suivi.fournisseur}. Veuillez configurer son adresse email.`,
      );
    }

    const branding = {
      companyName: companySettings?.name || 'Optisaas',
      logoUrl: companySettings?.logoUrl || undefined,
      cachetUrl: companySettings?.cachetUrl || undefined,
    };

    const clientName =
      `${fiche.client.prenom || ''} ${fiche.client.nom || ''}`.trim();
    const bcNumber = suivi.referenceCommande || `BC-${fiche.numero}`;
    const date = new Date();

    // Helper for formatting (+1.50, -0.75, etc.)
    const formatSigned = (
      val: string | number | null | undefined,
      fallback = '0.00',
    ) => {
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
      const ordonnance = content.ordonnance || content.prescription || {};

      const odL = lentilles.od || {};
      const ogL = lentilles.og || (lentilles.diffLentilles ? {} : odL);
      const odP = ordonnance.od || {};
      const ogP = ordonnance.og || {};

      console.log('📄 [FichesService] Generating LENS PDFs (parallel)...');

      // [FIX 5] Generate both PDFs in parallel
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
      // --- GLASSES (MONTURE) LOGIC ---
      const ordonnance = content.ordonnance || {};
      const verres = content.verres || {};
      const montage = content.montage || {};
      const monture = content.monture || {};

      // Helper for Axe and Diameter calculation (Existing logic preserved)
      const cleanAxe = (val: string | number | null | undefined) =>
        String(val || '0').replace(/°/g, '');
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

      const measuredRaw = ((montage as any).diametreEffectif ||
        (montage as any).diagonalMm) as string;
      const measured = parseDualValue(measuredRaw);
      const safetyMargin = 3.0;
      const ordered = {
        od: measured.od ? getStdDiam(measured.od + safetyMargin) : 70,
        og: measured.og ? getStdDiam(measured.og + safetyMargin) : 75,
      };

      const getLensBrand = (m?: string, i?: string, f?: string) => {
        const parts: string[] = [];
        if (m) parts.push(m);
        if (i) parts.push(i);
        let str = parts.join(' ');
        if (f) str += ` (${f})`;
        return str.trim() || '-';
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
          const a1 = Array.isArray(tOD) ? tOD : [tOD];
          const a2 = Array.isArray(tOG) ? tOG : [tOG];
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

      console.log('📄 [FichesService] Generating GLASSES PDFs (parallel)...');

      // [FIX 5] Generate both PDFs in parallel
      [bcPdf, techPdf] = await Promise.all([
        this.pdfService.generatePurchaseOrder({
          bcNumber,
          date,
          supplierName: suivi.fournisseur,
          clientName,
          designation: branding.companyName,
          prescription: {
            od: {
              sphere: formatSigned(ordonnance.od?.sphere),
              cylindre: formatSigned(ordonnance.od?.cylindre),
              axe: cleanAxe(ordonnance.od?.axe),
              addition: formatSigned(ordonnance.od?.addition, '-'),
              ep: String(montage.ecartPupillaireOD || ordonnance.od?.ep || '-'),
              haut: String(montage.hauteurOD || '-'),
              diametre: String(ordered.od),
              diamUtile: measured.od ? String(measured.od) : '-',
            },
            og: {
              sphere: formatSigned(ordonnance.og?.sphere),
              cylindre: formatSigned(ordonnance.og?.cylindre),
              axe: cleanAxe(ordonnance.og?.axe),
              addition: formatSigned(ordonnance.og?.addition, '-'),
              ep: String(montage.ecartPupillaireOG || ordonnance.og?.ep || '-'),
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
              sphere: formatSigned(ordonnance.od?.sphere),
              cylindre: formatSigned(ordonnance.od?.cylindre),
              axe: cleanAxe(ordonnance.od?.axe),
              addition: formatSigned(ordonnance.od?.addition, '-'),
            },
            og: {
              sphere: formatSigned(ordonnance.og?.sphere),
              cylindre: formatSigned(ordonnance.og?.cylindre),
              axe: cleanAxe(ordonnance.og?.axe),
              addition: formatSigned(ordonnance.og?.addition, '-'),
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
            mesure: (measuredRaw ||
              (measured.od && measured.og
                ? `${measured.od}/${measured.og}`
                : '65/70')) as string,
            safety: safetyMargin,
            intermediate:
              measured.od && measured.og
                ? `${(measured.od + safetyMargin).toFixed(1)}/${(measured.og + safetyMargin).toFixed(1)} mm`
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

    // 3. Send Email
    try {
      await this.mailerService.sendMailWithAttachment({
        to: supplier.email,
        cc: centreEmail,
        replyTo: centreEmail,
        fromName: branding.companyName,
        subject: `[${branding.companyName}] Commande Optique - ${bcNumber} - Client: ${clientName}`,
        text: `Bonjour,

Veuillez trouver ci-joint les documents concernant la commande pour le client ${clientName} :
- Le Bon de Commande (Réf: ${bcNumber})
- ${fiche.type === 'LENTILLES' ? 'La Fiche Technique' : 'La Fiche de Montage'} avec les mesures techniques.

Nous restons à votre disposition pour toute information complémentaire.

Cordialement,
L'équipe ${branding.companyName}
${centreName ? `(${centreName})` : ''}`,
        attachments: [
          {
            filename: `Bon_de_Commande_${bcNumber}.pdf`,
            content: bcPdf,
          },
          {
            filename: techFileName,
            content: techPdf,
          },
        ],
      });
    } catch (error) {
      console.error('❌ [FichesService] Email sending failed:', error);
      throw new BadRequestException(
        `L'envoi de l'email a échoué: ${error instanceof Error ? error.message : 'Erreur inconnue'}`,
      );
    }

    return { success: true };
  }

  async create(data: Prisma.FicheCreateInput) {
    try {
      console.log('💾 Attempting to save fiche to database...');

      // Extract clientId from the data (support both flat clientId and nested client.connect.id)
      let clientId: string | undefined;

      // First check for flat clientId (what frontend sends)
      if ((data as any).clientId) {
        clientId = (data as any).clientId;
        console.log('✅ Found clientId in flat structure:', clientId);
      }
      // Then check for nested client.connect.id structure
      else if (
        typeof data.client === 'object' &&
        data.client &&
        'connect' in data.client &&
        (data.client as any).connect
      ) {
        clientId = (data.client as any).connect.id;
        console.log('✅ Found clientId in nested structure:', clientId);
      }

      if (!clientId) {
        console.log(
          '❌ No clientId found in data:',
          JSON.stringify(data, null, 2),
        );
        throw new BadRequestException('Client ID is required');
      }

      // check client
      // 1. Fetch the client to check status
      console.log('🔍 Verifying client existence for ID:', clientId);
      const client = await this.prisma.client.findUnique({
        where: { id: clientId },
      });

      if (!client) {
        console.error('❌ Client not found for ID:', clientId);
        throw new BadRequestException('Client not found');
      }

      // 2. If client is INACTIF, validate required fields (skip for anonymous)
      if (client.statut === 'INACTIF' && client.typeClient !== 'anonyme') {
        console.log('⚠️ Client is INACTIF, validating required fields...');
        this.validateRequiredFields(client);
      }

      const looseData = data as any;
      const incomingContent =
        looseData.content && typeof looseData.content === 'object'
          ? looseData.content
          : looseData;

      // Robust Content Mapping (Preserve all existing fields while ensuring mapping for critical ones)
      const content = {
        ...incomingContent,
        ordonnance: incomingContent.ordonnance || incomingContent.prescription,
        configImage:
          incomingContent.configImage || incomingContent.virtualCenteringUrl, // [FIX] Store centering image
      };

      console.log(
        `💾 [Backend CREATE] Fiche Type: ${data.type} | Content keys:`,
        Object.keys(content),
      );

      const createData: Prisma.FicheUncheckedCreateInput = {
        clientId: clientId,
        statut: data.statut,
        type: data.type,
        montantTotal: data.montantTotal,
        montantPaye: data.montantPaye || 0,
        dateLivraisonEstimee: data.dateLivraisonEstimee,
        content: content as Prisma.JsonObject,
      };

      const result = await this.prisma.fiche.create({
        data: createData,
      });
      console.log('✅ Fiche saved successfully:', result.id);

      // 4. If client was INACTIF, transition to ACTIF
      if (client.statut === 'INACTIF') {
        await this.prisma.client.update({
          where: { id: clientId },
          data: { statut: 'ACTIF' },
        });
        console.log('✅ Client status updated: INACTIF → ACTIF');
      }

      // 5. AUTOMATIC INVOICE GENERATION (BROUILLON)
      console.log('🧾 Checking/Creating Draft Invoice for Fiche...');
      try {
        // Check if invoice already exists for this Fiche
        const existingInvoice = await this.prisma.facture.findUnique({
          where: { ficheId: result.id },
        });

        if (!existingInvoice) {
          // AUTOMATIC INVOICE CREATION REMOVED
          // Reason: Frontend creates detailed invoice immediately after (Scenario 2).
          console.log(
            'ℹ️ Automatic draft creation disabled to prevent duplicates.',
          );
        } else {
          console.log(
            'ℹ️ Invoice already exists for this Fiche, skipping creation.',
          );
        }
      } catch (invError) {
        console.error('⚠️ Failed to check invoice existence:', invError);
      }

      // 6. Award Loyalty Points for Folder Creation
      console.log(
        '💎 Triggering loyalty points for folder creation. Client:',
        clientId,
        'Fiche:',
        result.id,
      );
      try {
        await this.loyaltyService.awardPointsForFolderCreation(
          clientId,
          result.id,
        );
        console.log('✅ Loyalty points trigger finished.');
      } catch (pError) {
        console.error('⚠️ Failed to award loyalty points:', pError);
      }

      return this.unpackContent(result);
    } catch (error) {
      console.error('❌ ERROR saving fiche:');
      console.error('Error:', error);
      console.error(
        'Error message:',
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  }

  private async validateRequiredFields(client: {
    id: string;
    dateNaissance?: Date | string | null;
    telephone?: string | null;
    ville?: string | null;
    statut?: string;
    typeClient?: string;
  }): Promise<void> {
    const missing: string[] = [];

    if (!client.dateNaissance) missing.push('Date de naissance');
    if (!client.telephone) missing.push('Téléphone');
    if (!client.ville) missing.push('Ville');

    if (missing.length > 0) {
      throw new BadRequestException({
        message:
          'Profil client incomplet. Veuillez compléter les champs requis avant de créer un dossier médical.',
        missingFields: missing,
        clientId: client.id,
      });
    }
  }

  /**
   * Lean endpoint for BC History page.
   * Optimized with server-side filtering and sorting.
   */
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
    if (centreId) {
      where.client = { centreId };
    }

    // We fetch a bit more than the limit because one fiche can have multiple BC history entries
    // But we limit the initial fetch to keep it fast.
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

    const allHistory: any[] = [];
    for (const fiche of fiches) {
      const content = (fiche.content as any) || {};
      const suivi = content.suiviCommande || {};
      const clientData = fiche.client || {};
      const displayName = (clientData as any).raisonSociale
        ? (clientData as any).raisonSociale
        : `${(clientData as any).prenom || ''} ${(clientData as any).nom || ''}`.trim();

      const legacyHistory: any[] = content.bcHistorique || [];
      const suiviHistory: any[] = suivi.bcHistorique || [];

      // De-duplicate by date+numero
      const combined = [...suiviHistory];
      legacyHistory.forEach((lh: any) => {
        if (
          !combined.find((sh: any) => sh.date === lh.date && sh.numero === lh.numero)
        ) {
          combined.push(lh);
        }
      });

      // Include current reference if not already listed
      const currentRef = suivi.referenceCommande;
      if (
        currentRef &&
        currentRef !== 'N/A' &&
        !combined.find((h) => h.numero === currentRef)
      ) {
        combined.unshift({
          date: suivi.dateCommande || fiche.dateCreation,
          numero: currentRef,
          fournisseur: suivi.fournisseur || 'Non spécifié',
          motive: suivi.nextBcMotive || 'En cours',
          isCurrent: true,
        });
      }

      combined.forEach((bc: any) => {
        allHistory.push({
          date: bc.date,
          numero: bc.numero,
          fournisseur: bc.fournisseur,
          motive: bc.motive,
          isCurrent: bc.isCurrent || false,
          ficheId: fiche.id,
          ficheNumero: fiche.numero,
          ficheType: fiche.type,
          clientDisplayName: displayName || 'Client',
          clientName: displayName,
        });
      });
    }

    // Sort by date descending (already sorted by fiche date, but BC dates might differ)
    return allHistory.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
  }

  async findAll(startDate?: string) {
    const where: Prisma.FicheWhereInput = {};
    if (startDate) {
      where.dateCreation = { gte: new Date(startDate) };
    }
    const fiches = await this.prisma.fiche.findMany({
      where,
      include: { client: true },
      orderBy: { dateCreation: 'desc' },
    });
    return fiches.map((f: Fiche) => this.unpackContent(f, true));
  }

  async findAllByClient(clientId: string, startDate?: string) {
    const where: Prisma.FicheWhereInput = { clientId };
    if (startDate) {
      where.dateCreation = { gte: new Date(startDate) };
    }

    // Optimize: Selected only needed fields for list view to avoid loading massive 'content' JSON
    const fiches = await this.prisma.fiche.findMany({
      where,
      select: {
        id: true,
        numero: true,
        dateCreation: true,
        statut: true,
        type: true,
        montantTotal: true,
        montantPaye: true,
        clientId: true,
        dateLivraisonEstimee: true,
        // We still need some parts of content (like frame brand/model) for the list view
        // But we exclude base64 images/PDFs by letting unpackContent handle a partial object
        content: true,
      },
      orderBy: { dateCreation: 'desc' },
    });

    return fiches.map((f: Partial<Fiche>) => this.unpackContent(f, true));
  }

  async findOne(id: string) {
    const fiche = await this.prisma.fiche.findUnique({
      where: { id },
    });
    return fiche ? this.unpackContent(fiche) : null;
  }

  async update(id: string, updateFicheDto: any) {
    console.log(`\n🔄 [Backend UPDATE] Fiche ${id}`);

    const existingFiche = await this.prisma.fiche.findUnique({
      where: { id },
    });

    if (!existingFiche) {
      throw new Error(`Fiche with ID ${id} not found`);
    }

    const { content: incomingContent, ...rest } = updateFicheDto;

    // Robust Merging Strategy:
    // Handle both cases: { content: { ... } } or flat { ordonnance: ..., configImage: ... }
    const currentContent = (existingFiche.content as Record<string, any>) || {};
    const contentToMerge =
      incomingContent && typeof incomingContent === 'object'
        ? incomingContent
        : rest;

    const mergedContent = {
      ...currentContent,
      ...contentToMerge,
    };

    console.log(
      `💾 [Backend UPDATE] Merged content keys:`,
      Object.keys(mergedContent),
    );

    const updated = await this.prisma.fiche.update({
      where: { id },
      data: {
        ...rest,
        content: mergedContent,
      },
    });

    // Handle Stock Movements (Exit)
    // Trigger when status changes to 'LIVRE' or 'FACTURE' and hasn't been done yet
    if (['FACTURE', 'LIVRE'].includes(updated.statut)) {
      await this.handleGlassStockExit(updated);
    }

    return this.unpackContent(updated);
  }

  private async handleGlassStockExit(fiche: any) {
    const content = (fiche.content as unknown as FicheContent) || {};
    const verres = content.verres || {};
    if (!verres) return;

    // Check if movement already exists to avoid double-counting
    const existing = await this.prisma.mouvementStock.findFirst({
      where: { motif: { contains: `Fiche ${fiche.numero}` }, type: 'SORTIE' }
    });
    if (existing) return;

    const itemsToProcess: Array<{ type: 'index' | 'treatment'; id: string; label: string }> = [];

    // Find Indices and Treatments by label
    const findIndex = async (val?: string, mat?: string) => {
      if (!val) return null;
      return this.prisma.glassIndex.findFirst({
        where: {
          OR: [{ value: val }, { label: val }],
          material: mat ? { name: mat } : undefined
        }
      });
    };

    const findTreatment = async (name?: string) => {
      if (!name) return null;
      return this.prisma.glassTreatment.findUnique({ where: { name } });
    };

    // Helper to process a pair of glasses or single side
    const processGlass = async (indice?: string, matiere?: string, treatment?: any) => {
      const idx = await findIndex(indice, matiere);
      if (idx) itemsToProcess.push({ type: 'index', id: idx.id, label: idx.label || idx.value });

      const treats = Array.isArray(treatment) ? treatment : [treatment];
      for (const tName of treats) {
        if (typeof tName !== 'string') continue;
        const treat = await findTreatment(tName);
        if (treat) itemsToProcess.push({ type: 'treatment', id: treat.id, label: treat.name });
      }
    };

    if (verres.differentODOG) {
      await processGlass(verres.indiceOD, verres.matiereOD, verres.traitementOD);
      await processGlass(verres.indiceOG, verres.matiereOG, verres.traitementOG);
    } else {
      // 2 glasses
      await processGlass(verres.indice, verres.matiere, verres.traitement);
      // We duplicate the items because there are 2 glasses
      const count = itemsToProcess.length;
      for (let i = 0; i < count; i++) {
        itemsToProcess.push({ ...itemsToProcess[i] });
      }
    }

    // Apply movements
    for (const item of itemsToProcess) {
      if (item.type === 'index') {
        await this.prisma.glassIndex.update({
          where: { id: item.id },
          data: { quantite: { decrement: 1 } }
        });
      } else {
        await this.prisma.glassTreatment.update({
          where: { id: item.id },
          data: { quantite: { decrement: 1 } }
        });
      }

      await this.prisma.mouvementStock.create({
        data: {
          type: 'SORTIE',
          quantite: -1,
          glassIndexId: item.type === 'index' ? item.id : null,
          glassTreatmentId: item.type === 'treatment' ? item.id : null,
          motif: `Sortie Stock - Fiche ${fiche.numero} (${item.label})`,
        }
      });
    }
  }

  async remove(id: string) {
    const fiche = await this.prisma.fiche.findUnique({ where: { id } });
    if (!fiche) throw new Error('Fiche introuvable');

    // Prevent deletion if finalized
    if (['FACTURE', 'LIVRE', 'COMMANDE'].includes(fiche.statut)) {
      throw new Error(
        'Action refusée: Impossible de supprimer une fiche validée (Facturée/Livrée/Commandée).',
      );
    }

    return this.prisma.fiche.delete({
      where: { id },
    });
  }

  private unpackContent(fiche: Partial<Fiche>, summaryOnly = false) {
    if (!fiche) return fiche;
    let content = (fiche.content as unknown as FicheContent) || {};

    // LEGACY MAPPING: If content is flat (from Excel), map to structured objects
    if (content.OD_Sph1 !== undefined || content.Verre1D !== undefined) {
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
        ordonnance: content.ordonnance || mappedOrdonnance,
        verres: content.verres || mappedVerres,
        monture: content.monture || mappedMonture,
      };
    }

    // Merge content properties to top level for legacy support, BUT prioritize DB fields (fiche)
    // over whatever might be cached inside the content JSON (like empty numero strings).
    let finalFiche: any = {
      ...content, // Spread legacy content first
      ...fiche, // Spread fiche from DB to ensure core fields (id, numero, dateCreation) are not overwritten
      ordonnance: content.ordonnance || (fiche as any).ordonnance,
      lentilles: content.lentilles || (fiche as any).lentilles,
      adaptation: content.adaptation || (fiche as any).adaptation,
      monture: content.monture || (fiche as any).monture,
      verres: content.verres || (fiche as any).verres,
      montage: content.montage || (fiche as any).montage,
      suiviCommande: content.suiviCommande || (fiche as any).suiviCommande,
      configImage: content.configImage || (fiche as any).configImage,
      content: undefined,
    };

    const purgeBase64 = (obj: unknown): any => {
      if (!obj || typeof obj !== 'object') return obj;
      if (obj instanceof Date) return obj;

      if (Array.isArray(obj)) {
        return obj.map((item) => purgeBase64(item));
      }

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

    finalFiche = purgeBase64(finalFiche);

    return finalFiche;
  }
}
