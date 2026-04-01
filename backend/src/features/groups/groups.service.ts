import { Injectable, NotFoundException, ConflictException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateGroupeDto } from './dto/create-groupe.dto';
import { UpdateGroupeDto } from './dto/update-groupe.dto';

@Injectable()
export class GroupsService {
  constructor(private prisma: PrismaService) { }

  async create(createGroupeDto: CreateGroupeDto) {
    try {
      // Sécurité : Les groupes créés depuis l'IHM "Gestion des groupes" sont toujours des groupes d'entreprise (WORK)
      if (!createGroupeDto.type) {
        createGroupeDto.type = 'WORK';
      }
      
      return await this.prisma.groupe.create({
        data: createGroupeDto,
        include: {
          centres: true,
        },
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new ConflictException(`Un groupe avec ce nom existe déjà.`);
      }
      throw new InternalServerErrorException('Erreur lors de la création du groupe');
    }
  }

  async findAll(type?: string) {
    const where: any = {};
    if (type) where.type = type;

    return this.prisma.groupe.findMany({
      where,
      include: {
        centres: {
          include: {
            entrepots: true,
          },
        },
      },
    });
  }

  async findOne(id: string) {
    const groupe = await this.prisma.groupe.findUnique({
      where: { id },
      include: {
        centres: {
          include: {
            entrepots: true,
          },
        },
      },
    });

    if (!groupe) {
      throw new NotFoundException(`Groupe with ID ${id} not found`);
    }

    return groupe;
  }

  async update(id: string, updateGroupeDto: UpdateGroupeDto) {
    try {
      return await this.prisma.groupe.update({
        where: { id },
        data: updateGroupeDto,
        include: {
          centres: true,
        },
      });
    } catch {
      throw new NotFoundException(`Groupe with ID ${id} not found`);
    }
  }

  async remove(id: string) {
    try {
      await this.prisma.groupe.delete({
        where: { id },
      });
      return { message: `Groupe with ID ${id} deleted successfully` };
    } catch {
      throw new NotFoundException(`Groupe with ID ${id} not found`);
    }
  }
}
