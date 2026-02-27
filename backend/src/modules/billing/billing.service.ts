import crypto from "node:crypto";
import {
  BillingGateway,
  BillingPaymentStatus,
  PlanName,
  Prisma,
  SubscriptionStatus
} from "@prisma/client";
import Stripe from "stripe";
import { prisma } from "../../config/prisma";
import { env } from "../../config/env";
import { HttpError } from "../../utils/http-error";
import {
  notifyPaymentConfirmed,
  notifySubscriptionDueSoon
} from "../notifications/notifications.service";
import {
  BillingHistoryQueryInput,
  CancelInput,
  GatewayConfigInput,
  PixWebhookInput,
  SubscribeInput
} from "./billing.schemas";

const DAY_MS = 24 * 60 * 60 * 1000;

const DEFAULT_PLAN_DEFINITIONS: Array<{
  name: PlanName;
  price: number;
  maxUsers: number;
  maxBarbers: number;
  maxAppointmentsMonth: number;
  features: Record<string, boolean>;
}> = [
  {
    name: PlanName.FREE,
    price: 0,
    maxUsers: 2,
    maxBarbers: 1,
    maxAppointmentsMonth: 120,
    features: {
      dashboard_basic: true,
      financial_basic: true,
      premium_analytics: false,
      inventory: false
    }
  },
  {
    name: PlanName.PRO,
    price: 199,
    maxUsers: 10,
    maxBarbers: 5,
    maxAppointmentsMonth: 1000,
    features: {
      dashboard_basic: true,
      financial_basic: true,
      premium_analytics: true,
      inventory: true
    }
  },
  {
    name: PlanName.PREMIUM,
    price: 399,
    maxUsers: 999,
    maxBarbers: 999,
    maxAppointmentsMonth: 100000,
    features: {
      dashboard_basic: true,
      financial_basic: true,
      premium_analytics: true,
      inventory: true,
      api_access: true
    }
  }
];

type StripeCheckoutResult = {
  externalSubscriptionId: string;
  externalCustomerId: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  status: SubscriptionStatus;
  clientSecret: string | null;
};

type PixCheckoutResult = {
  externalSubscriptionId: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  status: SubscriptionStatus;
  qrCode: string;
  copyPasteCode: string;
};

const toNumber = (value: Prisma.Decimal | number): number => Number(value);

const mapStripeStatus = (status: string): SubscriptionStatus => {
  switch (status) {
    case "active":
      return SubscriptionStatus.ACTIVE;
    case "trialing":
      return SubscriptionStatus.TRIALING;
    case "past_due":
      return SubscriptionStatus.PAST_DUE;
    case "canceled":
      return SubscriptionStatus.CANCELED;
    default:
      return SubscriptionStatus.INCOMPLETE;
  }
};

const fireNotification = (operation: Promise<unknown>) => {
  operation.catch(() => null);
};

const logBillingEvent = async (
  tenantId: string,
  level: "INFO" | "WARN" | "ERROR",
  event: string,
  payload?: Prisma.InputJsonValue
) => {
  await prisma.billingLog.create({
    data: {
      tenantId,
      level,
      event,
      payload
    }
  });
};

export const ensureDefaultPlans = async () => {
  for (const plan of DEFAULT_PLAN_DEFINITIONS) {
    await prisma.plan.upsert({
      where: { name: plan.name },
      create: {
        name: plan.name,
        price: plan.price,
        maxUsers: plan.maxUsers,
        maxBarbers: plan.maxBarbers,
        maxAppointmentsMonth: plan.maxAppointmentsMonth,
        features: plan.features
      },
      update: {
        price: plan.price,
        maxUsers: plan.maxUsers,
        maxBarbers: plan.maxBarbers,
        maxAppointmentsMonth: plan.maxAppointmentsMonth,
        features: plan.features
      }
    });
  }
};

