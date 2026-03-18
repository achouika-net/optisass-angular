import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma, Fiche } from '@prisma/client';
import { FacturesService } from '../factures/factures.service';
import { LoyaltyService } from '../loyalty/loyalty.service';
import { MailerService } from '../notifications/mailer.service';
import { PdfService } from '../notifications/pdf.service';

@Injectable()
export class FichesService {
  constructor(
    private prisma: PrismaService,
    private facturesService: FacturesService,
    private loyaltyService: LoyaltyService,
    private mailerService: MailerService,
    private pdfService: PdfService,
  ) { }

  async sendOrderEmail(id: string) {
    const fiche = await this.prisma.fiche.findUnique({
      where: { id },
      include: { client: { include: { centre: true } } },
    });

    if (!fiche) throw new BadRequestException('Fiche introuvable');
    console.log(`📧 [FichesService] Preparing order email for Fiche #${fiche.numero} (ID: ${id})`);

    const content = (fiche.content as any) || {};
    const suivi = content.suiviCommande || {};
    
    if (!suivi.fournisseur) {
      throw new BadRequestException('Aucun fournisseur spécifié pour cette commande');
    }

    // 1. Find Supplier Email
    const supplier = await this.prisma.fournisseur.findFirst({
      where: { nom: suivi.fournisseur },
    });

    if (!supplier || !supplier.email) {
      throw new BadRequestException(`Email introuvable pour le fournisseur: ${suivi.fournisseur}. Veuillez configurer son adresse email.`);
    }

    // 2. Prepare Data for PDF
    const ordonnance = content.ordonnance || {};
    const verres = content.verres || {};
    const monture = content.monture || {};
    const montage = content.montage || {};

    const clientName = `${fiche.client.prenom || ''} ${fiche.client.nom || ''}`.trim();
    const bcNumber = suivi.referenceCommande || `BC-${fiche.numero}`;
    const date = new Date();

    // Helper for formatting (+1.50, -0.75, etc.)
    const formatSigned = (val: any, fallback = '0.00') => {
      if (val === null || val === undefined || val === '') return fallback;
      const num = parseFloat(val);
      if (isNaN(num)) return val;
      return (num >= 0 ? '+' : '') + num.toFixed(2);
    };

    const companySettings = await this.prisma.companySettings.findFirst();
    const branding = {
      companyName: companySettings?.name || "Optisaas",
      logoUrl: companySettings?.logoUrl || undefined,
      cachetUrl: companySettings?.cachetUrl || undefined,
    };

    // Lens detail formatting to match frontend
    const getLensBrand = (m: string, i: string, f: string) => {
      const parts: string[] = [];
      if (m) parts.push(m);
      if (i) parts.push(i);
      let str = parts.join(' ');
      if (f) str += ` (${f})`;
      return str.trim() || '-';
    };

    // Help fix Axe duplication (remove any existing degree symbols)
    const cleanAxe = (val: any) => String(val || '0').replace(/°/g, '');

    // -------------------------------------------------------------------
    // [NEW] STANDARDIZED DIAMETER CALCULATION (Mesuré vs Commandé)
    // -------------------------------------------------------------------
    const getStdDiam = (d: number) => {
      const standards = [50, 55, 60, 65, 70, 75, 80, 85];
      return standards.find((s) => s >= d) || 85;
    };

    const parseDualValue = (val: string | null): { od: number | null, og: number | null } => {
      if (!val || typeof val !== 'string') return { od: null, og: null };
      if (val.includes('/')) {
        const [od, og] = val.split('/').map((v) => parseFloat(v));
        return { od: isNaN(od) ? null : od, og: isNaN(og) ? null : og };
      }
      const num = parseFloat(val);
      return { od: isNaN(num) ? null : num, og: isNaN(num) ? null : num };
    };

    // 1. Get Measured Diameters (Diamètre Utile / Effectif)
    const measuredRaw = ((montage as any).diametreEffectif || (montage as any).diagonalMm) as string;
    const measured = parseDualValue(measuredRaw);
    
    // 2. Calculate "Commandé" (Standardized + Safety Margin)
    const safetyMargin = 3.0; // Margin for edging
    const intermediate = {
      od: measured.od ? measured.od + safetyMargin : 0,
      og: measured.og ? measured.og + safetyMargin : 0
    };
    const ordered = {
      od: measured.od ? getStdDiam(intermediate.od) : 70,
      og: measured.og ? getStdDiam(intermediate.og) : 75
    };

    // Technical note for Fiche Montage
    const measuredLabel = (measuredRaw || (measured.od && measured.og ? `${measured.od}/${measured.og}` : '-')) as string;
    const intermediateLabel = (measured.od && measured.og ? `${intermediate.od.toFixed(1)}/${intermediate.og.toFixed(1)} mm` : '-');
    
    const technicalNoteData = {
      mesure: measuredLabel || (measured.od && measured.og ? `${measured.od}/${measured.og}` : '65/70'),
      safety: safetyMargin,
      intermediate: intermediateLabel,
      ordered: `${ordered.od}/${ordered.og}`
    };

    // Helper to format treatments list
    const formatTreatments = (t: any) => {
      if (!t) return 'STANDARD';
      const arr = Array.isArray(t) ? t : [String(t)];
      if (arr.length === 0) return 'STANDARD';
      return arr.join(', ').toUpperCase();
    };

    const lensDetails = {
      od: verres.differentODOG 
        ? getLensBrand(verres.marqueOD, verres.matiereOD, verres.fournisseurOD)
        : getLensBrand(verres.marque, verres.matiere, verres.fournisseur),
      og: verres.differentODOG 
        ? getLensBrand(verres.marqueOG, verres.matiereOG, verres.fournisseurOG)
        : getLensBrand(verres.marque, verres.matiere, verres.fournisseur),
      treatments: (() => {
        const tOD = verres.traitementOD || verres.traitement || verres.traitements;
        const tOG = verres.traitementOG || verres.traitement || verres.traitements;
        const a1 = Array.isArray(tOD) ? tOD : [tOD];
        const a2 = Array.isArray(tOG) ? tOG : [tOG];
        const merged = Array.from(new Set([...a1, ...a2].filter(Boolean)));
        return merged.length > 0 ? merged.join(', ').toUpperCase() : 'STANDARD';
      })(),
      indiceOD: verres.differentODOG ? (verres.indiceOD || '-') : (verres.indice || '-'),
      indiceOG: verres.differentODOG ? (verres.indiceOG || '-') : (verres.indice || '-'),
      matiereOD: verres.differentODOG ? (verres.matiereOD || '-') : (verres.matiere || '-'),
      matiereOG: verres.differentODOG ? (verres.matiereOG || '-') : (verres.matiere || '-'),
      typeVerre: verres.type || '-'
    };

    const frameDetails = {
      reference: monture.reference || '-',
      marque: monture.marque || '-',
      taille: monture.taille || '-'
    };

    // 1. Generate Bon de Commande PDF
    console.log(`📄 [FichesService] Generating BC PDF with bcNumber: ${bcNumber}, Client: ${clientName}`);
    const bcPdf = await this.pdfService.generatePurchaseOrder({
      bcNumber,
      date,
      supplierName: suivi.fournisseur,
      clientName: clientName,
      designation: branding.companyName, 
      prescription: {
        od: {
          sphere: formatSigned(ordonnance.od?.sphere),
          cylindre: formatSigned(ordonnance.od?.cylindre),
          axe: cleanAxe(ordonnance.od?.axe),
          addition: formatSigned(ordonnance.od?.addition, '-'),
          ep: String(montage.ecartPupillaireOD || ordonnance.od?.ep || '-'),
          haut: String(montage.hauteurOD || '-'),
          diametre: String(ordered.od), // Ordered (for table)
          diamUtile: measured.od ? String(measured.od) : '-' // Measured (for header grid)
        },
        og: {
          sphere: formatSigned(ordonnance.og?.sphere),
          cylindre: formatSigned(ordonnance.og?.cylindre),
          axe: cleanAxe(ordonnance.og?.axe),
          addition: formatSigned(ordonnance.og?.addition, '-'),
          ep: String(montage.ecartPupillaireOG || ordonnance.og?.ep || '-'),
          haut: String(montage.hauteurOG || '-'),
          diametre: String(ordered.og), // Ordered (for table)
          diamUtile: measured.og ? String(measured.og) : '-' // Measured (for header grid)
        },
      },
      ficheNumber: String(fiche.numero),
      lensDetails,
      frameDetails,
      branding,
    });

    // 2. Generate Fiche de Montage PDF
    console.log(`📄 [FichesService] Generating Fiche de Montage PDF with technicalNoteData:`, 
      technicalNoteData,
    );
    const montagePdf = await this.pdfService.generateFicheMontagePdf({
      bcNumber,
      date,
      clientName: clientName,
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
          diamUtile: measured.od ? String(measured.od) : '-'
        },
        og: { 
          dp: String(montage.ecartPupillaireOG || '0'), 
          ht: String(montage.hauteurOG || '0'), 
          diamUtile: measured.og ? String(measured.og) : '-',
        },
      },
      verres: lensDetails,
      diametreConseille: technicalNoteData.ordered,
      technicalNote: technicalNoteData, // [NEW] Pass data for the blue box
      imageMontureUrl: montage.capturedImage || undefined,
      virtualCenteringUrl: montage.configImage || content.configImage || content.virtualCenteringUrl || undefined,
      preconisationsIA: {
        od: verres.preconisationIA_OD || `${verres.marqueOD || ''} ${verres.matiereOD || ''}`.trim() || '-',
        og: verres.preconisationIA_OG || `${verres.marqueOG || ''} ${verres.matiereOG || ''}`.trim() || '-',
      },
      observations: montage.remarques || content.observations || undefined,
      branding,
    });

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

