import {
  AppointmentStatus,
  AutomationRuleType,
  Prisma,
  RoleName,
  WhatsAppDirection
} from "@prisma/client";
import { prisma } from "../../config/prisma";
import { HttpError } from "../../utils/http-error";
import {
  calculateNoShowReduction,
  calculateRate,
  DEFAULT_AUTOMATION_TEMPLATES,
  renderAutomationTemplate
} from "./automation.calculations";
import {
  AutomationMetricsQueryInput,
  ListAutomationMessagesQueryInput,
  UpdateAutomationRuleInput
} from "./automation.schemas";
import { queueOutgoingWhatsAppMessage } from "../whatsapp/whatsapp.service";

const DAY_MS = 24 * 60 * 60 * 1000;
const AUTOMATION_SWEEP_INTERVAL_MS = 5 * 60 * 1000;

let automationTimer: NodeJS.Timeout | null = null;

const formatDate = (value: Date) =>
  value.toLocaleDateString("pt-BR", {
    timeZone: "UTC"
  });

const formatTime = (value: Date) =>
  value.toISOString().slice(11, 16);

const startOfUtcDay = (date: Date) => {
  const result = new Date(date);
  result.setUTCHours(0, 0, 0, 0);
  return result;
};

const endOfUtcDay = (date: Date) => {
  const result = new Date(date);
  result.setUTCHours(23, 59, 59, 999);
  return result;
};

const combineDateAndTime = (date: Date, time: Date) =>
  new Date(`${date.toISOString().slice(0, 10)}T${time.toISOString().slice(11, 16)}:00`);

const ensureRule = async (tenantId: string, type: AutomationRuleType) => {
  const templateMessage = DEFAULT_AUTOMATION_TEMPLATES[type];
  const delayByType: Record<AutomationRuleType, number> = {
    CONFIRMATION: 0,
    REMINDER: 60,
    REACTIVATION: 0,
    UPSELL: 15,
    BIRTHDAY: 0
  };

  return prisma.automationRule.upsert({
    where: {
      tenantId_type: {
        tenantId,
        type
      }
    },
    create: {
      tenantId,
      type,
      active: true,
      delayMinutes: delayByType[type],
      templateMessage
    },
    update: {}
  });
};

export const ensureAutomationBootstrap = async (tenantId: string) => {
  const types: AutomationRuleType[] = [
    AutomationRuleType.CONFIRMATION,
    AutomationRuleType.REMINDER,
    AutomationRuleType.REACTIVATION,
    AutomationRuleType.UPSELL,
    AutomationRuleType.BIRTHDAY
  ];

  for (const type of types) {
    await ensureRule(tenantId, type);
  }
};

export const getAutomationRules = async (tenantId: string) => {
  await ensureAutomationBootstrap(tenantId);
  return prisma.automationRule.findMany({
    where: { tenantId },
    orderBy: {
      type: "asc"
    }
  });
};

export const updateAutomationRule = async (
  tenantId: string,
  type: AutomationRuleType,
  payload: UpdateAutomationRuleInput
) => {
  await ensureRule(tenantId, type);

  return prisma.automationRule.update({
    where: {
      tenantId_type: {
        tenantId,
        type
      }
    },
    data: {
      active: payload.active,
      delayMinutes: payload.delayMinutes,
      templateMessage: payload.templateMessage
    }
  });
};