export const ensureTenantBillingBootstrap = async (tenantId: string) => {
  await ensureDefaultPlans();
  const trialPlan =
    (await prisma.plan.findUnique({
      where: { name: PlanName.PRO }
    })) ??
    (await prisma.plan.findUnique({
      where: { name: PlanName.FREE }
    }));
  if (!trialPlan) {
    throw new HttpError("Plano inicial nao encontrado.", 500);
  }

  const currentPlanForPostTrial = await prisma.plan.findUnique({
    where: { name: PlanName.FREE }
  });
  if (!currentPlanForPostTrial) {
    throw new HttpError("Plano FREE nao encontrado.", 500);
  }

  const subscription = await prisma.subscription.findUnique({
    where: { tenantId }
  });

  if (!subscription) {
    await prisma.subscription.create({
      data: {
        tenantId,
        planId: trialPlan.id,
        pendingPlanId: currentPlanForPostTrial.id,
        gateway: BillingGateway.PIX,
        status: SubscriptionStatus.TRIALING,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 7 * DAY_MS)
      }
    });
  }

  const config = await prisma.paymentGatewayConfig.findUnique({
    where: { tenantId }
  });
  if (!config) {
    await prisma.paymentGatewayConfig.create({
      data: {
        tenantId,
        stripeActive: false,
        pixActive: true,
        pixApiKey: "SANDBOX",
        pixWebhookSecret: env.DEFAULT_PIX_WEBHOOK_SECRET
      }
    });
  }
};

const getStripeClient = (secretKey: string): Stripe =>
  new Stripe(secretKey, {
    apiVersion: "2026-02-25.clover"
  });

const getGatewayConfig = async (tenantId: string) => {
  const tenantConfig = await prisma.paymentGatewayConfig.findUnique({
    where: { tenantId }
  });

  if (tenantConfig) {
    if (tenantConfig.pixActive && tenantConfig.stripeActive) {
      throw new HttpError("Configuracao invalida: Stripe e PIX ativos ao mesmo tempo.", 422);
    }
    if (tenantConfig.stripeActive || tenantConfig.pixActive) {
      return tenantConfig;
    }
  }

  const globalConfig = await prisma.paymentGatewayConfig.findFirst({
    where: { tenantId: null }
  });

  if (!globalConfig) {
    throw new HttpError("Gateway de pagamento nao configurado.", 422);
  }

  if (globalConfig.pixActive && globalConfig.stripeActive) {
    throw new HttpError("Configuracao global invalida de gateway.", 422);
  }

  return globalConfig;
};

const resolveGateway = async (tenantId: string): Promise<{
  configId: string;
  gateway: BillingGateway;
  stripeSecretKey?: string;
  stripeWebhookSecret?: string;
  pixApiKey?: string;
  pixWebhookSecret?: string;
}> => {
  const config = await getGatewayConfig(tenantId);

  if (config.stripeActive) {
    return {
      configId: config.id,
      gateway: BillingGateway.STRIPE,
      stripeSecretKey: config.stripeSecretKey ?? env.STRIPE_SECRET_KEY,
      stripeWebhookSecret: config.stripeWebhookSecret ?? env.STRIPE_WEBHOOK_SECRET
    };
  }

  if (config.pixActive) {
    return {
      configId: config.id,
      gateway: BillingGateway.PIX,
      pixApiKey: config.pixApiKey ?? env.DEFAULT_PIX_API_KEY,
      pixWebhookSecret: config.pixWebhookSecret ?? env.DEFAULT_PIX_WEBHOOK_SECRET
    };
  }

  throw new HttpError("Nenhum gateway ativo foi encontrado.", 422);
};

