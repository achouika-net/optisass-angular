import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateVerreBrandDto, UpdateVerreBrandDto } from "./dto/create-verre-brand.dto";

@Injectable()
export class VerreBrandService {
  constructor(private prisma: PrismaService) {}

  private async calcPrixVente(brandId: string, prixAchat: number, prixVenteManuel?: number): Promise<number | null> {
    if (prixVenteManuel !== undefined && prixVenteManuel !== null) {
      return prixVenteManuel;
    }
    const brand = await this.prisma.glassBrand.findUnique({
      where: { id: brandId },
      select: { margeDefaut: true },
    });
    if (brand?.margeDefaut && brand.margeDefaut > 0 && brand.margeDefaut < 100) {
      return Math.round(prixAchat / (1 - brand.margeDefaut / 100));
    }
    return null;
  }

  async create(dto: CreateVerreBrandDto) {
    const prixVente = await this.calcPrixVente(dto.brandId, dto.prixAchat, dto.prixVente);
    return this.prisma.verreMarque.create({
      data: {
        glassIndexId: dto.glassIndexId,
        brandId: dto.brandId,
        epaisseur: dto.epaisseur ?? null,
        prixAchat: dto.prixAchat,
        prixVente: prixVente,
        reference: dto.reference ?? null,
        notes: dto.notes ?? null,
        actif: dto.actif ?? true,
      },
      include: {
        brand: { select: { id: true, name: true, margeDefaut: true } },
        glassIndex: { include: { material: true } },
      },
    });
  }

  async findAll(filters?: { brandId?: string; glassIndexId?: string; actif?: boolean }) {
    return this.prisma.verreMarque.findMany({
      where: {
        ...(filters?.brandId && { brandId: filters.brandId }),
        ...(filters?.glassIndexId && { glassIndexId: filters.glassIndexId }),
        ...(filters?.actif !== undefined && { actif: filters.actif }),
      },
      include: {
        brand: { select: { id: true, name: true, margeDefaut: true } },
        glassIndex: {
          include: { material: { select: { id: true, name: true } } },
        },
      },
      orderBy: [{ brand: { name: "asc" } }, { epaisseur: "asc" }],
    });
  }

  async compareByGlassIndex(glassIndexId: string) {
    const verres = await this.prisma.verreMarque.findMany({
      where: { glassIndexId, actif: true },
      include: {
        brand: { select: { id: true, name: true, margeDefaut: true } },
        glassIndex: { include: { material: true } },
      },
      orderBy: { epaisseur: "asc" },
    });

    if (verres.length === 0) return { glassIndexId, brands: [] };

    const glassIndex = verres[0].glassIndex;
    return {
      glassIndex: {
        id: glassIndex.id,
        value: glassIndex.value,
        label: glassIndex.label,
        material: glassIndex.material?.name,
        prixGeneriqueDefaut: glassIndex.price,
      },
      brands: verres.map((v) => ({
        id: v.id,
        brandId: v.brandId,
        brandName: v.brand.name,
        epaisseur: v.epaisseur,
        prixAchat: v.prixAchat,
        prixVente: v.prixVente,
        marge: v.prixVente
          ? Math.round(((v.prixVente - v.prixAchat) / v.prixVente) * 100 * 10) / 10
          : v.brand.margeDefaut,
        reference: v.reference,
        quantite: v.quantite,
        notes: v.notes,
      })),
    };
  }

  async findByBrand(brandId: string) {
    return this.prisma.verreMarque.findMany({
      where: { brandId },
      include: {
        glassIndex: { include: { material: true } },
        brand: { select: { id: true, name: true, margeDefaut: true } },
      },
      orderBy: [
        { glassIndex: { material: { name: "asc" } } },
        { glassIndex: { value: "asc" } },
      ],
    });
  }

  async findOne(id: string) {
    const vm = await this.prisma.verreMarque.findUnique({
      where: { id },
      include: {
        brand: { select: { id: true, name: true, margeDefaut: true } },
        glassIndex: { include: { material: true } },
      },
    });
    if (!vm) throw new NotFoundException("VerreMarque introuvable");
    return vm;
  }

  async update(id: string, dto: UpdateVerreBrandDto) {
    const existing = await this.findOne(id);
    let prixVente: number | null | undefined = dto.prixVente;

    if (dto.prixAchat !== undefined && dto.prixVente === undefined) {
      prixVente = await this.calcPrixVente(existing.brandId, dto.prixAchat);
    }

    return this.prisma.verreMarque.update({
      where: { id },
      data: {
        ...(dto.epaisseur !== undefined && { epaisseur: dto.epaisseur }),
        ...(dto.prixAchat !== undefined && { prixAchat: dto.prixAchat }),
        ...(prixVente !== undefined && { prixVente }),
        ...(dto.reference !== undefined && { reference: dto.reference }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.actif !== undefined && { actif: dto.actif }),
      },
      include: {
        brand: { select: { id: true, name: true, margeDefaut: true } },
        glassIndex: { include: { material: true } },
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.verreMarque.delete({ where: { id } });
  }

  async recalcPrixVenteForBrand(brandId: string, nouvelleMarge: number) {
    if (nouvelleMarge <= 0 || nouvelleMarge >= 100) {
      throw new BadRequestException("La marge doit être entre 1 et 99%");
    }

    const verres = await this.prisma.verreMarque.findMany({
      where: { brandId, actif: true },
    });

    const updates = verres.map((v) =>
      this.prisma.verreMarque.update({
        where: { id: v.id },
        data: {
          prixVente: Math.round(v.prixAchat / (1 - nouvelleMarge / 100)),
        },
      })
    );

    await this.prisma.$transaction(updates);
    return { updated: verres.length, nouvelleMarge };
  }

  async ajusterStock(id: string, delta: number, motif: string, userId?: string) {
    await this.findOne(id);
    return this.prisma.$transaction(async (tx) => {
      const vm = await tx.verreMarque.update({
        where: { id },
        data: { quantite: { increment: delta } },
        include: {
          brand: { select: { id: true, name: true } },
          glassIndex: { include: { material: true } },
        },
      });

      await tx.mouvementStock.create({
        data: {
          type: delta > 0 ? "ENTREE" : "SORTIE",
          quantite: delta,
          verreMarqueId: id,
          motif: motif || "Ajustement manuel stock verre marque",
          userId: userId || null,
        },
      });

      return vm;
    });
  }

  async getHistoriqueStock(id: string) {
    return this.prisma.mouvementStock.findMany({
      where: { verreMarqueId: id },
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, prenom: true, nom: true } },
      },
    });
  }
}
