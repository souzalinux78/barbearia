import { z } from "zod";

export const quickRangeSchema = z.enum(["TODAY", "7D", "30D", "MONTH", "CUSTOM"]);

const dashboardPeriodBaseSchema = z.object({
  quick: quickRangeSchema.optional(),
  start: z.string().date().optional(),
  end: z.string().date().optional()
});

const validatePeriodRange = (
  input: { quick?: "TODAY" | "7D" | "30D" | "MONTH" | "CUSTOM"; start?: string; end?: string },
  context: z.RefinementCtx
) => {
  const hasStart = Boolean(input.start);
  const hasEnd = Boolean(input.end);

  if (hasStart !== hasEnd) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["start"],
      message: "Informe start e end juntos para periodo personalizado."
    });
  }

  if (input.quick === "CUSTOM" && (!hasStart || !hasEnd)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["quick"],
      message: "quick=CUSTOM exige start e end."
    });
  }
};

export const dashboardPeriodQuerySchema = dashboardPeriodBaseSchema.superRefine(validatePeriodRange);

export const advancedMetricsQuerySchema = dashboardPeriodBaseSchema
  .extend({
    churnWindowDays: z.coerce.number().int().min(15).max(365).default(60)
  })
  .superRefine(validatePeriodRange);

export const exportQuerySchema = dashboardPeriodBaseSchema
  .extend({
    format: z.enum(["pdf", "excel"])
  })
  .superRefine(validatePeriodRange);

export type DashboardPeriodQueryInput = z.infer<typeof dashboardPeriodQuerySchema>;
export type AdvancedMetricsQueryInput = z.infer<typeof advancedMetricsQuerySchema>;
export type ExportQueryInput = z.infer<typeof exportQuerySchema>;
