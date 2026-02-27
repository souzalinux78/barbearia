import { SubscriptionStatus } from "@prisma/client";
import { NextFunction, Request, Response } from "express";
import { prisma } from "../config/prisma";
import { canAccessSystemBySubscriptionStatus } from "../modules/billing/billing.logic";
import { HttpError } from "../utils/http-error";

type SubscriptionCacheEntry = {
  status: SubscriptionStatus;
  currentPeriodEnd: Date;
  expiresAt: number;
};

const subscriptionCache = new Map<string, SubscriptionCacheEntry>();

const CACHE_TTL_MS = 20_000;

const getCachedStatus = (tenantId: string): SubscriptionCacheEntry | null => {
  const entry = subscriptionCache.get(tenantId);
  if (!entry) {
    return null;
  }
  if (entry.expiresAt <= Date.now()) {
    subscriptionCache.delete(tenantId);
    return null;
  }
  return entry;
};

const setCachedStatus = (tenantId: string, status: SubscriptionStatus, currentPeriodEnd: Date) => {
  subscriptionCache.set(tenantId, {
    status,
    currentPeriodEnd,
    expiresAt: Date.now() + CACHE_TTL_MS
  });
};

const isAllowedStatus = (status: SubscriptionStatus) =>
  canAccessSystemBySubscriptionStatus(status);

export const checkSubscriptionStatus = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  if (!req.auth?.tenantId) {
    next(new HttpError("Tenant nao identificado.", 401));
    return;
  }

  if (req.path.startsWith("/billing") || req.path === "/auth/logout") {
    next();
    return;
  }

  const tenantId = req.auth.tenantId;
  const cached = getCachedStatus(tenantId);
  if (cached && isAllowedStatus(cached.status)) {
    next();
    return;
  }

  const subscription = await prisma.subscription.findUnique({
    where: {
      tenantId
    },
    select: {
      id: true,
      status: true,
      currentPeriodEnd: true
    }
  });

  if (!subscription) {
    next(new HttpError("Assinatura nao encontrada para o tenant.", 402));
    return;
  }

  let status = subscription.status;
  if (
    status === SubscriptionStatus.TRIALING &&
    subscription.currentPeriodEnd.getTime() < Date.now()
  ) {
    const updated = await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: SubscriptionStatus.PAST_DUE
      },
      select: {
        status: true,
        currentPeriodEnd: true
      }
    });
    status = updated.status;
    setCachedStatus(tenantId, updated.status, updated.currentPeriodEnd);
  } else {
    setCachedStatus(tenantId, subscription.status, subscription.currentPeriodEnd);
  }

  if (!isAllowedStatus(status)) {
    next(
      new HttpError(
        JSON.stringify({
          message: "Assinatura inativa. Regularize o pagamento para continuar.",
          code: "SUBSCRIPTION_REQUIRED",
          status
        }),
        402
      )
    );
    return;
  }

  next();
};

export const clearSubscriptionCache = (tenantId: string) => {
  subscriptionCache.delete(tenantId);
};
