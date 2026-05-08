import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';

import { MailService } from '@infra/mail/mail.service.js';
import { UserService } from '../../user/service/user.service.js';
import { MealPlan } from '../domain/meal-plan.entity.js';
import {
  MEAL_PLAN_REPOSITORY,
  type MealPlanRepository,
} from '../domain/meal-plan.repository.js';
import { MealPlanGeneratorService } from './meal-plan-generator.service.js';

@Injectable()
export class MealPlanService {
  private readonly logger = new Logger(MealPlanService.name);

  constructor(
    @Inject(MEAL_PLAN_REPOSITORY)
    private readonly mealPlanRepository: MealPlanRepository,
    private readonly userService: UserService,
    private readonly generator: MealPlanGeneratorService,
    private readonly mailService: MailService,
  ) {}

  async getForDate(userId: string, date: string): Promise<MealPlan> {
    const plan = await this.mealPlanRepository.findByUserAndDate(userId, date);
    if (!plan)
      throw new NotFoundException(`No meal plan for ${userId} on ${date}`);
    return plan;
  }

  async generateAndSendDailyPlan(recipientEmail: string): Promise<MealPlan> {
    const user = await this.userService.findByEmail(recipientEmail);
    if (!user)
      throw new NotFoundException(`No user with email ${recipientEmail}`);
    return this.generateAndSendForUserId(user.id);
  }

  async generateAndSendForUserId(userId: string): Promise<MealPlan> {
    const user = await this.userService.findById(userId);
    if (!user.email) {
      throw new NotFoundException(
        `User ${user.id} has no email; cannot send meal plan`,
      );
    }
    const date = today();
    const content = await this.generator.generate(user.id, date);
    const plan = await this.mealPlanRepository.save(user.id, date, content);

    await this.mailService.send({
      to: user.email,
      subject: `Today's meal plan — ${date}`,
      html: content,
    });
    this.logger.log(`Meal plan ${plan.id} sent to ${user.email}`);
    return plan;
  }
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}
