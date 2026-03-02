import {
  AppointmentStatus,
  PaymentMethod,
  PaymentStatus,
  SubscriptionStatus
} from "@prisma/client";
import { prisma } from "../../config/prisma";
import { HttpError } from "../../utils/http-error";
import { createAppointment, getAvailableSlots, listBarberOptions } from "../appointments/appointments.service";
import { parseTimeToMinutes } from "../appointments/appointments.rules";
import { queueOutgoingWhatsAppMessage } from "../whatsapp/whatsapp.service";
import {
  buildPixCopyPasteCode,
  isValidPixKey,
  normalizePixKey,
  sanitizeMerchantText
} from "../../utils/pix";
import {
  PublicBookingCreateInput,
  PublicBookingSlotsQueryInput
} from "./public-booking.schemas";

const normalizePhone = (value: string) => value.replace(/\D/g, "");
const defaultWorkingDays = [1, 2, 3, 4, 5, 6];
const MAX_PUBLIC_BOOKING_DAYS_AHEAD = 7;
const brlFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL"
});

const maskPixKey = (value: string) => {
  if (!value) {
    return "";
  }
  const normalized = value.trim();
  if (normalized.length <= 6) {
    return `${normalized.slice(0, 2)}***`;
  }
  return `${normalized.slice(0, 3)}***${normalized.slice(-3)}`;
};

const resolveBookingWindow = (tenant: {
  bookingStartTime: string;
  bookingEndTime: string;
  bookingWorkingDays: number[];
}) => {
  const startMin = parseTimeToMinutes(tenant.bookingStartTime);
  const endMin = parseTimeToMinutes(tenant.bookingEndTime);
  const validStart = Number.isFinite(startMin) && startMin >= 0 && startMin <= 23 * 60 + 59;
  const validEnd = Number.isFinite(endMin) && endMin >= 0 && endMin <= 23 * 60 + 59;
  const normalizedDays = Array.from(
    new Set((tenant.bookingWorkingDays ?? []).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))
  ).sort((a, b) => a - b);

  return {
    startMin: validStart ? startMin : 8 * 60,
    endMin: validEnd && endMin > (validStart ? startMin : 8 * 60) ? endMin : 20 * 60,
    workingDays: normalizedDays.length ? normalizedDays : defaultWorkingDays
  };
};

const getServiceSelection = (payload: { serviceId?: string; serviceIds: string[] }) => {
  const unique = new Set<string>();
  if (payload.serviceId) {
    unique.add(payload.serviceId);
  }
  payload.serviceIds.forEach((serviceId) => unique.add(serviceId));
  return Array.from(unique);
};

const parseUtcDate = (value: string) => new Date(`${value}T00:00:00.000Z`);

const assertPublicBookingDateWindow = (dateValue: string) => {
  const selectedDate = parseUtcDate(dateValue);
  if (Number.isNaN(selectedDate.getTime())) {
    throw new HttpError("Data de agendamento invalida.", 422);
  }

  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const maxDate = new Date(today);
  maxDate.setUTCDate(today.getUTCDate() + MAX_PUBLIC_BOOKING_DAYS_AHEAD);

  if (selectedDate < today) {
    throw new HttpError("Nao e possivel agendar para datas passadas.", 422);
  }

  if (selectedDate > maxDate) {
    throw new HttpError(`Agendamento online permitido somente ate ${MAX_PUBLIC_BOOKING_DAYS_AHEAD} dias a frente.`, 422);
  }
};

const resolveTenantForPublicBooking = async (tenantSlug: string) => {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: {
      id: true,
      slug: true,
      name: true,
      logoUrl: true,
      servicePixKey: true,
      bookingEnabled: true,
      bookingStartTime: true,
      bookingEndTime: true,
      bookingWorkingDays: true,
      unit: {
        select: {
          active: true,
          city: true
        }
      },
      subscription: {
        select: {
          status: true
        }
      }
    }
  });

  if (!tenant || !tenant.unit?.active) {
    throw new HttpError("Estabelecimento nao encontrado.", 404);
  }

  if (
    tenant.subscription &&
    tenant.subscription.status !== SubscriptionStatus.ACTIVE &&
    tenant.subscription.status !== SubscriptionStatus.TRIALING
  ) {
    throw new HttpError("Agendamento indisponivel no momento para este estabelecimento.", 403);
  }

  if (!tenant.bookingEnabled) {
    throw new HttpError("Agendamento online desativado para este estabelecimento.", 403);
  }

  return tenant;
};

