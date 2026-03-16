import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
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
    let designation = '';
    const ordonnance = content.ordonnance || {};

    if (fiche.type === 'LENTILLES') {
      const lentilles = content.lentilles || {};
      designation = lentilles.diffLentilles
        ? `Lentilles - OD: ${lentilles.od?.marque || ''} ${lentilles.od?.modele || ''}, OG: ${lentilles.og?.marque || ''} ${lentilles.og?.modele || ''}`
        : `Lentilles - ${lentilles.od?.marque || ''} ${lentilles.od?.modele || ''}`;
    } else {
      // VERRES SEULEMENT (Demande utilisateur : "pour la designation pointe strictement sur les verre et non la monture")
      const verres = content.verres || {};
      
      const verresDesc = verres.differentODOG
        ? `Verres - OD: ${verres.marqueOD || ''} ${verres.matiereOD || ''}, OG: ${verres.marqueOG || ''} ${verres.matiereOG || ''}`
        : `Verres - ${verres.marque || ''} ${verres.matiere || ''}`;
      
      designation = verresDesc;
    }

    const clientName = `${fiche.client.prenom || ''} ${fiche.client.nom || ''}`.trim();

    const pdfBuffer = await this.pdfService.generatePurchaseOrder({
      bcNumber: suivi.referenceCommande || `BC-${fiche.numero}`,
      date: new Date(),
      supplierName: supplier.nom,
      clientName: clientName,
      designation: designation,
      prescription: {
        od: {
          sphere: ordonnance.od?.sphere || '0.00',
          cylindre: ordonnance.od?.cylindre || '0.00',
          axe: ordonnance.od?.axe || '0',
        },
        og: {
          sphere: ordonnance.og?.sphere || '0.00',
          cylindre: ordonnance.og?.cylindre || '0.00',
          axe: ordonnance.og?.axe || '0',
        },
      },
    });

    const centreEmail = fiche.client?.centre?.email || undefined;
    const centreName = fiche.client?.centre?.nom || undefined;

    // 3. Send Email
    await this.mailerService.sendMailWithAttachment({
      to: supplier.email,
      cc: centreEmail,
      replyTo: centreEmail,
      fromName: centreName,
      subject: `Bon de Commande - ${suivi.referenceCommande || fiche.numero}`,
      text: `Bonjour,\n\nVeuillez trouver ci-joint le bon de commande pour le client ${clientName}.\n\nCordialement,\n${centreName || "L'équipe Optique"}`,
      attachmentName: `Bon_de_Commande_${suivi.referenceCommande || fiche.numero}.pdf`,
      attachmentBuffer: pdfBuffer,
    });

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
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      throw error;
    }
  }

  private validateRequiredFields(client: any): void {
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
    const where: any = {};
    if (startDate) {
      where.dateCreation = { gte: new Date(startDate) };
    }
    const fiches = await this.prisma.fiche.findMany({
      where,
      include: { client: true },
      orderBy: { dateCreation: 'desc' },
    });
    return fiches.map((f: any) => this.unpackContent(f));
  }

  async findAllByClient(clientId: string, startDate?: string) {
    const where: any = { clientId };
    if (startDate) {
      where.dateCreation = { gte: new Date(startDate) };
    }
    const fiches = await this.prisma.fiche.findMany({
      where,
      orderBy: { dateCreation: 'desc' },
    });
    return fiches.map((f: any) => this.unpackContent(f));
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

    const { content: incomingContent, ...topLevelUpdates } = updateFicheDto;

    // Robust Merging Strategy: 
    // 1. Take existing JSON content
    // 2. Extract incoming content (either from 'content' key or from DTO itself)
    // 3. Merge them using object spread for top-level keys within the content JSON
    const currentContent = (existingFiche.content as any) || {};
    const contentToMerge = (incomingContent && typeof incomingContent === 'object') ? incomingContent : {};

    const mergedContent = {
      ...currentContent,
      ...contentToMerge
    };

    console.log(`💾 [Backend UPDATE] Merged content keys:`, Object.keys(mergedContent));

    const updated = await this.prisma.fiche.update({
      where: { id },
      data: {
        ...topLevelUpdates,
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
    let content = fiche.content || {};

    // LEGACY MAPPING: If content is flat (from Excel), map to structured objects
    if (content.OD_Sph1 !== undefined || content.Verre1D !== undefined) {
      const mappedOrdonnance = {
        od: {
          sphere: content.OD_Sph1,
          cylindre: content.OD_Cyl1,
          axe: content.OD_Axe1,
          addition: content.OD_Add1,
        },
        og: {
          sphere: content.OG_Sph1,
          cylindre: content.OG_Cyl1,
          axe: content.OG_Axe1,
          addition: content.OG_Add1,
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
      content: undefined,
    };
  }
}