const createStripeSubscription = async (input: {
  tenantId: string;
  tenantName: string;
  tenantEmail?: string | null;
  plan: {
    name: PlanName;
    price: Prisma.Decimal;
  };
  stripeSecretKey: string;
}): Promise<StripeCheckoutResult> => {
  const stripe = getStripeClient(input.stripeSecretKey);
  const customer = await stripe.customers.create({
    email: input.tenantEmail ?? undefined,
    name: input.tenantName,
    metadata: {
      tenantId: input.tenantId
    }
  });

  const product = await stripe.products.create({
    name: `Plano ${input.plan.name} Barbearia SaaS`
  });

  const price = await stripe.prices.create({
    currency: "brl",
    unit_amount: Math.round(toNumber(input.plan.price) * 100),
    recurring: {
      interval: "month"
    },
    product: product.id
  });

  const subscription = await stripe.subscriptions.create({
    customer: customer.id,
    payment_behavior: "default_incomplete",
    payment_settings: {
      save_default_payment_method: "on_subscription"
    },
    items: [
      {
        price: price.id
      }
    ],
    metadata: {
      tenantId: input.tenantId,
      planName: input.plan.name
    },
    expand: ["latest_invoice"]
  });

  const latestInvoice = subscription.latest_invoice;
  const periodStart = new Date(subscription.start_date * 1000);
  const periodEnd =
    latestInvoice && typeof latestInvoice !== "string" && latestInvoice.period_end
      ? new Date(latestInvoice.period_end * 1000)
      : new Date(periodStart.getTime() + 30 * DAY_MS);

  return {
    externalSubscriptionId: subscription.id,
    externalCustomerId: customer.id,
    currentPeriodStart: periodStart,
    currentPeriodEnd: periodEnd,
    status: mapStripeStatus(subscription.status),
    clientSecret:
      latestInvoice &&
      typeof latestInvoice !== "string" &&
      latestInvoice.confirmation_secret?.client_secret
        ? latestInvoice.confirmation_secret.client_secret
        : null
  };
};

const createPixSubscription = async (input: {
  tenantId: string;
  plan: {
    name: PlanName;
    price: Prisma.Decimal;
  };
  pixApiKey: string;
}): Promise<PixCheckoutResult> => {
  const now = new Date();
  const externalSubscriptionId = `pix_sub_${input.tenantId.slice(0, 8)}_${Date.now()}`;
  const copyPasteCode = [
    "00020126PIX",
    input.pixApiKey.slice(0, 8),
    externalSubscriptionId,
    `54${Math.round(toNumber(input.plan.price) * 100)}`,
    "5802BR",
    "5909BARBEARIA",
    "6008SAASPREM"
  ].join("");

  return {
    externalSubscriptionId,
    currentPeriodStart: now,
    currentPeriodEnd: new Date(now.getTime() + 30 * DAY_MS),
    status: SubscriptionStatus.INCOMPLETE,
    qrCode: `PIX|${externalSubscriptionId}|${copyPasteCode}`,
    copyPasteCode
  };
};

const maybeScheduleDowngrade = async (input: {
  subscriptionId: string;
  currentPlanPrice: Prisma.Decimal;
  targetPlanPrice: Prisma.Decimal;
  targetPlanId: string;
  tenantId: string;
}) => {
  if (toNumber(input.targetPlanPrice) >= toNumber(input.currentPlanPrice)) {
    return false;
  }

  await prisma.subscription.update({
    where: { id: input.subscriptionId },
    data: {
      pendingPlanId: input.targetPlanId,
      cancelAtPeriodEnd: true
    }
  });

  await logBillingEvent(input.tenantId, "INFO", "DOWNGRADE_SCHEDULED", {
    targetPlanId: input.targetPlanId
  });

  return true;
};

const recordBillingHistory = async (input: {
  tenantId: string;
  subscriptionId: string;
  amount: number;
  status: BillingPaymentStatus;
  gateway: BillingGateway;
  paidAt?: Date | null;
  externalRef?: string | null;
  metadata?: Prisma.InputJsonValue;
}) => {
  await prisma.billingHistory.create({
    data: {
      tenantId: input.tenantId,
      subscriptionId: input.subscriptionId,
      amount: input.amount,
      status: input.status,
      gateway: input.gateway,
      paidAt: input.paidAt ?? null,
      externalRef: input.externalRef ?? null,
      metadata: input.metadata
    }
  });
};

const applyPendingPlanIfExists = async (subscriptionId: string) => {
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: {
      plan: true,
      pendingPlan: true
    }
  });
  if (!subscription?.pendingPlanId) {
    return;
  }

  await prisma.subscription.update({
    where: { id: subscriptionId },
    data: {
      planId: subscription.pendingPlanId,
      pendingPlanId: null,
      cancelAtPeriodEnd: false
    }
  });

  await logBillingEvent(subscription.tenantId, "INFO", "DOWNGRADE_APPLIED", {
    from: subscription.plan.name,
    to: subscription.pendingPlan?.name ?? null
  });
};

