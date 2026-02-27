import { PlanName, Prisma, RoleName, SubscriptionStatus } from "@prisma/client";
import { NextFunction, Request, Response } from "express";
import { prisma } from "../config/prisma";
import { hasReachedPlanLimit } from "../modules/billing/billing.logic";
import { HttpError } from "../utils/http-error";

type PlanLimitOptions = {
  enforceUsers?: boolean;
  enforceBarbersByBodyRole?: boolean;
  enforceAppointmentsMonth?: boolean;
  requiredFeature?: string;
};

const readFeatureFlag = (features: Prisma.JsonValue, feature: string): boolean => {
  if (!features || typeof features !== "object" || Array.isArray(features)) {
    return false;
  }
  const value = (features as Record<string, unknown>)[feature];
  return value === true;
};

const assertSubscriptionAvailable = async (tenantId: string) => {
  const subscription = await prisma.subscription.findUnique({
    where: {
      tenantId
    },
    include: {
      plan: true
    }
  });

  if (!subscription) {
    throw new HttpError("Assinatura nao encontrada para o tenant.", 402);
  }

  if (
    subscription.status !== SubscriptionStatus.ACTIVE &&
    subscription.status !== SubscriptionStatus.TRIALING
  ) {
    throw new HttpError("Assinatura inativa para operacoes de plano.", 402);
  }

  return subscription;
};

export const checkPlanLimits =
  (options: PlanLimitOptions) =>
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    if (!req.auth?.tenantId) {
      next(new HttpError("Tenant nao identificado.", 401));
      return;
    }

    try {
      const subscription = await assertSubscriptionAvailable(req.auth.tenantId);
      const plan = subscription.plan;

      if (options.requiredFeature) {
        const allowedByFeature = readFeatureFlag(plan.features, options.requiredFeature);
        const allowedByPlan =
          plan.name === PlanName.PRO || plan.name === PlanName.PREMIUM;
        if (!allowedByFeature && !allowedByPlan) {
          throw new HttpError(
            `Recurso premium indisponivel no plano ${plan.name}.`,
            403
          );
        }
      }

      const promises: Array<Promise<number>> = [];
      if (options.enforceUsers) {
        promises.push(
          prisma.user.count({
            where: {
              tenantId: req.auth.tenantId,
              active: true
            }
          })
        );
      }
      if (options.enforceBarbersByBodyRole && req.body?.role === RoleName.BARBER) {
        promises.push(
          prisma.user.count({
            where: {
              tenantId: req.auth.tenantId,
              active: true,
              role: {
                name: RoleName.BARBER
              }
            }
          })
        );
      }
      if (options.enforceAppointmentsMonth) {
        const now = new Date();
        const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        promises.push(
          prisma.appointment.count({
            where: {
              tenantId: req.auth.tenantId,
              date: {
                gte: startMonth,
                lte: endMonth
              },
              status: {
                not: "CANCELADO"
              }
            }
          })
        );
      }

      const counters = await Promise.all(promises);
      let cursor = 0;

      if (options.enforceUsers) {
        const usersCount = counters[cursor];
        cursor += 1;
        if (hasReachedPlanLimit(usersCount, plan.maxUsers)) {
          throw new HttpError(
            `Limite de usuarios do plano ${plan.name} atingido (${plan.maxUsers}).`,
            402
          );
        }
      }

      if (options.enforceBarbersByBodyRole && req.body?.role === RoleName.BARBER) {
        const barbersCount = counters[cursor];
        cursor += 1;
        if (hasReachedPlanLimit(barbersCount, plan.maxBarbers)) {
          throw new HttpError(
            `Limite de barbeiros do plano ${plan.name} atingido (${plan.maxBarbers}).`,
            402
          );
        }
      }

      if (options.enforceAppointmentsMonth) {
        const appointmentsCount = counters[cursor];
        if (hasReachedPlanLimit(appointmentsCount, plan.maxAppointmentsMonth)) {
          throw new HttpError(
            `Limite mensal de agendamentos do plano ${plan.name} atingido (${plan.maxAppointmentsMonth}).`,
            402
          );
        }
      }

      next();
    } catch (error) {
      next(error);
    }
  };