const resolveOrCreateClient = async (
  tenantId: string,
  input: { name: string; phone: string; email?: string }
) => {
  const normalizedPhone = normalizePhone(input.phone);
  if (!normalizedPhone) {
    throw new HttpError("Telefone invalido.", 422);
  }

  const existing = await prisma.client.findFirst({
    where: {
      tenantId,
      OR: [
        { phone: input.phone },
        { phone: normalizedPhone },
        { phone: `+${normalizedPhone}` },
        ...(input.email ? [{ email: input.email }] : [])
      ]
    }
  });

  if (existing) {
    return prisma.client.update({
      where: { id: existing.id },
      data: {
        name: existing.name || input.name,
        phone: existing.phone || normalizedPhone,
        email: existing.email || input.email
      }
    });
  }

  return prisma.client.create({
    data: {
      tenantId,
      name: input.name,
      phone: normalizedPhone,
      email: input.email
    }
  });
};

export const getPublicBookingContext = async (tenantSlug: string) => {
  const tenant = await resolveTenantForPublicBooking(tenantSlug);
  const normalizedPixKey = tenant.servicePixKey ? normalizePixKey(tenant.servicePixKey) : "";
  const pixEnabled = Boolean(normalizedPixKey) && isValidPixKey(normalizedPixKey);

  const [barbers, services] = await Promise.all([
    listBarberOptions(tenant.id),
    prisma.service.findMany({
      where: {
        tenantId: tenant.id,
        active: true
      },
      select: {
        id: true,
        name: true,
        description: true,
        durationMin: true,
        price: true
      },
      orderBy: {
        name: "asc"
      }
    })
  ]);

  return {
    tenant: {
      slug: tenant.slug,
      name: tenant.name,
      logoUrl: tenant.logoUrl,
      paymentSettings: {
        pixEnabled
      },
      bookingSettings: {
        startTime: tenant.bookingStartTime,
        endTime: tenant.bookingEndTime,
        workingDays: tenant.bookingWorkingDays,
        maxAdvanceDays: MAX_PUBLIC_BOOKING_DAYS_AHEAD
      }
    },
    barbers,
    services: services.map((service) => ({
      ...service,
      price: Number(service.price)
    }))
  };
};

export const getPublicBookingAvailableSlots = async (
  tenantSlug: string,
  query: PublicBookingSlotsQueryInput
) => {
  const tenant = await resolveTenantForPublicBooking(tenantSlug);
  assertPublicBookingDateWindow(query.date);

  const barbers = await listBarberOptions(tenant.id);
  const barberExists = barbers.some((barber) => barber.id === query.barberId);
  if (!barberExists) {
    throw new HttpError("Barbeiro invalido para este estabelecimento.", 404);
  }

  const selection = getServiceSelection({
    serviceId: query.serviceId,
    serviceIds: query.serviceIds
  });

  const servicesCount = await prisma.service.count({
    where: {
      tenantId: tenant.id,
      active: true,
      id: {
        in: selection
      }
    }
  });

  if (servicesCount !== selection.length) {
    throw new HttpError("Um ou mais servicos selecionados sao invalidos.", 422);
  }

  return getAvailableSlots(
    tenant.id,
    {
      date: query.date,
      barberId: query.barberId,
      serviceIds: selection,
      intervalMin: query.intervalMin
    },
    {
      window: resolveBookingWindow(tenant)
    }
  );
};