export const listPlans = async () => {
  await ensureDefaultPlans();
  return prisma.plan.findMany({
    orderBy: {
      price: "asc"
    }
  });
};

export const subscribeTenant = async (tenantId: string, input: SubscribeInput) => {
  await ensureDefaultPlans();

  const [tenant, targetPlan, subscription] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, email: true }
    }),
    prisma.plan.findUnique({
      where: { name: input.planName }
    }),
    prisma.subscription.findUnique({
      where: { tenantId },
      include: {
        plan: true
      }
    })
  ]);

  if (!tenant) {
    throw new HttpError("Tenant nao encontrado.", 404);
  }
  if (!targetPlan) {
    throw new HttpError("Plano nao encontrado.", 404);
  }
  if (!subscription) {
    throw new HttpError("Assinatura nao encontrada para o tenant.", 404);
  }

  if (subscription.planId === targetPlan.id) {
    return {
      status: "NO_CHANGES",
      subscription
    };
  }

  const downgradeScheduled = await maybeScheduleDowngrade({
    subscriptionId: subscription.id,
    currentPlanPrice: subscription.plan.price,
    targetPlanPrice: targetPlan.price,
    targetPlanId: targetPlan.id,
    tenantId
  });

  if (downgradeScheduled) {
    return {
      status: "DOWNGRADE_SCHEDULED",
      message: "Downgrade agendado para o fim do periodo vigente."
    };
  }

  const gatewayInfo = await resolveGateway(tenantId);

  if (targetPlan.name === PlanName.FREE) {
    const updated = await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        planId: targetPlan.id,
        pendingPlanId: null,
        gateway: gatewayInfo.gateway,
        externalSubscriptionId: null,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * DAY_MS),
        cancelAtPeriodEnd: false
      },
      include: {
        plan: true
      }
    });

    await recordBillingHistory({
      tenantId,
      subscriptionId: subscription.id,
      amount: 0,
      status: BillingPaymentStatus.PAID,
      gateway: gatewayInfo.gateway,
      paidAt: new Date(),
      metadata: { note: "Mudanca para plano FREE" }
    });

    return {
      status: "ACTIVE",
      gateway: gatewayInfo.gateway,
      subscription: updated
    };
  }

  if (gatewayInfo.gateway === BillingGateway.STRIPE) {
    if (!gatewayInfo.stripeSecretKey) {
      throw new HttpError("Stripe nao configurado para este tenant.", 422);
    }

    const stripeResult = await createStripeSubscription({
      tenantId,
      tenantName: tenant.name,
      tenantEmail: tenant.email,
      plan: {
        name: targetPlan.name,
        price: targetPlan.price
      },
      stripeSecretKey: gatewayInfo.stripeSecretKey
    });

    const updated = await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        planId: targetPlan.id,
        pendingPlanId: null,
        gateway: BillingGateway.STRIPE,
        externalSubscriptionId: stripeResult.externalSubscriptionId,
        status: stripeResult.status,
        currentPeriodStart: stripeResult.currentPeriodStart,
        currentPeriodEnd: stripeResult.currentPeriodEnd,
        cancelAtPeriodEnd: false
      },
      include: {
        plan: true,
        pendingPlan: true
      }
    });

    await recordBillingHistory({
      tenantId,
      subscriptionId: subscription.id,
      amount: toNumber(targetPlan.price),
      status:
        stripeResult.status === SubscriptionStatus.ACTIVE
          ? BillingPaymentStatus.PAID
          : BillingPaymentStatus.PENDING,
      gateway: BillingGateway.STRIPE,
      paidAt: stripeResult.status === SubscriptionStatus.ACTIVE ? new Date() : null,
      externalRef: stripeResult.externalSubscriptionId,
      metadata: {
        stripeCustomerId: stripeResult.externalCustomerId
      }
    });

    await logBillingEvent(tenantId, "INFO", "SUBSCRIPTION_UPDATED", {
      gateway: BillingGateway.STRIPE,
      planName: targetPlan.name,
      externalSubscriptionId: stripeResult.externalSubscriptionId
    });

    return {
      status: updated.status,
      gateway: BillingGateway.STRIPE,
      clientSecret: stripeResult.clientSecret,
      subscription: updated
    };
  }

  if (!gatewayInfo.pixApiKey) {
    throw new HttpError("PIX nao configurado para este tenant.", 422);
  }

  const pixResult = await createPixSubscription({
    tenantId,
    plan: {
      name: targetPlan.name,
      price: targetPlan.price
    },
    pixApiKey: gatewayInfo.pixApiKey
  });

  const updated = await prisma.subscription.update({
    where: { id: subscription.id },
    data: {
      planId: targetPlan.id,
      pendingPlanId: null,
      gateway: BillingGateway.PIX,
      externalSubscriptionId: pixResult.externalSubscriptionId,
      status: pixResult.status,
      currentPeriodStart: pixResult.currentPeriodStart,
      currentPeriodEnd: pixResult.currentPeriodEnd,
      cancelAtPeriodEnd: false
    },
    include: {
      plan: true,
      pendingPlan: true
    }
  });

  await recordBillingHistory({
    tenantId,
    subscriptionId: subscription.id,
    amount: toNumber(targetPlan.price),
    status: BillingPaymentStatus.PENDING,
    gateway: BillingGateway.PIX,
    externalRef: pixResult.externalSubscriptionId
  });

  await logBillingEvent(tenantId, "INFO", "SUBSCRIPTION_UPDATED", {
    gateway: BillingGateway.PIX,
    planName: targetPlan.name,
    externalSubscriptionId: pixResult.externalSubscriptionId
  });

  return {
    status: updated.status,
    gateway: BillingGateway.PIX,
    pix: {
      qrCode: pixResult.qrCode,
      copyPasteCode: pixResult.copyPasteCode
    },
    subscription: updated
  };
};

