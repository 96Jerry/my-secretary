import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ClaudeModule } from '../../infrastructure/claude/claude.module';
import { MailModule } from '../../infrastructure/mail/mail.module';
import { FridgeModule } from '../fridge/fridge.module';
import { HealthModule } from '../health/health.module';
import { PreferenceModule } from '../preference/preference.module';
import { ScheduleDomainModule } from '../schedule/schedule.module';
import { UserModule } from '../user/user.module';
import { MealPlanController } from './controller/meal-plan.controller';
import { MEAL_PLAN_REPOSITORY } from './domain/meal-plan.repository';
import { MealPlanOrmEntity } from './repository/meal-plan.orm-entity';
import { MealPlanTypeormRepository } from './repository/meal-plan.typeorm.repository';
import { MealPlanGeneratorService } from './service/meal-plan-generator.service';
import { MealPlanService } from './service/meal-plan.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([MealPlanOrmEntity]),
    UserModule,
    FridgeModule,
    HealthModule,
    PreferenceModule,
    ScheduleDomainModule,
    ClaudeModule,
    MailModule,
  ],
  controllers: [MealPlanController],
  providers: [
    MealPlanService,
    MealPlanGeneratorService,
    { provide: MEAL_PLAN_REPOSITORY, useClass: MealPlanTypeormRepository },
  ],
  exports: [MealPlanService],
})
export class MealPlanModule {}
