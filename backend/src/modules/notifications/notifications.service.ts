import { AppointmentStatus, Prisma, RoleName } from "@prisma/client";
import webPush from "web-push";
import { env } from "../../config/env";
import { prisma } from "../../config/prisma";
import { HttpError } from "../../utils/http-error";
import {
  SendInput,
  SendToTenantInput,
  SendToUserInput,
  SubscribeInput
} from "./notifications.schemas";

type PushPayload = {
  title: string;
  body: string;
  route: string;
  icon?: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const REMINDER_SWEEP_INTERVAL_MS = 5 * 60 * 1000;

const allowedOrigins = env.CORS_ORIGIN.split(",").map((value) => value.trim());
const pushEnabled = Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);
const dueSoonMemory = new Map<string, string>();

let reminderTimer: NodeJS.Timeout | null = null;

if (pushEnabled) {
  webPush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
}

const ensureOriginAllowed = (origin?: string) => {
  if (!origin) {
    return;
  }
  if (!allowedOrigins.includes(origin)) {
    throw new HttpError("Origem invalida para cadastro de push subscription.", 403);
  }
};

const pruneInvalidSubscription = async (endpoint: string) => {
  await prisma.pushSubscription.deleteMany({
    where: { endpoint }
  });
};

const sendToSubscriptionRows = async (
  rows: Array<{ endpoint: string; p256dh: string; auth: string }>,
  payload: PushPayload
) => {
  if (!pushEnabled || rows.length === 0) {
    return {
      sent: 0,
      failed: 0,
      skipped: !pushEnabled
    };
  }

  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    icon: payload.icon ?? "/pwa-192.svg",
    badge: "/pwa-192.svg",
    route: payload.route
  });

  let sent = 0;
  let failed = 0;

  await Promise.all(
    rows.map(async (row) => {
      try {
        await webPush.sendNotification(
          {
            endpoint: row.endpoint,
            keys: {
              p256dh: row.p256dh,
              auth: row.auth
            }
          },
          body
        );
        sent += 1;
      } catch (error: unknown) {
        failed += 1;
        const statusCode =
          typeof error === "object" && error && "statusCode" in error
            ? Number((error as { statusCode?: number }).statusCode)
            : undefined;
        if (statusCode === 404 || statusCode === 410) {
          await pruneInvalidSubscription(row.endpoint);
        }
      }
    })
  );

  return {
    sent,
    failed,
    skipped: false
  };
};

const resolveStartDateTime = (date: Date, startTime: Date): Date => {
  const datePart = date.toISOString().slice(0, 10);
  const timePart = startTime.toISOString().slice(11, 16);
  return new Date(`${datePart}T${timePart}:00`);
};

export const subscribePush = async (
  tenantId: string,
  userId: string,
  input: SubscribeInput,
  origin?: string
) => {
  ensureOriginAllowed(origin);

  const row = await prisma.pushSubscription.upsert({
    where: {
      endpoint: input.subscription.endpoint
    },
    create: {
      tenantId,
      userId,
      endpoint: input.subscription.endpoint,
      p256dh: input.subscription.keys.p256dh,
      auth: input.subscription.keys.auth
    },
    update: {
      tenantId,
      userId,
      p256dh: input.subscription.keys.p256dh,
      auth: input.subscription.keys.auth
    }
  });

  return {
    id: row.id,
    pushEnabled
  };
};

export const unsubscribePush = async (tenantId: string, userId: string, endpoint: string) => {
  await prisma.pushSubscription.deleteMany({
    where: {
      tenantId,
      userId,
      endpoint
    }
  });

  return { removed: true };
};

export const sendToMyDevices = async (tenantId: string, userId: string, payload: SendInput) => {
  const rows = await prisma.pushSubscription.findMany({
    where: {
      tenantId,
      userId
    },
    select: {
      endpoint: true,
      p256dh: true,
      auth: true
    }
  });

  return sendToSubscriptionRows(rows, payload);
};

export const sendToTenant = async (tenantId: string, payload: SendToTenantInput) => {
  const rows = await prisma.pushSubscription.findMany({
    where: {
      tenantId: payload.tenantId ?? tenantId
    },
    select: {
      endpoint: true,
      p256dh: true,
      auth: true
    }
  });

  return sendToSubscriptionRows(rows, payload);
};

