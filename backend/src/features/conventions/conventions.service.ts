import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateConventionDto } from './dto/create-convention.dto';
import { UpdateConventionDto } from './dto/update-convention.dto';

@Injectable()
export class ConventionsService {
  constructor(private prisma: PrismaService) {}

  async create(createConventionDto: CreateConventionDto) {
    return await this.prisma.convention.create({
      data: createConventionDto,
    });
  }

  async findAll() {
    return await this.prisma.convention.findMany({
      include: {
        _count: {
          select: { clients: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const convention = await this.prisma.convention.findUnique({
      where: { id },
      include: {
        clients: true,
      },
    });

    if (!convention) {
      throw new NotFoundException(`Convention with ID ${id} not found`);
    }

    return convention;
  }

  async update(id: string, updateConventionDto: UpdateConventionDto) {
    return await this.prisma.convention.update({
      where: { id },
      data: updateConventionDto,
    });
  }

  async remove(id: string) {
    return await this.prisma.convention.delete({
      where: { id },
    });
  }
}