export const createPublicBookingAppointment = async (
  tenantSlug: string,
  payload: PublicBookingCreateInput
) => {
  const tenant = await resolveTenantForPublicBooking(tenantSlug);
  assertPublicBookingDateWindow(payload.date);
  const tenantPixKey = tenant.servicePixKey ? normalizePixKey(tenant.servicePixKey) : "";
  const pixEnabled = Boolean(tenantPixKey) && isValidPixKey(tenantPixKey);
  if (payload.paymentMethod === "PIX" && !pixEnabled) {
    throw new HttpError("Este estabelecimento ainda nao configurou chave PIX para cobranca online.", 422);
  }

  const serviceIds = getServiceSelection({
    serviceId: payload.serviceId,
    serviceIds: payload.serviceIds
  });

  const [barbers, services] = await Promise.all([
    listBarberOptions(tenant.id),
    prisma.service.findMany({
      where: {
        tenantId: tenant.id,
        active: true,
        id: { in: serviceIds }
      },
      select: {
        id: true,
        name: true,
        price: true
      }
    })
  ]);

  if (!barbers.some((barber) => barber.id === payload.barberId)) {
    throw new HttpError("Barbeiro invalido para este estabelecimento.", 404);
  }

  if (services.length !== serviceIds.length) {
    throw new HttpError("Um ou mais servicos selecionados sao invalidos.", 422);
  }

  const client = await resolveOrCreateClient(tenant.id, {
    name: payload.clientName,
    phone: payload.clientPhone,
    email: payload.clientEmail
  });

  const appointment = await createAppointment(tenant.id, {
    clientId: client.id,
    barberId: payload.barberId,
    serviceIds,
    date: payload.date,
    startTime: payload.startTime,
    status: AppointmentStatus.AGENDADO,
    notes: payload.notes
  });
  if (!appointment) {
    throw new HttpError("Nao foi possivel registrar o agendamento.", 500);
  }

  const servicesById = new Map(services.map((service) => [service.id, service]));
  const serviceNames = serviceIds
    .map((id) => servicesById.get(id)?.name)
    .filter((name): name is string => Boolean(name));

  const amount = Number(appointment.price ?? 0);
  const selectedMethod = payload.paymentMethod === "PIX" ? PaymentMethod.PIX : PaymentMethod.CARTAO_CREDITO;
  const existingPending = await prisma.payment.findFirst({
    where: {
      tenantId: tenant.id,
      appointmentId: appointment.id
    },
    orderBy: {
      createdAt: "desc"
    }
  });

  await (existingPending
    ? prisma.payment.update({
        where: { id: existingPending.id },
        data: {
          method: selectedMethod,
          status: PaymentStatus.PENDENTE,
          amount,
          notes:
            selectedMethod === PaymentMethod.PIX
              ? "Cobranca PIX gerada no agendamento online."
              : "Pagamento presencial no atendimento (cartao)."
        }
      })
    : prisma.payment.create({
        data: {
          tenantId: tenant.id,
          appointmentId: appointment.id,
          clientId: client.id,
          method: selectedMethod,
          status: PaymentStatus.PENDENTE,
          amount,
          notes:
            selectedMethod === PaymentMethod.PIX
              ? "Cobranca PIX gerada no agendamento online."
              : "Pagamento presencial no atendimento (cartao)."
        }
      }));

  const payment =
    selectedMethod === PaymentMethod.PIX
      ? (() => {
          const externalRef = `booking_${appointment.id.replace(/-/g, "").slice(0, 20)}`;
          const copyPasteCode = buildPixCopyPasteCode({
            pixKey: tenantPixKey,
            amount,
            txid: externalRef,
            merchantName: sanitizeMerchantText(tenant.name, 25, "BARBEARIA PREMIUM"),
            merchantCity: sanitizeMerchantText(tenant.unit?.city ?? "SAO PAULO", 15, "SAO PAULO")
          });

          return {
            method: "PIX" as const,
            status: "PENDING" as const,
            amount,
            qrCode: copyPasteCode,
            copyPasteCode,
            beneficiary: tenant.name,
            keyMasked: maskPixKey(tenantPixKey)
          };
        })()
      : {
          method: "CARD" as const,
          status: "PENDING" as const,
          amount,
          instructions: "Pagamento no local, no horario do atendimento."
        };

  queueOutgoingWhatsAppMessage({
    tenantId: tenant.id,
    clientId: client.id,
    appointmentId: appointment.id,
    message: [
      `Ola ${client.name}, seu agendamento na ${tenant.name} foi confirmado.`,
      `Data: ${appointment.date} as ${appointment.startTime}.`,
      `Servicos: ${serviceNames.join(", ")}.`,
      `Valor: ${brlFormatter.format(amount)}.`,
      payment.method === "PIX"
        ? `Pagamento PIX: ${payment.copyPasteCode}`
        : "Pagamento em cartao sera realizado presencialmente no atendimento."
    ].join(" "),
    metadata: {
      event: "PUBLIC_BOOKING_CREATED",
      paymentMethod: payment.method
    }
  }).catch(() => null);

  return {
    tenant: {
      slug: tenant.slug,
      name: tenant.name
    },
    client: {
      id: client.id,
      name: client.name,
      phone: client.phone,
      email: client.email
    },
    appointment,
    payment
  };
};
