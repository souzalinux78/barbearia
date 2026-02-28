import { z } from "zod";

const quickRangeSchema = z.enum(["TODAY", "7D", "30D", "MONTH", "CUSTOM"]);

const periodSchema = z.object({
  quick: quickRangeSchema.optional(),
  start: z.string().date().optional(),
  end: z.string().date().optional()
});

const scopedFiltersSchema = z.object({
  unitId: z.string().uuid().optional(),
  franchiseId: z.string().uuid().optional(),
  city: z.string().min(2).optional(),
  state: z.string().min(2).max(2).optional()
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

const franchiseQueryBaseSchema = periodSchema.merge(scopedFiltersSchema);

export const franchiseQuerySchema = franchiseQueryBaseSchema.superRefine(validatePeriod);

export const performanceQuerySchema = franchiseQueryBaseSchema
  .extend({
    rankingLimit: z.coerce.number().int().positive().max(50).default(10)
  })
  .superRefine(validatePeriod);

export const royaltiesQuerySchema = franchiseQueryBaseSchema
  .extend({
    paid: z
      .string()
      .optional()
      .transform((value) => {
        if (value === undefined) {
          return undefined;
        }
        return value === "true";
      })
  })
  .superRefine(validatePeriod);

export const monthlyRoyaltyGenerateSchema = z.object({
  month: z.coerce.number().int().min(1).max(12).optional(),
  year: z.coerce.number().int().min(2020).max(2100).optional()
});

export type FranchiseQueryInput = z.infer<typeof franchiseQuerySchema>;
export type PerformanceQueryInput = z.infer<typeof performanceQuerySchema>;
export type RoyaltiesQueryInput = z.infer<typeof royaltiesQuerySchema>;
export type MonthlyRoyaltyGenerateInput = z.infer<typeof monthlyRoyaltyGenerateSchema>;
