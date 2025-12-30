import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { FundingRequestsService } from './funding-requests.service';

@Controller('funding-requests')
export class FundingRequestsController {
    constructor(private readonly fundingRequestsService: FundingRequestsService) { }

    @Get()
    findAll(@Query('centreId') centreId?: string) {
        return this.fundingRequestsService.findAll(centreId);
    }

    @Post(':id/approve')
    approve(
        @Param('id') id: string,
        @Body('validatorId') validatorId: string,
    ) {
        return this.fundingRequestsService.approve(id, validatorId);
    }

    @Post(':id/reject')
    reject(
        @Param('id') id: string,
        @Body('validatorId') validatorId: string,
        @Body('remarque') remarque?: string,
    ) {
        return this.fundingRequestsService.reject(id, validatorId, remarque);
    }
}
