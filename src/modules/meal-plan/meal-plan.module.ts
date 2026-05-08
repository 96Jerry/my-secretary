import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ClaudeModule } from '@infra/claude/claude.module.js';
import { MailModule } from '@infra/mail/mail.module.js';
import { FridgeModule } from '../fridge/fridge.module.js';
import { HealthModule } from '../health/health.module.js';
import { MealLogModule } from '../meal-log/meal-log.module.js';
import { PreferenceModule } from '../preference/preference.module.js';
import { ScheduleDomainModule } from '../schedule/schedule.module.js';
import { SituationModule } from '../situation/situation.module.js';
import { UserModule } from '../user/user.module.js';
import { MealPlanController } from './controller/meal-plan.controller.js';
import { MEAL_PLAN_REPOSITORY } from './domain/meal-plan.repository.js';
import { MealPlanOrmEntity } from './repository/meal-plan.orm-entity.js';
import { MealPlanTypeormRepository } from './repository/meal-plan.typeorm.repository.js';
import { MealPlanGeneratorService } from './service/meal-plan-generator.service.js';
import { MealPlanService } from './service/meal-plan.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([MealPlanOrmEntity]),
    UserModule,
    FridgeModule,
    HealthModule,
    PreferenceModule,
    ScheduleDomainModule,
    SituationModule,
    MealLogModule,
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
