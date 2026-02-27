import { ExpenseType, PaymentMethod, PaymentStatus } from "@prisma/client";
import { z } from "zod";

export const periodQuerySchema = z
  .object({
    start: z.string().date().optional(),
    end: z.string().date().optional(),
    quick: z.enum(["TODAY", "7D", "30D", "MONTH"]).optional()
  });

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20)
});

export const cashflowQuerySchema = periodQuerySchema.merge(paginationQuerySchema);

export const createExpenseSchema = z.object({
  description: z.string().min(3).max(200),
  category: z.string().min(2).max(100),
  amount: z.coerce.number().positive(),
  type: z.nativeEnum(ExpenseType),
  dueDate: z.string().date(),
  paid: z.boolean().optional(),
  paidAt: z.string().datetime().optional()
});

export const updateExpenseSchema = createExpenseSchema.partial();

export const expenseIdParamSchema = z.object({
  id: z.string().uuid()
});

export const listExpensesQuerySchema = periodQuerySchema
  .merge(paginationQuerySchema)
  .merge(
    z.object({
      paid: z
        .string()
        .optional()
        .transform((value) => {
          if (value === undefined) {
            return undefined;
          }
          return value === "true";
        }),
      type: z.nativeEnum(ExpenseType).optional()
    })
  );

export const listCommissionsQuerySchema = periodQuerySchema.merge(paginationQuerySchema);

export const commissionIdParamSchema = z.object({
  id: z.string().uuid()
});

export const payCommissionSchema = z.object({
  paid: z.boolean().default(true),
  percentage: z.coerce.number().positive().max(100).optional(),
  amount: z.coerce.number().positive().optional()
});

export const dreQuerySchema = z.object({
  start: z.string().date(),
  end: z.string().date()
});

export const metricsQuerySchema = periodQuerySchema;

export const createManualPaymentSchema = z.object({
  appointmentId: z.string().uuid().optional(),
  clientId: z.string().uuid(),
  amount: z.coerce.number().positive(),
  method: z.nativeEnum(PaymentMethod),
  status: z.nativeEnum(PaymentStatus).default(PaymentStatus.PAGO),
  paidAt: z.string().datetime().optional(),
  notes: z.string().max(400).optional()
});

export type CashflowQueryInput = z.infer<typeof cashflowQuerySchema>;
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;
export type ListExpensesQueryInput = z.infer<typeof listExpensesQuerySchema>;
export type ListCommissionsQueryInput = z.infer<typeof listCommissionsQuerySchema>;
export type PayCommissionInput = z.infer<typeof payCommissionSchema>;
export type DreQueryInput = z.infer<typeof dreQuerySchema>;
export type MetricsQueryInput = z.infer<typeof metricsQuerySchema>;
export type ManualPaymentInput = z.infer<typeof createManualPaymentSchema>;
