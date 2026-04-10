import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCentreDto } from './dto/create-centre.dto';
import { UpdateCentreDto } from './dto/update-centre.dto';

@Injectable()
export class CentersService {
  constructor(private prisma: PrismaService) {}

  async create(createCentreDto: CreateCentreDto) {
    return this.prisma.centre.create({
      data: createCentreDto,
      include: {
        groupe: true,
        entrepots: true,
      },
    });
  }

  async findAll(groupeId?: string) {
    try {
      return await this.prisma.centre.findMany({
        where: groupeId ? { groupeId } : undefined,
        include: {
          groupe: true,
          entrepots: true,
        },
      });
    } catch (error) {
      console.error('[CENTERS-SERVICE] Error in findAll:', error);
      // Fallback to centers without relations if it fails due to relationship missing
      return this.prisma.centre.findMany({
        where: groupeId ? { groupeId } : undefined
      });
    }
  }

  async findOne(id: string) {
    const centre = await this.prisma.centre.findUnique({
      where: { id },
      include: {
        groupe: true,
        entrepots: true,
      },
    });

    if (!centre) {
      throw new NotFoundException(`Centre with ID ${id} not found`);
    }

    return centre;
  }

  async update(id: string, updateCentreDto: UpdateCentreDto) {
    try {
      return await this.prisma.centre.update({
        where: { id },
        data: updateCentreDto,
        include: {
          groupe: true,
          entrepots: true,
        },
      });
    } catch (error) {
      throw new NotFoundException(`Centre with ID ${id} not found`);
    }
  }

  async remove(id: string) {
    try {
      await this.prisma.centre.delete({
        where: { id },
      });
      return { message: `Centre with ID ${id} deleted successfully` };
    } catch (error) {
      throw new NotFoundException(`Centre with ID ${id} not found`);
    }
  }
}
