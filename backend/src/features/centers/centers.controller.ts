import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Delete,
    Query,
    ValidationPipe,
} from '@nestjs/common';
import { CentersService } from './centers.service';
import { CreateCentreDto } from './dto/create-centre.dto';
import { UpdateCentreDto } from './dto/update-centre.dto';

@Controller('centers')
export class CentersController {
    constructor(private readonly centersService: CentersService) { }

    @Post()
    create(@Body(ValidationPipe) createCentreDto: CreateCentreDto) {
        return this.centersService.create(createCentreDto);
    }

    @Get()
    findAll(@Query('groupeId') groupeId?: string) {
        return this.centersService.findAll(groupeId);
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.centersService.findOne(id);
    }

    @Patch(':id')
    update(
        @Param('id') id: string,
        @Body(ValidationPipe) updateCentreDto: UpdateCentreDto,
    ) {
        return this.centersService.update(id, updateCentreDto);
    }

    @Delete(':id')
    remove(@Param('id') id: string) {
        return this.centersService.remove(id);
    }
}
