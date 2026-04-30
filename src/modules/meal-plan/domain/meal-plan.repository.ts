import { MealPlan } from './meal-plan.entity.js';

export const MEAL_PLAN_REPOSITORY = Symbol('MEAL_PLAN_REPOSITORY');

export interface MealPlanRepository {
  findByUserAndDate(userId: string, date: string): Promise<MealPlan | null>;
  save(userId: string, date: string, content: string): Promise<MealPlan>;
}