export const getAutomationMessages = async (
  tenantId: string,
  query: ListAutomationMessagesQueryInput,
  actor: { role: RoleName; userId: string }
) => {
  const where: Prisma.WhatsAppMessageWhereInput = {
    tenantId,
    ...(query.type ? { automationType: query.type } : {}),
    ...(query.direction ? { direction: query.direction } : {}),
    ...(query.clientId ? { clientId: query.clientId } : {})
  };

  if (actor.role === RoleName.BARBER) {
    where.appointment = {
      barberId: actor.userId
    };
  }

  const [items, total] = await Promise.all([
    prisma.whatsAppMessage.findMany({
      where,
      include: {
        client: {
          select: {
            id: true,
            name: true,
            phone: true
          }
        },
        appointment: {
          select: {
            id: true,
            date: true,
            status: true,
            barberId: true
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize
    }),
    prisma.whatsAppMessage.count({ where })
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

const queueByRule = async (input: {
  tenantId: string;
  ruleType: AutomationRuleType;
  clientId: string;
  appointmentId?: string;
  variables: Record<string, string | number | null | undefined>;
  metadata?: Prisma.InputJsonValue;
  overrideDelayMinutes?: number;
}) => {
  const rule = await ensureRule(input.tenantId, input.ruleType);
  if (!rule.active) {
    return {
      queued: false,
      reason: "RULE_DISABLED"
    };
  }

  const message = renderAutomationTemplate(rule.templateMessage, input.variables).trim();
  if (!message) {
    return {
      queued: false,
      reason: "EMPTY_TEMPLATE"
    };
  }

  return queueOutgoingWhatsAppMessage({
    tenantId: input.tenantId,
    clientId: input.clientId,
    appointmentId: input.appointmentId,
    message,
    automationType: input.ruleType,
    metadata: input.metadata,
    delayMinutes: input.overrideDelayMinutes ?? rule.delayMinutes
  });
};

const getAppointmentForAutomation = async (tenantId: string, appointmentId: string) => {
  const appointment = await prisma.appointment.findFirst({
    where: {
      tenantId,
      id: appointmentId
    },
    select: {
      id: true,
      date: true,
      startTime: true,
      status: true,
      clientId: true,
      client: {
        select: {
          name: true,
          phone: true
        }
      },
      barber: {
        select: {
          name: true
        }
      }
    }
  });

  if (!appointment) {
    throw new HttpError("Agendamento nao encontrado para automacao.", 404);
  }
  if (!appointment.clientId || !appointment.client?.phone) {
    return null;
  }

  return appointment;
};

export const queueAppointmentConfirmationAutomation = async (
  tenantId: string,
  appointmentId: string
) => {
  const appointment = await getAppointmentForAutomation(tenantId, appointmentId);
  if (!appointment) {
    return {
      queued: false,
      reason: "CLIENT_WITHOUT_PHONE"
    };
  }

  return queueByRule({
    tenantId,
    ruleType: AutomationRuleType.CONFIRMATION,
    clientId: appointment.clientId!,
    appointmentId: appointment.id,
    variables: {
      client_name: appointment.client?.name ?? "Cliente",
      date: formatDate(appointment.date),
      time: formatTime(appointment.startTime),
      barber_name: appointment.barber.name
    },
    metadata: {
      event: "APPOINTMENT_CREATED"
    }
  });
};

export const queueAppointmentCancellationAutomation = async (
  tenantId: string,
  appointmentId: string
) => {
  const appointment = await getAppointmentForAutomation(tenantId, appointmentId);
  if (!appointment) {
    return {
      queued: false,
      reason: "CLIENT_WITHOUT_PHONE"
    };
  }

  const message = `Ola ${appointment.client?.name ?? "cliente"}, seu agendamento de ${formatDate(
    appointment.date
  )} as ${formatTime(appointment.startTime)} foi cancelado. Se desejar, podemos remarcar.`;

  return queueOutgoingWhatsAppMessage({
    tenantId,
    clientId: appointment.clientId!,
    appointmentId: appointment.id,
    message,
    automationType: AutomationRuleType.CONFIRMATION,
    metadata: {
      event: "APPOINTMENT_CANCELED"
    }
  });
};

export const queueAppointmentUpsellAutomation = async (tenantId: string, appointmentId: string) => {
  const appointment = await getAppointmentForAutomation(tenantId, appointmentId);
  if (!appointment) {
    return {
      queued: false,
      reason: "CLIENT_WITHOUT_PHONE"
    };
  }

  return queueByRule({
    tenantId,
    ruleType: AutomationRuleType.UPSELL,
    clientId: appointment.clientId!,
    appointmentId: appointment.id,
    variables: {
      client_name: appointment.client?.name ?? "Cliente",
      date: formatDate(appointment.date),
      time: formatTime(appointment.startTime),
      barber_name: appointment.barber.name
    },
    metadata: {
      event: "APPOINTMENT_FINISHED"
    }
  });
};

export const queuePaymentConfirmedAutomation = async (
  tenantId: string,
  clientId: string,
  amount: number
) =>
  queueOutgoingWhatsAppMessage({
    tenantId,
    clientId,
    message: `Pagamento confirmado com sucesso no valor de R$ ${amount.toFixed(2)}. Obrigado!`,
    metadata: {
      event: "PAYMENT_CONFIRMED"
    }
  });

const runReminderSweep = async () => {
  const rules = await prisma.automationRule.findMany({
    where: {
      type: AutomationRuleType.REMINDER,
      active: true,
      tenant: {
        whatsAppConfig: {
          is: {
            active: true
          }
        }
      }
    },
    select: {
      tenantId: true,
      delayMinutes: true,
      templateMessage: true
    }
  });

  let queued = 0;
  const now = new Date();
  const lowerDate = startOfUtcDay(new Date(now.getTime() - DAY_MS));
  const upperDate = endOfUtcDay(new Date(now.getTime() + DAY_MS));

  for (const rule of rules) {
    const appointments = await prisma.appointment.findMany({
      where: {
        tenantId: rule.tenantId,
        date: {
          gte: lowerDate,
          lte: upperDate
        },
        status: {
          in: [AppointmentStatus.AGENDADO, AppointmentStatus.CONFIRMADO]
        },
        clientId: {
          not: null
        },
        client: {
          phone: {
            not: null
          }
        }
      },
      select: {
        id: true,
        tenantId: true,
        date: true,
        startTime: true,
        clientId: true,
        client: {
          select: {
            name: true
          }
        },
        barber: {
          select: {
            name: true
          }
        }
      }
    });

    if (!appointments.length) {
      continue;
    }

    const existingMessages = await prisma.whatsAppMessage.findMany({
      where: {
        tenantId: rule.tenantId,
        direction: WhatsAppDirection.OUTBOUND,
        automationType: AutomationRuleType.REMINDER,
        appointmentId: {
          in: appointments.map((item) => item.id)
        }
      },
      select: {
        appointmentId: true
      }
    });
    const alreadySent = new Set(
      existingMessages
        .map((item) => item.appointmentId)
        .filter((value): value is string => Boolean(value))
    );

    for (const appointment of appointments) {
      if (!appointment.clientId || alreadySent.has(appointment.id)) {
        continue;
      }

      const startAt = combineDateAndTime(appointment.date, appointment.startTime);
      const diffMinutes = Math.round((startAt.getTime() - now.getTime()) / 60000);
      const targetDelay = Math.max(0, rule.delayMinutes);
      if (diffMinutes > targetDelay || diffMinutes <= targetDelay - 6) {
        continue;
      }

      const message = renderAutomationTemplate(rule.templateMessage, {
        client_name: appointment.client?.name ?? "Cliente",
        date: formatDate(appointment.date),
        time: formatTime(appointment.startTime),
        barber_name: appointment.barber.name
      });

      const result = await queueOutgoingWhatsAppMessage({
        tenantId: rule.tenantId,
        clientId: appointment.clientId,
        appointmentId: appointment.id,
        message,
        automationType: AutomationRuleType.REMINDER,
        metadata: {
          event: "ONE_HOUR_REMINDER"
        }
      });

      if (result.queued) {
        queued += 1;
      }
    }
  }

  return queued;
};

const runReactivationSweep = async () => {
  const rules = await prisma.automationRule.findMany({
    where: {
      type: AutomationRuleType.REACTIVATION,
      active: true,
      tenant: {
        whatsAppConfig: {
          is: {
            active: true
          }
        }
      }
    },
    select: {
      tenantId: true,
      templateMessage: true
    }
  });

  const now = new Date();
  const cutoff = new Date(now.getTime() - 30 * DAY_MS);
  let queued = 0;

  for (const rule of rules) {
    const [clients, recentMessages] = await Promise.all([
      prisma.client.findMany({
        where: {
          tenantId: rule.tenantId,
          phone: {
            not: null
          },
          lastVisit: {
            lte: cutoff
          }
        },
        select: {
          id: true,
          name: true,
          lastVisit: true
        },
        take: 300
      }),
      prisma.whatsAppMessage.findMany({
        where: {
          tenantId: rule.tenantId,
          direction: WhatsAppDirection.OUTBOUND,
          automationType: AutomationRuleType.REACTIVATION,
          createdAt: {
            gte: cutoff
          }
        },
        select: {
          clientId: true
        }
      })
    ]);

    if (!clients.length) {
      continue;
    }

    const recentlyContacted = new Set(recentMessages.map((item) => item.clientId));
    for (const client of clients) {
      if (recentlyContacted.has(client.id)) {
        continue;
      }

      const message = renderAutomationTemplate(rule.templateMessage, {
        client_name: client.name
      });

      const result = await queueOutgoingWhatsAppMessage({
        tenantId: rule.tenantId,
        clientId: client.id,
        message,
        automationType: AutomationRuleType.REACTIVATION,
        metadata: {
          event: "REACTIVATION",
          lastVisit: client.lastVisit?.toISOString() ?? null
        }
      });
      if (result.queued) {
        queued += 1;
      }
    }
  }

  return queued;
};

const runBirthdaySweep = async () => {
  const rules = await prisma.automationRule.findMany({
    where: {
      type: AutomationRuleType.BIRTHDAY,
      active: true,
      tenant: {
        whatsAppConfig: {
          is: {
            active: true
          }
        }
      }
    },
    select: {
      tenantId: true,
      templateMessage: true
    }
  });

  const today = new Date();
  const month = today.getUTCMonth();
  const day = today.getUTCDate();
  const dayStart = startOfUtcDay(today);

  let queued = 0;
  for (const rule of rules) {
    const [clients, sentToday] = await Promise.all([
      prisma.client.findMany({
        where: {
          tenantId: rule.tenantId,
          phone: {
            not: null
          },
          birthDate: {
            not: null
          }
        },
        select: {
          id: true,
          name: true,
          birthDate: true
        }
      }),
      prisma.whatsAppMessage.findMany({
        where: {
          tenantId: rule.tenantId,
          direction: WhatsAppDirection.OUTBOUND,
          automationType: AutomationRuleType.BIRTHDAY,
          createdAt: {
            gte: dayStart
          }
        },
        select: {
          clientId: true
        }
      })
    ]);

    const alreadySent = new Set(sentToday.map((item) => item.clientId));
    const birthdayClients = clients.filter((client) => {
      const birthDate = client.birthDate;
      if (!birthDate) {
        return false;
      }
      return birthDate.getUTCMonth() === month && birthDate.getUTCDate() === day;
    });

    for (const client of birthdayClients) {
      if (alreadySent.has(client.id)) {
        continue;
      }

      const message = renderAutomationTemplate(rule.templateMessage, {
        client_name: client.name
      });

      const result = await queueOutgoingWhatsAppMessage({
        tenantId: rule.tenantId,
        clientId: client.id,
        message,
        automationType: AutomationRuleType.BIRTHDAY,
        metadata: {
          event: "BIRTHDAY"
        }
      });
      if (result.queued) {
        queued += 1;
      }
    }
  }

  return queued;
};

export const runAutomationEngineSweep = async () => {
  const [reminders, reactivations, birthdays] = await Promise.all([
    runReminderSweep(),
    runReactivationSweep(),
    runBirthdaySweep()
  ]);

  return {
    reminders,
    reactivations,
    birthdays,
    executedAt: new Date().toISOString()
  };
};

const buildNoShowRate = async (tenantId: string, from: Date, to: Date) => {
  const [noShows, total] = await Promise.all([
    prisma.appointment.count({
      where: {
        tenantId,
        date: {
          gte: from,
          lte: to
        },
        status: AppointmentStatus.NO_SHOW
      }
    }),
    prisma.appointment.count({
      where: {
        tenantId,
        date: {
          gte: from,
          lte: to
        },
        status: {
          not: AppointmentStatus.BLOQUEADO
        }
      }
    })
  ]);

  return {
    noShows,
    total,
    rate: calculateRate(noShows, total)
  };
};

const computeClientConversion = async (
  tenantId: string,
  messageType: AutomationRuleType,
  windowDays: number,
  periodStart: Date,
  periodEnd: Date
) => {
  const messages = await prisma.whatsAppMessage.findMany({
    where: {
      tenantId,
      direction: WhatsAppDirection.OUTBOUND,
      automationType: messageType,
      createdAt: {
        gte: periodStart,
        lte: periodEnd
      }
    },
    select: {
      clientId: true,
      createdAt: true
    }
  });

  if (!messages.length) {
    return {
      sent: 0,
      converted: 0,
      rate: 0
    };
  }

  let converted = 0;
  for (const message of messages) {
    const hasConversion = await prisma.appointment.count({
      where: {
        tenantId,
        clientId: message.clientId,
        createdAt: {
          gte: message.createdAt,
          lte: new Date(message.createdAt.getTime() + windowDays * DAY_MS)
        },
        status: {
          in: [
            AppointmentStatus.AGENDADO,
            AppointmentStatus.CONFIRMADO,
            AppointmentStatus.EM_ATENDIMENTO,
            AppointmentStatus.FINALIZADO
          ]
        }
      }
    });
    if (hasConversion > 0) {
      converted += 1;
    }
  }

  return {
    sent: messages.length,
    converted,
    rate: calculateRate(converted, messages.length)
  };
};

export const getAutomationMetrics = async (
  tenantId: string,
  query: AutomationMetricsQueryInput
) => {
  const now = new Date();
  const periodEnd = now;
  const periodStart = new Date(now.getTime() - query.days * DAY_MS);
  const previousStart = new Date(periodStart.getTime() - query.days * DAY_MS);
  const previousEnd = periodStart;

  const [
    outboundAutomation,
    inboundAutomation,
    confirmationOut,
    confirmationIn,
    noShowCurrent,
    noShowPrevious,
    reactivation,
    upsell
  ] = await Promise.all([
    prisma.whatsAppMessage.count({
      where: {
        tenantId,
        direction: WhatsAppDirection.OUTBOUND,
        automationType: {
          not: null
        },
        createdAt: {
          gte: periodStart,
          lte: periodEnd
        }
      }
    }),
    prisma.whatsAppMessage.count({
      where: {
        tenantId,
        direction: WhatsAppDirection.INBOUND,
        createdAt: {
          gte: periodStart,
          lte: periodEnd
        }
      }
    }),
    prisma.whatsAppMessage.count({
      where: {
        tenantId,
        direction: WhatsAppDirection.OUTBOUND,
        automationType: AutomationRuleType.CONFIRMATION,
        createdAt: {
          gte: periodStart,
          lte: periodEnd
        }
      }
    }),
    prisma.whatsAppMessage.count({
      where: {
        tenantId,
        direction: WhatsAppDirection.INBOUND,
        automationType: AutomationRuleType.CONFIRMATION,
        createdAt: {
          gte: periodStart,
          lte: periodEnd
        }
      }
    }),
    buildNoShowRate(tenantId, periodStart, periodEnd),
    buildNoShowRate(tenantId, previousStart, previousEnd),
    computeClientConversion(
      tenantId,
      AutomationRuleType.REACTIVATION,
      30,
      periodStart,
      periodEnd
    ),
    computeClientConversion(tenantId, AutomationRuleType.UPSELL, 15, periodStart, periodEnd)
  ]);

  const confirmationRate = calculateRate(confirmationIn, confirmationOut);
  const responseRate = calculateRate(inboundAutomation, outboundAutomation);
  const noShowReduction = calculateNoShowReduction(noShowCurrent.rate, noShowPrevious.rate);

  return {
    period: {
      start: periodStart.toISOString(),
      end: periodEnd.toISOString(),
      days: query.days
    },
    confirmationRate,
    responseRate,
    noShow: {
      currentRate: noShowCurrent.rate,
      previousRate: noShowPrevious.rate,
      reductionPercent: noShowReduction
    },
    reactivation: reactivation,
    upsell: upsell,
    totals: {
      outboundAutomation,
      inboundAutomation
    },
    funnel: [
      { stage: "Disparos", value: outboundAutomation },
      { stage: "Respostas", value: inboundAutomation },
      { stage: "Confirmacoes", value: confirmationIn },
      { stage: "Reativacoes", value: reactivation.converted },
      { stage: "Upsell", value: upsell.converted }
    ]
  };
};

export const startAutomationSchedulers = () => {
  if (automationTimer) {
    return;
  }
  runAutomationEngineSweep().catch(() => null);
  automationTimer = setInterval(() => {
    runAutomationEngineSweep().catch(() => null);
  }, AUTOMATION_SWEEP_INTERVAL_MS);
};

export const stopAutomationSchedulers = () => {
  if (!automationTimer) {
    return;
  }
  clearInterval(automationTimer);
  automationTimer = null;
};
