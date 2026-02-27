import assert from "node:assert/strict";
import test from "node:test";
import { SubscriptionStatus } from "@prisma/client";
import {
  buildTrialWindow,
  canAccessSystemBySubscriptionStatus,
  hasReachedPlanLimit,
  nextStatusFromCancellation,
  nextStatusFromPaymentFailure
} from "../billing.logic";

test("criacao de assinatura deve iniciar trial de 7 dias", () => {
  const start = new Date("2026-02-27T10:00:00.000Z");
  const trial = buildTrialWindow(start);

  assert.equal(trial.status, SubscriptionStatus.TRIALING);
  assert.equal(trial.currentPeriodStart.toISOString(), "2026-02-27T10:00:00.000Z");
  assert.equal(trial.currentPeriodEnd.toISOString(), "2026-03-06T10:00:00.000Z");
});

test("falha de pagamento deve ir para PAST_DUE", () => {
  assert.equal(nextStatusFromPaymentFailure(), SubscriptionStatus.PAST_DUE);
});

test("cancelamento deve ir para CANCELED", () => {
  assert.equal(nextStatusFromCancellation(), SubscriptionStatus.CANCELED);
});

test("bloqueio automatico deve bloquear status nao ativos", () => {
  assert.equal(canAccessSystemBySubscriptionStatus(SubscriptionStatus.ACTIVE), true);
  assert.equal(canAccessSystemBySubscriptionStatus(SubscriptionStatus.TRIALING), true);
  assert.equal(canAccessSystemBySubscriptionStatus(SubscriptionStatus.PAST_DUE), false);
  assert.equal(canAccessSystemBySubscriptionStatus(SubscriptionStatus.CANCELED), false);
  assert.equal(canAccessSystemBySubscriptionStatus(SubscriptionStatus.INCOMPLETE), false);
});

test("validacao de limite de plano deve bloquear ao atingir limite", () => {
  assert.equal(hasReachedPlanLimit(5, 10), false);
  assert.equal(hasReachedPlanLimit(10, 10), true);
  assert.equal(hasReachedPlanLimit(12, 10), true);
});
