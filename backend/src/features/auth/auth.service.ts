import { Injectable, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
    private readonly jwtSecret: string;
    private readonly refreshSecret: string;

    constructor(
        private prisma: PrismaService,
        private configService: ConfigService,
    ) {
        this.jwtSecret = this.configService.get<string>('JWT_SECRET') || 'your-very-secret-key';
        this.refreshSecret = this.configService.get<string>('REFRESH_SECRET') || 'your-very-refresh-secret-key';
    }

    async login(email: string, pass: string) {
        const user = await this.prisma.user.findUnique({
            where: { email },
            include: { centreRoles: true, employee: true }
        });

        if (!user) {
            throw new UnauthorizedException('Identifiants invalides');
        }

        const isMatch = await bcrypt.compare(pass, user.password);
        if (!isMatch) {
            throw new UnauthorizedException('Identifiants invalides');
        }

        const tokens = this.generateTokens(user);
        return {
            ...tokens,
            user: this.mapToCurrentUser(user)
        };
    }

    private generateTokens(user: any) {
        const payload = { sub: user.id, email: user.email };
        const token = jwt.sign(payload, this.jwtSecret, { expiresIn: '1d' });
        const refresh_token = jwt.sign(payload, this.refreshSecret, { expiresIn: '7d' });

        return { token, refresh_token };
    }

    async getCurrentUser(userId: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            include: { centreRoles: true, employee: true }
        });

        if (!user) {
            throw new NotFoundException('Utilisateur non trouvé');
        }

        return this.mapToCurrentUser(user);
    }

    private mapToCurrentUser(user: any) {
        // Map backend User and UserCentreRole to frontend ICurrentUser
        return {
            id: user.id,
            first_name: user.prenom,
            last_name: user.nom,
            email: user.email,
            mobile: user.telephone || '',
            address: '', // Mocked if not in schema
            is_callcenter: false,
            remember_token: '',
            menu_favoris: '',
            centers: user.centreRoles.map((cr: any) => ({
                id: cr.centreId,
                name: cr.centreName,
                role: cr.role,
                active: true,
                migrated: false,
                entrepotIds: cr.entrepotIds,
                entrepotNames: cr.entrepotNames
            })),
            employee: user.employee
        };
    }

    async refreshToken(refreshToken: string) {
        try {
            const payload = jwt.verify(refreshToken, this.refreshSecret) as any;
            const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
            if (!user) throw new UnauthorizedException();

            return this.generateTokens(user);
        } catch (e) {
            throw new UnauthorizedException('Token de rafraîchissement invalide');
        }
    }
}