export const sendToUser = async (tenantId: string, payload: SendToUserInput) => {
  const rows = await prisma.pushSubscription.findMany({
    where: {
      tenantId,
      userId: payload.userId
    },
    select: {
      endpoint: true,
      p256dh: true,
      auth: true
    }
  });

  return sendToSubscriptionRows(rows, payload);
};

export const notifyNewAppointment = async (input: {
  tenantId: string;
  clientName?: string | null;
  timeLabel: string;
}) => {
  await sendToTenant(input.tenantId, {
    title: "Novo agendamento",
    body: `${input.clientName ?? "Cliente"} agendou para ${input.timeLabel}`,
    route: "/appointments"
  });
};

export const notifyAppointmentCanceled = async (input: {
  tenantId: string;
  clientName?: string | null;
  timeLabel?: string;
}) => {
  await sendToTenant(input.tenantId, {
    title: "Agendamento cancelado",
    body: `${input.clientName ?? "Cliente"} cancelou${input.timeLabel ? ` (${input.timeLabel})` : ""}.`,
    route: "/appointments"
  });
};

export const notifyPaymentConfirmed = async (tenantId: string, amount: number) => {
  await sendToTenant(tenantId, {
    title: "Pagamento confirmado",
    body: `Recebimento confirmado de R$ ${amount.toFixed(2)}.`,
    route: "/finance"
  });
};

export const notifyCommissionPaid = async (tenantId: string, barberId: string, amount: number) => {
  await sendToUser(tenantId, {
    userId: barberId,
    title: "Comissao paga",
    body: `Sua comissao de R$ ${amount.toFixed(2)} foi registrada.`,
    route: "/finance/commissions"
  });
};

export const notifySubscriptionDueSoon = async (tenantId: string, daysToRenewal: number) => {
  const key = `${tenantId}:${new Date().toISOString().slice(0, 10)}`;
  if (dueSoonMemory.get(tenantId) === key) {
    return;
  }
  dueSoonMemory.set(tenantId, key);

  await sendToTenant(tenantId, {
    title: "Assinatura vencendo",
    body: `Sua assinatura vence em ${daysToRenewal} dia(s).`,
    route: "/billing/subscription"
  });
};

export const runOneHourReminderSweep = async () => {
  const now = Date.now();
  const yesterday = new Date(now - DAY_MS);
  const tomorrow = new Date(now + DAY_MS);

  const appointments = await prisma.appointment.findMany({
    where: {
      reminderSent: false,
      status: {
        in: [AppointmentStatus.AGENDADO, AppointmentStatus.CONFIRMADO]
      },
      date: {
        gte: new Date(yesterday.toISOString().slice(0, 10)),
        lte: new Date(tomorrow.toISOString().slice(0, 10))
      }
    },
    include: {
      client: {
        select: {
          name: true
        }
      }
    }
  });

  for (const appointment of appointments) {
    const startAt = resolveStartDateTime(appointment.date, appointment.startTime).getTime();
    const diffMinutes = Math.round((startAt - now) / 60000);
    if (diffMinutes <= 60 && diffMinutes >= 0) {
      await prisma.appointment.update({
        where: { id: appointment.id },
        data: {
          reminderSent: true
        }
      });

      await sendToUser(appointment.tenantId, {
        userId: appointment.barberId,
        title: "Lembrete de atendimento",
        body: `${appointment.client?.name ?? "Cliente"} em ${diffMinutes} min.`,
        route: "/appointments"
      });
    }
  }
};

export const startNotificationSchedulers = () => {
  if (reminderTimer) {
    return;
  }
  reminderTimer = setInterval(() => {
    runOneHourReminderSweep().catch(() => null);
  }, REMINDER_SWEEP_INTERVAL_MS);
};

export const stopNotificationSchedulers = () => {
  if (reminderTimer) {
    clearInterval(reminderTimer);
    reminderTimer = null;
  }
};

export const canSendManagementNotification = (role: RoleName): boolean =>
  role === RoleName.OWNER || role === RoleName.ADMIN;

export const getVapidPublicKey = () => env.VAPID_PUBLIC_KEY;
