import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
    constructor(private prisma: PrismaService) { }

    async create(createUserDto: CreateUserDto) {
        const { centreRoles, employeeId, ...userData } = createUserDto;

        return this.prisma.$transaction(async (tx) => {
            // Check if email already exists
            const existingUser = await tx.user.findUnique({
                where: { email: userData.email }
            });

            if (existingUser) {
                throw new ConflictException(`Un utilisateur avec l'adresse email ${userData.email} existe déjà.`);
            }

            // Check if employee is already linked
            if (employeeId) {
                const employee = await tx.employee.findUnique({
                    where: { id: employeeId }
                });

                if (!employee) {
                    throw new NotFoundException(`Employee with ID ${employeeId} not found`);
                }

                if (employee.userId) {
                    throw new ConflictException(`Cet employé est déjà lié à un compte utilisateur.`);
                }
            }

            // Hash password if provided, otherwise use default
            const password = userData.password || 'password123';
            const hashedPassword = await bcrypt.hash(password, 10);

            const user = await tx.user.create({
                data: {
                    ...userData,
                    password: hashedPassword,
                    centreRoles: {
                        create: centreRoles || [],
                    },
                },
                include: {
                    centreRoles: true,
                },
            });

            if (createUserDto.employeeId) {
                // Link the user to the employee
                await tx.employee.update({
                    where: { id: employeeId },
                    data: { userId: user.id }
                });
            }

            return user;
        });
    }

    async findAll() {
        return this.prisma.user.findMany({
            include: {
                centreRoles: true,
                employee: true
            },
        });
    }

    async findOne(id: string) {
        const user = await this.prisma.user.findUnique({
            where: { id },
            include: {
                centreRoles: true,
                employee: true // Include linked employee
            },
        });
        if (!user) {
            throw new NotFoundException(`User with ID ${id} not found`);
        }
        return user;
    }

    async update(id: string, updateUserDto: UpdateUserDto) {
        const { centreRoles, employeeId, ...userData } = updateUserDto;

        // Use a transaction to ensure roles are updated correctly
        return this.prisma.$transaction(async (tx) => {
            // Hash password if provided
            if (userData.password) {
                userData.password = await bcrypt.hash(userData.password, 10);
            }

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

            // If employeeId is provided (assuming it might be updated/changed)
            if (employeeId) {
                // Check if it's different from current? For now, just force update
                // First clear old link if necessary?
                // Or actually, if we switch employees, we might need to clear the old employee's userId
                // But typically 1 user = 1 employee.
                // Let's just update the target employee.
                // Ideally we should verify if the employee already has a user.
                await tx.employee.update({
                    where: { id: employeeId },
                    data: { userId: id }
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
