import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
    constructor(private prisma: PrismaService) { }

    async create(createUserDto: CreateUserDto) {
        const { centreRoles, ...userData } = createUserDto;

        return this.prisma.user.create({
            data: {
                ...userData,
                centreRoles: {
                    create: centreRoles || [],
                },
            },
            include: {
                centreRoles: true,
            },
        });
    }

    async findAll() {
        return this.prisma.user.findMany({
            include: {
                centreRoles: true,
            },
        });
    }

    async findOne(id: string) {
        const user = await this.prisma.user.findUnique({
            where: { id },
            include: {
                centreRoles: true,
            },
        });
        if (!user) {
            throw new NotFoundException(`User with ID ${id} not found`);
        }
        return user;
    }

    async update(id: string, updateUserDto: UpdateUserDto) {
        const { centreRoles, ...userData } = updateUserDto;

        // Use a transaction to ensure roles are updated correctly
        return this.prisma.$transaction(async (tx) => {
            // Update basic user data
            const updatedUser = await tx.user.update({
                where: { id },
                data: userData,
            });

            // If centreRoles are provided, replace existing ones
            if (centreRoles) {
                // Delete existing roles
                await tx.userCentreRole.deleteMany({
                    where: { userId: id },
                });

                // Create new roles
                await tx.userCentreRole.createMany({
                    data: centreRoles.map((role) => ({
                        ...role,
                        userId: id,
                    })),
                });
            }

            return tx.user.findUnique({
                where: { id },
                include: {
                    centreRoles: true,
                },
            });
        });
    }

    async remove(id: string) {
        try {
            await this.prisma.user.delete({
                where: { id },
            });
            return { message: `User with ID ${id} deleted successfully` };
        } catch (error) {
            throw new NotFoundException(`User with ID ${id} not found`);
        }
    }
}
