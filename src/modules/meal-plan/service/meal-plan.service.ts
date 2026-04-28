import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';

import { MailService } from '../../../infrastructure/mail/mail.service';
import { UserService } from '../../user/service/user.service';
import { MealPlan } from '../domain/meal-plan.entity';
import {
  MEAL_PLAN_REPOSITORY,
  type MealPlanRepository,
} from '../domain/meal-plan.repository';
import { MealPlanGeneratorService } from './meal-plan-generator.service';

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
    // const plan = await this.mealPlanRepository.findByUserAndDate(userId, date);
    // if (!plan)
    //   throw new NotFoundException(`No meal plan for ${userId} on ${date}`);
    // return plan;
    return Promise.resolve(stubPlan(userId, date, '(stub) 저장된 식단 없음'));
  }

  async generateAndSendDailyPlan(recipientEmail: string): Promise<MealPlan> {
    const user = await this.userService.findByEmail(recipientEmail);
    if (!user)
      throw new NotFoundException(`No user with email ${recipientEmail}`);
    return this.generateAndSendForUserId(user.id);
  }

  async generateAndSendForUserId(userId: string): Promise<MealPlan> {
    const user = await this.userService.findById(userId);
    const date = today();
    const content = await this.generator.generate(user.id, date);
    // const plan = await this.mealPlanRepository.save(user.id, date, content);
    const plan = stubPlan(user.id, date, content);

    await this.mailService.send({
      to: user.email,
      subject: `Today's meal plan — ${date}`,
      html: content,
    });
    this.logger.log(`Meal plan ${plan.id} sent to ${user.email}`);
    return plan;
  }
}

const STUB_ID = '00000000-0000-0000-0000-000000000050';

function stubPlan(userId: string, date: string, content: string): MealPlan {
  return new MealPlan(STUB_ID, userId, date, content, new Date());
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}
