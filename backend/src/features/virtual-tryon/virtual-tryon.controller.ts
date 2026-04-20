import { Controller, Post, Get, Delete, Body, Param, Request, BadRequestException, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { VirtualTryonService } from './virtual-tryon.service';
import { CreateVirtualTryonDto } from './dto/create-virtual-tryon.dto';
import { Cache } from 'cache-manager';

@Controller('virtual-tryon')
export class VirtualTryonController {
    constructor(
        private readonly virtualTryonService: VirtualTryonService,
        @Inject(CACHE_MANAGER) private cacheManager: Cache,
    ) { }

    /**
     * POST /virtual-tryon
     * Create new virtual try-on session
     */
    @Post()
    async createTryon(@Body() dto: CreateVirtualTryonDto, @Request() req) {
        const centreId = req.user.centreId;
        if (!centreId) {
            throw new BadRequestException('User must have a centre');
        }

        return this.virtualTryonService.createTryon(dto, centreId);
    }

    /**
     * GET /virtual-tryon/history/:clientId
     * Get try-on history for client
     */
    @Get('history/:clientId')
    async getHistory(@Param('clientId') clientId: string, @Request() req) {
        const centreId = req.user.centreId;
        const cacheKey = `tryon-history-${clientId}-${centreId}`;

        // Try cache first
        const cached = await this.cacheManager.get(cacheKey);
        if (cached) {
            return cached;
        }

        const history = await this.virtualTryonService.getClientHistory(clientId, centreId);

        // Cache for 5 minutes
        await this.cacheManager.set(cacheKey, history, 5 * 60 * 1000);

        return history;
    }

    /**
     * GET /virtual-tryon/analytics
     * Get centre try-on analytics
     */
    @Get('analytics')
    async getAnalytics(@Request() req) {
        const centreId = req.user.centreId;
        const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Last 30 days
        const endDate = new Date();

        return this.virtualTryonService.getAnalytics(centreId, startDate, endDate);
    }

    /**
     * DELETE /virtual-tryon/:id
     * Delete try-on session
     */
    @Delete(':id')
    async deleteTryon(@Param('id') id: string, @Request() req) {
        const centreId = req.user.centreId;
        return this.virtualTryonService.deleteTryon(id, centreId);
    }
}
