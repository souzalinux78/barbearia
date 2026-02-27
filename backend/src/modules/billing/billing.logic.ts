import { SubscriptionStatus } from "@prisma/client";

const DAY_MS = 24 * 60 * 60 * 1000;

export const buildTrialWindow = (startAt = new Date()) => ({
  currentPeriodStart: startAt,
  currentPeriodEnd: new Date(startAt.getTime() + 7 * DAY_MS),
  status: SubscriptionStatus.TRIALING
});

export const nextStatusFromPaymentFailure = (): SubscriptionStatus =>
  SubscriptionStatus.PAST_DUE;

export const nextStatusFromCancellation = (): SubscriptionStatus =>
  SubscriptionStatus.CANCELED;

export const canAccessSystemBySubscriptionStatus = (
  status: SubscriptionStatus
): boolean =>
  status === SubscriptionStatus.ACTIVE || status === SubscriptionStatus.TRIALING;

export const hasReachedPlanLimit = (currentCount: number, limit: number): boolean =>
  currentCount >= limit;