export const cancelSubscription = async (tenantId: string, input: CancelInput) => {
  const subscription = await prisma.subscription.findUnique({
    where: { tenantId },
    include: {
      plan: true
    }
  });

  if (!subscription) {
    throw new HttpError("Assinatura nao encontrada.", 404);
  }

  if (!input.immediate) {
    const updated = await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        cancelAtPeriodEnd: true
      },
      include: { plan: true, pendingPlan: true }
    });
    await logBillingEvent(tenantId, "INFO", "CANCEL_AT_PERIOD_END", {
      subscriptionId: subscription.id
    });
    return updated;
  }

  if (subscription.gateway === BillingGateway.STRIPE && subscription.externalSubscriptionId) {
    const gatewayInfo = await resolveGateway(tenantId);
    if (gatewayInfo.stripeSecretKey) {
      const stripe = getStripeClient(gatewayInfo.stripeSecretKey);
      await stripe.subscriptions.cancel(subscription.externalSubscriptionId);
    }
  }

  const updated = await prisma.subscription.update({
    where: { id: subscription.id },
    data: {
      status: SubscriptionStatus.CANCELED,
      cancelAtPeriodEnd: true,
      currentPeriodEnd: new Date(),
      pendingPlanId: null
    },
    include: { plan: true, pendingPlan: true }
  });

  await recordBillingHistory({
    tenantId,
    subscriptionId: subscription.id,
    amount: toNumber(subscription.plan.price),
    status: BillingPaymentStatus.CANCELED,
    gateway: subscription.gateway
  });

  await logBillingEvent(tenantId, "WARN", "SUBSCRIPTION_CANCELED_IMMEDIATE", {
    subscriptionId: subscription.id
  });

  return updated;
};

export const getBillingStatus = async (tenantId: string) => {
  const subscription = await prisma.subscription.findUnique({
    where: { tenantId },
    include: {
      plan: true,
      pendingPlan: true
    }
  });
  if (!subscription) {
    throw new HttpError("Assinatura nao encontrada.", 404);
  }

  const now = Date.now();
  const periodEnd = subscription.currentPeriodEnd.getTime();
  const diffDays = Math.ceil((periodEnd - now) / DAY_MS);
  const warning3Days = diffDays <= 3 && diffDays >= 0;
  const allowedStatuses: SubscriptionStatus[] = [
    SubscriptionStatus.ACTIVE,
    SubscriptionStatus.TRIALING
  ];
  const blocked = !allowedStatuses.includes(subscription.status);

  if (warning3Days) {
    fireNotification(notifySubscriptionDueSoon(tenantId, diffDays));
  }

  return {
    subscription,
    blocked,
    warning3Days,
    daysToRenewal: diffDays
  };
};

