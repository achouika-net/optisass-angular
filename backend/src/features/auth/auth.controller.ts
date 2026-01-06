import { Controller, Post, Get, Body, UnauthorizedException, Req, Headers } from '@nestjs/common';
import { AuthService } from './auth.service';
import * as jwt from 'jsonwebtoken';
import { ConfigService } from '@nestjs/config';

@Controller() // The global prefix 'api' is already set in main.ts
export class AuthController {
    constructor(
        private authService: AuthService,
        private configService: ConfigService
    ) { }

    @Post('login')
    async login(@Body() body: any) {
        return this.authService.login(body.email, body.password);
    }

    @Get('me')
    async getMe(@Headers('authorization') authHeader: string) {
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new UnauthorizedException('Token manquant');
        }

        const token = authHeader.split(' ')[1];
        try {
            const secret = this.configService.get<string>('JWT_SECRET') || 'your-very-secret-key';
            const payload = jwt.verify(token, secret) as any;
            return this.authService.getCurrentUser(payload.sub);
        } catch (e) {
            throw new UnauthorizedException('Token invalide');
        }
    }

    @Post('refresh_token')
    async refresh(@Body() body: any) {
        return this.authService.refreshToken(body.refresh_token);
    }
}
