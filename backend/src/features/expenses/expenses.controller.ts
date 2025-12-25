import { Controller, Get, Post, Body, Param, Delete, Put, Query } from '@nestjs/common';
import { ExpensesService } from './expenses.service';
import { CreateExpenseDto } from './dto/create-expense.dto';

@Controller('expenses')
export class ExpensesController {
    constructor(private readonly expensesService: ExpensesService) { }

    @Post()
    create(@Body() createExpenseDto: CreateExpenseDto) {
        return this.expensesService.create(createExpenseDto);
    }

    @Get()
    findAll(
        @Query('centreId') centreId?: string,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string
    ) {
        return this.expensesService.findAll(centreId, startDate, endDate);
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.expensesService.findOne(id);
    }

    @Put(':id')
    update(@Param('id') id: string, @Body() updateExpenseDto: any) {
        return this.expensesService.update(id, updateExpenseDto);
    }

    @Delete(':id')
    remove(@Param('id') id: string) {
        return this.expensesService.remove(id);
    }
}