Veuillez trouver ci-joint les documents concernant la commande de verres pour le client ${clientName} :
- Le Bon de Commande (Réf: ${bcNumber})
- La Fiche de Montage avec les mesures techniques.

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
            filename: `Fiche_de_Montage_${bcNumber}.pdf`,
            content: montagePdf,
          },
        ],
      });
    } catch (error) {
      console.error('❌ [FichesService] Email sending failed:', error);
      throw new BadRequestException(`L'envoi de l'email a échoué: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
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
      const incomingContent = looseData.content && typeof looseData.content === 'object' ? looseData.content : looseData;

      // Robust Content Mapping
      const content = {
        ordonnance: incomingContent.ordonnance || incomingContent.prescription,
        lentilles: incomingContent.lentilles,
        adaptation: incomingContent.adaptation,
        monture: incomingContent.monture,
        verres: incomingContent.verres,
        montage: incomingContent.montage,
        configImage: incomingContent.configImage || incomingContent.virtualCenteringUrl, // [FIX] Store centering image
        suggestions: incomingContent.suggestions,
        equipements: incomingContent.equipements,
        produits: incomingContent.produits,
        notes: incomingContent.notes,
        suiviCommande: incomingContent.suiviCommande,
      };

      console.log(`💾 [Backend CREATE] Fiche Type: ${data.type} | Content keys:`, Object.keys(content));

      const createData: Prisma.FicheUncheckedCreateInput = {
        clientId: clientId,
        statut: data.statut,
        type: data.type,
        montantTotal: data.montantTotal,
        montantPaye: data.montantPaye || 0,
        dateLivraisonEstimee: data.dateLivraisonEstimee,
        content: content as any,
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
      console.error('Error message:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  private async validateRequiredFields(client: any): Promise<void> {
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
    return fiches.map((f: Fiche) => this.unpackContent(f));
  }

  async findAllByClient(clientId: string, startDate?: string) {
    const where: Prisma.FicheWhereInput = { clientId };
    if (startDate) {
      where.dateCreation = { gte: new Date(startDate) };
    }
    const fiches = await this.prisma.fiche.findMany({
      where,
      orderBy: { dateCreation: 'desc' },
    });
    return fiches.map((f: Fiche) => this.unpackContent(f));
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
    const contentToMerge = (incomingContent && typeof incomingContent === 'object') ? incomingContent : rest;

    const mergedContent = {
      ...currentContent,
      ...contentToMerge
    };

    console.log(`💾 [Backend UPDATE] Merged content keys:`, Object.keys(mergedContent));

    const updated = await this.prisma.fiche.update({
      where: { id },
      data: {
        ...rest,
        content: mergedContent,
      },
    });

    return this.unpackContent(updated);
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

  private unpackContent(fiche: any) {
    if (!fiche) return fiche;
    const rawContent = (fiche.content as Record<string, any>) || {};
    let content = { ...rawContent };

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

    // Merge content properties to top level for legacy support
    return {
      ...fiche,
      ...content, // Spread content back to top level
      ordonnance: content.ordonnance || fiche.ordonnance,
      lentilles: content.lentilles || fiche.lentilles,
      adaptation: content.adaptation || fiche.adaptation,
      monture: content.monture || fiche.monture,
      verres: content.verres || fiche.verres,
      montage: content.montage || fiche.montage,
      suiviCommande: content.suiviCommande || fiche.suiviCommande,
      configImage: content.configImage || fiche.configImage,
      content: undefined,
    };
  }
}
