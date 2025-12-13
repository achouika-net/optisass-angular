import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class FacturesService {
    constructor(private prisma: PrismaService) { }

    async create(data: Prisma.FactureUncheckedCreateInput) {
        // 1. Vérifier que le client existe
        const client = await this.prisma.client.findUnique({
            where: { id: data.clientId }
        });

        if (!client) {
            throw new NotFoundException(`Client ${data.clientId} non trouvé`);
        }

        // 2. Valider les lignes (si c'est un objet JSON)
        if (!data.lignes || (Array.isArray(data.lignes) && data.lignes.length === 0)) {
            throw new BadRequestException('La facture doit contenir au moins une ligne');
        }

        // 3. Generate number based on status
        const type = data.type; // FACTURE, DEVIS, AVOIR, BL
        let numero = '';

        if (data.statut === 'BROUILLON') {
            // Temporary number for drafts
            numero = `BRO-${new Date().getTime()}`;
        } else {
            // Official sequential number for validated documents
            const year = new Date().getFullYear();
            const prefix = this.getPrefix(type);

            // Find last document of this type for current year
            const lastDoc = await this.prisma.facture.findFirst({
                where: {
                    type: type,
                    numero: {
                        startsWith: `${prefix}-${year}`
                    }
                },
                orderBy: {
                    createdAt: 'desc'
                }
            });

            let sequence = 1;
            if (lastDoc) {
                const parts = lastDoc.numero.split('-');
                if (parts.length === 3) {
                    sequence = parseInt(parts[2]) + 1;
                }
            }

            numero = `${prefix}-${year}-${sequence.toString().padStart(3, '0')}`;
        }

        // 4. Créer la facture
        const facture = await this.prisma.facture.create({
            data: {
                ...data,
                numero,
                statut: data.statut || 'BROUILLON',
                resteAPayer: data.totalTTC || 0
            }
        });

        return facture;
    }

    async findAll(params: {
        skip?: number;
        take?: number;
        cursor?: Prisma.FactureWhereUniqueInput;
        where?: Prisma.FactureWhereInput;
        orderBy?: Prisma.FactureOrderByWithRelationInput;
    }) {
        const { skip, take, cursor, where, orderBy } = params;
        return this.prisma.facture.findMany({
            skip,
            take,
            cursor,
            where,
            orderBy,
            include: {
                client: true,
                fiche: true,
                paiements: true
            }
        });
    }

    async findOne(id: string) {
        return this.prisma.facture.findUnique({
            where: { id },
            include: {
                client: true,
                fiche: true,
                paiements: true
            }
        });
    }

    async update(params: {
        where: Prisma.FactureWhereUniqueInput;
        data: Prisma.FactureUpdateInput;
    }) {
        const { where, data } = params;

        // Check if we are validating a draft (VALIDE only triggers numbering now)
        // User requested that PARTIEL status is kept if balance exists, so we only trigger on VALIDE intent.
        if (data.statut === 'VALIDE') {
            const currentFacture = await this.prisma.facture.findUnique({
                where,
                include: { paiements: true }
            });

            // If currently BROUILLON or has temp number, assign official number
            if (currentFacture && (currentFacture.statut === 'BROUILLON' || currentFacture.numero.startsWith('BRO'))) {
                console.log('🔄 Validating Draft Invoice:', currentFacture.numero);
                const year = new Date().getFullYear();
                const prefix = this.getPrefix(currentFacture.type);
                console.log('📌 Generated Prefix:', prefix);

                // Find the highest number for this year/prefix
                const lastDoc = await this.prisma.facture.findFirst({
                    where: {
                        type: currentFacture.type,
                        numero: { startsWith: `${prefix}-${year}` }
                    },
                    orderBy: {
                        numero: 'desc' // Sort by Number to get the highest sequence
                    }
                });

                let sequence = 1;
                if (lastDoc) {
                    console.log('📄 Last Document found:', lastDoc.numero);
                    const parts = lastDoc.numero.split('-');
                    if (parts.length === 3) {
                        const lastSeq = parseInt(parts[2]);
                        if (!isNaN(lastSeq)) {
                            sequence = lastSeq + 1;
                        }
                    }
                } else {
                    console.log('✨ No previous document found, starting at 1');
                }

                // Generate candidate and check for collision
                let candidateNumero = `${prefix}-${year}-${String(sequence).padStart(3, '0')}`;

                // Safety loop to prevent duplicates
                let attempts = 0;
                while (attempts < 5) {
                    const exists = await this.prisma.facture.findUnique({
                        where: { numero: candidateNumero }
                    });
                    if (!exists) break;

                    console.warn(`⚠️ Collision detected for ${candidateNumero}, incrementing...`);
                    sequence++;
                    data.numero = candidateNumero;
                    console.log('✅ Assigning new Number:', data.numero);

                    // 3. Post-Validation Status Check
                    // Although user selected "VALIDE" (Intent: Official), actual status depends on payments
                    let totalPaye = 0;
                    if (currentFacture.paiements) {
                        totalPaye = currentFacture.paiements.reduce((sum, p) => sum + p.montant, 0);
                    }

                    // If not fully paid, force status back to PARTIEL or IMPAYEE
                    if (totalPaye < currentFacture.totalTTC) {
                        // If we have some payment, it's PARTIEL. If 0 (and strict), IMPAYEE.
                        // User specified: "affiche PARTIEL". We'll default to PARTIEL if > 0, probably IMPAYEE if 0?
                        // Currently assuming PARTIEL is safer if they want to track balance.
                        // But if 0 paid, usually it's IMPAYEE. Let's check logic:
                        data.statut = totalPaye > 0 ? 'PARTIEL' : 'IMPAYEE';
                        // Wait, if 0 paid, usually "VALIDE" means "Issued/Impoyee" in some systems.
                        // But here user insists on "PARTIEL" if there is a remainder.
                        // Let's stick to: if remainder > 0 -> PARTIEL.
                        // Actually, if totalPaye === 0, status VALIDE is usually fine (meaning "Issued, waiting for payment").
                        // User said "quand il y a un reste de payer affiche partiel".
                        // So if paid > 0 and < total, FORCE PARTIEL.
                        if (totalPaye > 0) {
                            data.statut = 'PARTIEL';
                        }
                        // If totalPaye == 0, we leave it as VALIDE (standard "Issued" state)
                    }
                }
            }

            return this.prisma.facture.update({
                data,
                where,
            });
        }
    }

    async remove(where: Prisma.FactureWhereUniqueInput) {
        // Vérifier que la facture existe
        const facture = await this.prisma.facture.findUnique({
            where,
            include: { paiements: true }
        });

        if (!facture) {
            throw new NotFoundException('Facture non trouvée');
        }

        // Bloquer si facture validée ou payée
        if (facture.statut === 'VALIDE' || facture.statut === 'PAYEE' || facture.statut === 'PARTIEL') {
            throw new BadRequestException(
                'Impossible de supprimer une facture validée ou avec paiements. Créez un avoir à la place.'
            );
        }

        // Bloquer si des paiements existent
        if (facture.paiements && facture.paiements.length > 0) {
            throw new BadRequestException(
                'Impossible de supprimer une facture avec des paiements'
            );
        }

        return this.prisma.facture.delete({
            where,
        });
    }

    private getPrefix(type: string): string {
        switch (type) {
            case 'FACTURE': return 'FAC';
            case 'DEVIS': return 'DEV';
            case 'AVOIR': return 'AVR';
            case 'BL': return 'BL';
            default: return 'DOC';
        }
    }
}
