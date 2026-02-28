import { GoalPeriod, GoalType } from "@prisma/client";
import { z } from "zod";

const quickRangeSchema = z.enum(["TODAY", "7D", "30D", "MONTH", "CUSTOM"]);

const periodBaseSchema = z.object({
  quick: quickRangeSchema.optional(),
  start: z.string().date().optional(),
  end: z.string().date().optional()
});

const validatePeriod = (
  input: { quick?: "TODAY" | "7D" | "30D" | "MONTH" | "CUSTOM"; start?: string; end?: string },
  context: z.RefinementCtx
) => {
  if ((input.start && !input.end) || (!input.start && input.end)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["start"],
      message: "Informe start e end juntos."
    });
  }

  if (input.quick === "CUSTOM" && (!input.start || !input.end)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["quick"],
      message: "quick=CUSTOM exige start e end."
    });
  }
};

export const gamificationGoalsQuerySchema = periodBaseSchema
  .extend({
    type: z.nativeEnum(GoalType).optional(),
    periodType: z.nativeEnum(GoalPeriod).optional(),
    onlyOpen: z.coerce.boolean().default(false),
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(100).default(20)
  })
  .superRefine(validatePeriod);

export const gamificationProgressQuerySchema = periodBaseSchema
  .extend({
    type: z.nativeEnum(GoalType).optional()
  })
  .superRefine(validatePeriod);

export const gamificationRankingQuerySchema = periodBaseSchema
  .extend({
    scope: z.enum(["UNIT", "FRANCHISE"]).default("UNIT"),
    limit: z.coerce.number().int().positive().max(100).default(20)
  })
  .superRefine(validatePeriod);

export const gamificationBadgesQuerySchema = z.object({
  userId: z.string().uuid().optional()
});

export const gamificationChallengesQuerySchema = periodBaseSchema
  .extend({
    activeOnly: z.coerce.boolean().default(true)
  })
  .superRefine(validatePeriod);

export const createGoalSchema = z
  .object({
    type: z.nativeEnum(GoalType),
    targetValue: z.coerce.number().positive(),
    period: z.nativeEnum(GoalPeriod),
    startDate: z.string().date(),
    endDate: z.string().date(),
    unitId: z.string().uuid().optional(),
    userId: z.string().uuid().optional()
  })
  .superRefine((input, context) => {
    if (new Date(input.startDate).getTime() > new Date(input.endDate).getTime()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["startDate"],
        message: "startDate deve ser menor ou igual a endDate."
      });
    }
  });

export const createChallengeSchema = z
  .object({
    name: z.string().trim().min(3).max(120),
    description: z.string().trim().min(3).max(600),
    targetType: z.nativeEnum(GoalType),
    targetValue: z.coerce.number().positive(),
    rewardPoints: z.coerce.number().int().positive().max(10000),
    startDate: z.string().date(),
    endDate: z.string().date(),
    active: z.boolean().default(true)
  })
  .superRefine((input, context) => {
    if (new Date(input.startDate).getTime() > new Date(input.endDate).getTime()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["startDate"],
        message: "startDate deve ser menor ou igual a endDate."
      });
    }
  });

export type GamificationGoalsQueryInput = z.infer<typeof gamificationGoalsQuerySchema>;
export type GamificationProgressQueryInput = z.infer<typeof gamificationProgressQuerySchema>;
export type GamificationRankingQueryInput = z.infer<typeof gamificationRankingQuerySchema>;
export type GamificationBadgesQueryInput = z.infer<typeof gamificationBadgesQuerySchema>;
export type GamificationChallengesQueryInput = z.infer<typeof gamificationChallengesQuerySchema>;
export type CreateGoalInput = z.infer<typeof createGoalSchema>;
export type CreateChallengeInput = z.infer<typeof createChallengeSchema>;