export const getBillingHistory = async (tenantId: string, query: BillingHistoryQueryInput) => {
  const where = { tenantId };
  const [items, total] = await Promise.all([
    prisma.billingHistory.findMany({
      where,
      orderBy: {
        createdAt: "desc"
      },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize
    }),
    prisma.billingHistory.count({ where })
  ]);

  return {
    items,
    meta: {
      page: query.page,
      pageSize: query.pageSize,
      total
    }
  };
};

export const upsertGatewayConfig = async (tenantId: string, input: GatewayConfigInput) => {
  if (input.stripeActive && input.pixActive) {
    throw new HttpError("Apenas um gateway pode estar ativo por vez.", 422);
  }

  const targetTenantId = input.target === "GLOBAL" ? null : tenantId;
  const existing = targetTenantId
    ? await prisma.paymentGatewayConfig.findUnique({ where: { tenantId: targetTenantId } })
    : await prisma.paymentGatewayConfig.findFirst({ where: { tenantId: null } });

  if (existing) {
    return prisma.paymentGatewayConfig.update({
      where: { id: existing.id },
      data: {
        stripeActive: input.stripeActive,
        pixActive: input.pixActive,
        stripeSecretKey: input.stripeSecretKey,
        stripeWebhookSecret: input.stripeWebhookSecret,
        pixApiKey: input.pixApiKey,
        pixWebhookSecret: input.pixWebhookSecret
      }
    });
  }

  return prisma.paymentGatewayConfig.create({
    data: {
      tenantId: targetTenantId,
      stripeActive: input.stripeActive,
      pixActive: input.pixActive,
      stripeSecretKey: input.stripeSecretKey,
      stripeWebhookSecret: input.stripeWebhookSecret,
      pixApiKey: input.pixApiKey,
      pixWebhookSecret: input.pixWebhookSecret
    }
  });
};

export const handleStripeWebhook = async (rawBody: Buffer, signature: string) => {
  const configs = await prisma.paymentGatewayConfig.findMany({
    where: {
      stripeActive: true,
      OR: [
        { stripeWebhookSecret: { not: null } },
        { tenantId: null }
      ]
    }
  });

  const candidateSecrets = Array.from(
    new Set(
      configs
        .map((config) => config.stripeWebhookSecret ?? env.STRIPE_WEBHOOK_SECRET)
        .filter((value): value is string => Boolean(value))
    )
  );

  let event: Stripe.Event | null = null;
  for (const secret of candidateSecrets) {
    try {
      const stripe = getStripeClient(
        env.STRIPE_SECRET_KEY || configs[0]?.stripeSecretKey || "sk_test_placeholder"
      );
      event = stripe.webhooks.constructEvent(rawBody, signature, secret);
      break;
    } catch {
      continue;
    }
  }

  if (!event) {
    throw new HttpError("Assinatura do webhook Stripe invalida.", 400);
  }

  const getExternalSubscriptionIdFromInvoice = (invoice: Stripe.Invoice): string | null => {
    const subscriptionField = invoice.parent?.subscription_details?.subscription;
    if (!subscriptionField) {
      return null;
    }
    return typeof subscriptionField === "string" ? subscriptionField : subscriptionField.id;
  };

  if (event.type === "invoice.paid") {
    const invoice = event.data.object as Stripe.Invoice;
    const externalSubscriptionId = getExternalSubscriptionIdFromInvoice(invoice);
    if (!externalSubscriptionId) {
      return { received: true, ignored: true };
    }

    const subscription = await prisma.subscription.findFirst({
      where: { externalSubscriptionId }
    });
    if (!subscription) {
      return { received: true, ignored: true };
    }

    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart:
          invoice.period_start ? new Date(invoice.period_start * 1000) : subscription.currentPeriodStart,
        currentPeriodEnd:
          invoice.period_end ? new Date(invoice.period_end * 1000) : subscription.currentPeriodEnd
      }
    });

    await applyPendingPlanIfExists(subscription.id);

    await recordBillingHistory({
      tenantId: subscription.tenantId,
      subscriptionId: subscription.id,
      amount: Number(invoice.amount_paid ?? 0) / 100,
      status: BillingPaymentStatus.PAID,
      gateway: BillingGateway.STRIPE,
      paidAt: new Date(),
      externalRef: invoice.id
    });
    fireNotification(
      notifyPaymentConfirmed(subscription.tenantId, Number(invoice.amount_paid ?? 0) / 100)
    );
  }

  if (event.type === "invoice.payment_failed") {
    const invoice = event.data.object as Stripe.Invoice;
    const externalSubscriptionId = getExternalSubscriptionIdFromInvoice(invoice);
    if (!externalSubscriptionId) {
      return { received: true, ignored: true };
    }

    const subscription = await prisma.subscription.findFirst({
      where: { externalSubscriptionId }
    });
    if (!subscription) {
      return { received: true, ignored: true };
    }

    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: SubscriptionStatus.PAST_DUE
      }
    });

    await recordBillingHistory({
      tenantId: subscription.tenantId,
      subscriptionId: subscription.id,
      amount: Number(invoice.amount_due ?? 0) / 100,
      status: BillingPaymentStatus.FAILED,
      gateway: BillingGateway.STRIPE,
      externalRef: invoice.id
    });
  }

  if (event.type === "customer.subscription.deleted") {
    const payload = event.data.object as Stripe.Subscription;
    const subscription = await prisma.subscription.findFirst({
      where: { externalSubscriptionId: payload.id }
    });
    if (!subscription) {
      return { received: true, ignored: true };
    }

    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: SubscriptionStatus.CANCELED,
        currentPeriodEnd: new Date(),
        cancelAtPeriodEnd: true
      }
    });
  }

  return { received: true };
};

