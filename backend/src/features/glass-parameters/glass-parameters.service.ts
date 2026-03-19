import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class GlassParametersService {
  constructor(private prisma: PrismaService) {}

  async seedInitialData() {
    const brands = [
      'Essilor', 'Zeiss', 'Hoya', 'Nikon', 'Rodenstock', 'Seiko',
      'BBGR', 'Optiswiss', 'Shamir', 'Kodak', 'Generic', 'Autre'
    ];

    const materials = {
      'Organique (CR-39)': {
        '1.50 (Standard)': 200,
        '1.56': 250,
        '1.60': 350,
        '1.67': 500
      },
      'Polycarbonate': {
        '1.59': 400
      },
      'Trivex': {
        '1.53': 450
      },
      'Minéral': {
        '1.523': 150,
        '1.60': 300,
        '1.70': 500,
        '1.80': 800,
        '1.90': 1200
      },
      'Organique MR-8': {
        '1.60': 500
      },
      'Organique MR-7': {
        '1.67': 700
      },
      'Blue Cut Mass': {
        '1.56': 400,
        '1.60': 600,
        '1.67': 800
      }
    };

    const treatments = {
      'Anti-reflet (HMC)': 100,
      'Durci (HC)': 50,
      'Super Anti-reflet (SHMC)': 150,
      'Anti-lumière bleue (Blue Cut)': 200,
      'Photochromique (Transitions)': 600,
      'Teinté (Solaire - Gris)': 150,
      'Teinté (Solaire - Brun)': 150,
      'Teinté (Solaire - Vert)': 150,
      'Polarisé': 400,
      'Miroité': 250,
      'Hydrophobe': 100,
    };

    // Seed Brands
    for (const name of brands) {
      await this.prisma.glassBrand.upsert({
        where: { name },
        update: {},
        create: { name }
      });
    }

    // Seed Materials & Indices
    for (const [matName, indices] of Object.entries(materials)) {
      const material = await this.prisma.glassMaterial.upsert({
        where: { name: matName },
        update: {},
        create: { name: matName }
      });

      for (const [idxValue, price] of Object.entries(indices)) {
        await this.prisma.glassIndex.upsert({
          where: {
            materialId_value: {
              materialId: material.id,
              value: idxValue
            }
          },
          update: { price },
          create: {
            materialId: material.id,
            value: idxValue,
            label: idxValue,
            price
          }
        });
      }
    }

    // Seed Treatments
    for (const [name, price] of Object.entries(treatments)) {
      await this.prisma.glassTreatment.upsert({
        where: { name },
        update: { price },
        create: { name, price }
      });
    }

    return { message: 'Seeding completed successfully' };
  }

  async getAllParameters() {
    const [brands, materials, treatments] = await Promise.all([
      this.prisma.glassBrand.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.glassMaterial.findMany({
        include: { indices: { orderBy: { value: 'asc' } } },
        orderBy: { name: 'asc' },
      }),
      this.prisma.glassTreatment.findMany({ orderBy: { name: 'asc' } }),
    ]);

    return { brands, materials, treatments };
  }

  // Brands
  async createBrand(name: string) {
    return this.prisma.glassBrand.create({ data: { name } });
  }

  async deleteBrand(id: string) {
    return this.prisma.glassBrand.delete({ where: { id } });
  }

  // Materials
  async createMaterial(name: string) {
    return this.prisma.glassMaterial.create({ data: { name } });
  }

  async deleteMaterial(id: string) {
    return this.prisma.glassMaterial.delete({ where: { id } });
  }

  // Indices
  async createIndex(materialId: string, value: string, label?: string, price?: number) {
    return this.prisma.glassIndex.create({
      data: { materialId, value, label, price: price || 0 },
    });
  }

  async updateIndex(id: string, data: { value?: string; label?: string; price?: number }) {
    return this.prisma.glassIndex.update({
      where: { id },
      data,
    });
  }

  async deleteIndex(id: string) {
    return this.prisma.glassIndex.delete({ where: { id } });
  }

  // Treatments
  async createTreatment(name: string, price?: number) {
    return this.prisma.glassTreatment.create({
      data: { name, price: price || 0 },
    });
  }

  async updateTreatment(id: string, data: { name?: string; price?: number }) {
    return this.prisma.glassTreatment.update({
      where: { id },
      data,
    });
  }

  async deleteTreatment(id: string) {
    return this.prisma.glassTreatment.delete({ where: { id } });
  }
}
