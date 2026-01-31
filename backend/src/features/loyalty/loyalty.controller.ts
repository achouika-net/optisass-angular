import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { LoyaltyService } from './loyalty.service';

@Controller('loyalty')
export class LoyaltyController {
    constructor(private readonly loyaltyService: LoyaltyService) { }

    @Get('history/:clientId')
    getPointsHistory(@Param('clientId') clientId: string) {
        return this.loyaltyService.getPointsHistory(clientId);
    }

    @Get('balance/:clientId')
    getPointsBalance(@Param('clientId') clientId: string) {
        return this.loyaltyService.getPointsBalance(clientId);
    }

    @Post('spend')
    spendPoints(@Body() body: { clientId: string, points: number, description: string }) {
        return this.loyaltyService.spendPoints(body.clientId, body.points, body.description);
    }

    @Get('config')
    getConfig() {
        return this.loyaltyService.getConfig();
    }

    @Post('config')
    updateConfig(@Body() body: any) {
        return this.loyaltyService.updateConfig(body);
    }

    // NEW: Check reward eligibility
    @Get('check-eligibility/:clientId')
    checkEligibility(@Param('clientId') clientId: string) {
        return this.loyaltyService.checkRewardEligibility(clientId);
    }

    // NEW: Redeem reward
    @Post('redeem')
    redeemReward(@Body() body: { clientId: string, rewardType: 'DISCOUNT' | 'MAD_BONUS', redeemedBy?: string }) {
        return this.loyaltyService.redeemReward(body.clientId, body.rewardType, body.redeemedBy);
    }

    // NEW: Get redemption history
    @Get('redemptions/:clientId')
    getRedemptions(@Param('clientId') clientId: string) {
        return this.loyaltyService.getRedemptionHistory(clientId);
    }
}
