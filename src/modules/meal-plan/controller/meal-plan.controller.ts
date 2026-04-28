import { Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';

import { MealPlan } from '../domain/meal-plan.entity';
import { MealPlanService } from '../service/meal-plan.service';

@Controller('users/:userId/meal-plans')
export class MealPlanController {
  constructor(private readonly mealPlanService: MealPlanService) {}

  @Get(':date')
  getForDate(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('date') date: string,
  ): Promise<MealPlan> {
    return this.mealPlanService.getForDate(userId, date);
  }

  @Post('today/send')
  sendToday(@Param('userId', ParseUUIDPipe) userId: string): Promise<MealPlan> {
    return this.mealPlanService.generateAndSendForUserId(userId);
  }
}