const verifyPixSignature = (rawBody: Buffer, signature: string, secret: string) => {
  const digest = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const normalizedDigest = Buffer.from(digest, "utf-8");
  const normalizedSignature = Buffer.from(signature, "utf-8");
  if (normalizedDigest.length !== normalizedSignature.length) {
    return false;
  }
  return crypto.timingSafeEqual(normalizedDigest, normalizedSignature);
};

export const handlePixWebhook = async (rawBody: Buffer, signature: string, payload: PixWebhookInput) => {
  const subscription = await prisma.subscription.findFirst({
    where: {
      externalSubscriptionId: payload.externalSubscriptionId
    },
    include: {
      plan: true
    }
  });
  if (!subscription) {
    throw new HttpError("Assinatura PIX nao encontrada.", 404);
  }

  const config = await getGatewayConfig(subscription.tenantId);
  const secret = config.pixWebhookSecret ?? env.DEFAULT_PIX_WEBHOOK_SECRET;
  if (!secret) {
    throw new HttpError("Webhook PIX nao configurado.", 422);
  }

  if (!verifyPixSignature(rawBody, signature, secret)) {
    throw new HttpError("Assinatura do webhook PIX invalida.", 400);
  }

  if (payload.event === "pagamento_confirmado") {
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * DAY_MS)
      }
    });
    await applyPendingPlanIfExists(subscription.id);

    await recordBillingHistory({
      tenantId: subscription.tenantId,
      subscriptionId: subscription.id,
      amount: payload.amount ?? toNumber(subscription.plan.price),
      status: BillingPaymentStatus.PAID,
      gateway: BillingGateway.PIX,
      paidAt: payload.paidAt ? new Date(payload.paidAt) : new Date(),
      externalRef: payload.externalSubscriptionId
    });
    fireNotification(
      notifyPaymentConfirmed(
        subscription.tenantId,
        payload.amount ?? toNumber(subscription.plan.price)
      )
    );
  }

  if (payload.event === "pagamento_vencido") {
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: SubscriptionStatus.PAST_DUE
      }
    });

    await recordBillingHistory({
      tenantId: subscription.tenantId,
      subscriptionId: subscription.id,
      amount: payload.amount ?? toNumber(subscription.plan.price),
      status: BillingPaymentStatus.FAILED,
      gateway: BillingGateway.PIX,
      externalRef: payload.externalSubscriptionId
    });
  }

  return { received: true };
};
