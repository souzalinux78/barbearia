import { PaymentStatus, Prisma, RoleName } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { HttpError } from "../../utils/http-error";
import {
  calculateChurnRatePercent,
  calculateLtvByClient,
  classifyChurnRisk,
  classifyRfm,
  getDaysSince
} from "./crm.calculations";
import {
  AutomationPreviewInput,
  CrmChurnRiskQueryInput,
  CrmClientsQueryInput,
  CrmLtvQueryInput,
  CrmRetentionQueryInput,
  CrmVipQueryInput
} from "./crm.schemas";
import {
  getLoyaltyProgram,
  redeemLoyaltyBalance,
  runLoyaltyExpirationSweep,
  upsertLoyaltyProgram
} from "./crm.loyalty";

type AuthScope = {
  tenantId: string;
  userId: string;
  role: RoleName;
};

const DAY_MS = 24 * 60 * 60 * 1000;

const startOfDay = (value: Date): Date => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

const toNumber = (value: Prisma.Decimal | number | null | undefined): number => Number(value ?? 0);

const paginate = <T>(rows: T[], page: number, pageSize: number) => {
  const total = rows.length;
  const start = (page - 1) * pageSize;
  return {
    items: rows.slice(start, start + pageSize),
    meta: {
      page,
      pageSize,
      total
    }
  };
};

const getScopedClientWhere = (scope: AuthScope): Prisma.ClientWhereInput => {
  if (scope.role === RoleName.BARBER) {
    return {
      tenantId: scope.tenantId,
      appointments: {
        some: {
          barberId: scope.userId
        }
      }
    };
  }

  return {
    tenantId: scope.tenantId
  };
};

const getSegmentWhere = (
  segment: CrmClientsQueryInput["segment"] | undefined
): Prisma.ClientWhereInput => {
  const now = new Date();

  switch (segment) {
    case "NO_RETURN_30":
      return {
        visitsCount: { gt: 0 },
        lastVisit: {
          lte: new Date(now.getTime() - 30 * DAY_MS)
        }
      };
    case "VIP":
      return { vip: true };
    case "NO_SHOW":
      return {
        noShowCount: {
          gte: 2
        }
      };
    case "HIGH_TICKET":
      return {
        totalSpent: {
          gte: 450
        }
      };
    case "INACTIVE":
      return {
        OR: [
          {
            lastVisit: null
          },
          {
            lastVisit: {
              lte: new Date(now.getTime() - 60 * DAY_MS)
            }
          }
        ]
      };
    case "NEW":
      return {
        createdAt: {
          gte: new Date(now.getTime() - 30 * DAY_MS)
        }
      };
    case "FREQUENT":
      return {
        visitsCount: {
          gte: 4
        },
        lastVisit: {
          gte: new Date(now.getTime() - 45 * DAY_MS)
        }
      };
    default:
      return {};
  }
};

const mapCrmClient = (client: {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  vip: boolean;
  noShowCount: number;
  loyaltyPoints: Prisma.Decimal;
  cashbackBalance: Prisma.Decimal;
  totalSpent: Prisma.Decimal;
  visitsCount: number;
  lastVisit: Date | null;
  createdAt: Date;
}) => {
  const daysSinceLastVisit = getDaysSince(client.lastVisit);
  const rfm = classifyRfm({
    daysSinceLastVisit,
    visitsCount: client.visitsCount,
    totalSpent: toNumber(client.totalSpent)
  });
  const churnRisk = classifyChurnRisk({
    daysSinceLastVisit,
    noShowCount: client.noShowCount
  });

  return {
    id: client.id,
    name: client.name,
    email: client.email,
    phone: client.phone,
    vip: client.vip,
    loyaltyPoints: toNumber(client.loyaltyPoints),
    cashbackBalance: toNumber(client.cashbackBalance),
    totalSpent: toNumber(client.totalSpent),
    visitsCount: client.visitsCount,
    lastVisit: client.lastVisit?.toISOString() ?? null,
    createdAt: client.createdAt.toISOString(),
    noShowCount: client.noShowCount,
    rfm,
    churnRisk
  };
};

const getScopedClientOrThrow = async (scope: AuthScope, clientId: string) => {
  const client = await prisma.client.findFirst({
    where: {
      ...getScopedClientWhere(scope),
      id: clientId
    }
  });

  if (!client) {
    throw new HttpError("Cliente nao encontrado para este perfil.", 404);
  }

  return client;
};

const getScopedPaymentWhere = (
  scope: AuthScope,
  where: Omit<Prisma.PaymentWhereInput, "tenantId"> = {}
): Prisma.PaymentWhereInput => {
  if (scope.role === RoleName.BARBER) {
    return {
      tenantId: scope.tenantId,
      ...where,
      appointment: {
        barberId: scope.userId
      }
    };
  }
  return {
    tenantId: scope.tenantId,
    ...where
  };
};

export const getCrmClients = async (scope: AuthScope, query: CrmClientsQueryInput) => {
  const where: Prisma.ClientWhereInput = {
    ...getScopedClientWhere(scope),
    ...getSegmentWhere(query.segment),
    ...(query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: "insensitive" } },
            { email: { contains: query.search, mode: "insensitive" } },
            { phone: { contains: query.search, mode: "insensitive" } }
          ]
        }
      : {})
  };

  const [rows, total] = await Promise.all([
    prisma.client.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        vip: true,
        noShowCount: true,
        loyaltyPoints: true,
        cashbackBalance: true,
        totalSpent: true,
        visitsCount: true,
        lastVisit: true,
        createdAt: true
      },
      orderBy: [{ vip: "desc" }, { totalSpent: "desc" }, { createdAt: "desc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize
    }),
    prisma.client.count({ where })
  ]);

  return {
    items: rows.map(mapCrmClient),
    meta: {
      page: query.page,
      pageSize: query.pageSize,
      total
    }
  };
};

export const getCrmClientDetails = async (scope: AuthScope, clientId: string) => {
  const client = await getScopedClientOrThrow(scope, clientId);

  const [appointments, payments, loyaltyTransactions] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        tenantId: scope.tenantId,
        clientId,
        ...(scope.role === RoleName.BARBER
          ? {
              barberId: scope.userId
            }
          : {})
      },
      include: {
        service: {
          select: {
            id: true,
            name: true
          }
        },
        barber: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: [{ date: "desc" }, { startTime: "desc" }],
      take: 30
    }),
    prisma.payment.findMany({
      where: getScopedPaymentWhere(scope, {
        clientId
      }),
      orderBy: {
        paidAt: "desc"
      },
      take: 30
    }),
    prisma.loyaltyTransaction.findMany({
      where: {
        tenantId: scope.tenantId,
        clientId
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 50
    })
  ]);

  const sortedDates = appointments
    .map((appointment) => appointment.date)
    .sort((a, b) => a.getTime() - b.getTime());
  let averageReturnDays = 0;
  if (sortedDates.length >= 2) {
    let totalDays = 0;
    for (let index = 1; index < sortedDates.length; index += 1) {
      totalDays += (sortedDates[index].getTime() - sortedDates[index - 1].getTime()) / DAY_MS;
    }
    averageReturnDays = Number((totalDays / (sortedDates.length - 1)).toFixed(2));
  }

  const mappedClient = mapCrmClient(client);
  const ltvValue = calculateLtvByClient({
    totalSpent: toNumber(client.totalSpent),
    firstSeenAt: client.createdAt
  });

  return {
    client: {
      ...mappedClient,
      averageReturnDays,
      ltv: ltvValue
    },
    appointments: appointments.map((appointment) => ({
      id: appointment.id,
      date: appointment.date.toISOString().slice(0, 10),
      startTime: appointment.startTime.toISOString().slice(11, 16),
      endTime: appointment.endTime.toISOString().slice(11, 16),
      status: appointment.status,
      price: Number(appointment.price),
      barber: appointment.barber,
      service: appointment.service
    })),
    payments: payments.map((payment) => ({
      id: payment.id,
      amount: Number(payment.amount),
      status: payment.status,
      method: payment.method,
      paidAt: payment.paidAt.toISOString(),
      notes: payment.notes
    })),
    loyaltyTransactions: loyaltyTransactions.map((transaction) => ({
      id: transaction.id,
      type: transaction.type,
      amount: Number(transaction.amount),
      appointmentId: transaction.appointmentId,
      createdAt: transaction.createdAt.toISOString()
    }))
  };
};

export const getCrmSegments = async (scope: AuthScope) => {
  const baseWhere = getScopedClientWhere(scope);
  const now = new Date();

  const [
    totalClients,
    noReturn30,
    vipClients,
    noShowRecurring,
    highTicket,
    inactive,
    newlyCreated,
    frequent
  ] = await Promise.all([
    prisma.client.count({ where: baseWhere }),
    prisma.client.count({
      where: {
        ...baseWhere,
        visitsCount: { gt: 0 },
        lastVisit: { lte: new Date(now.getTime() - 30 * DAY_MS) }
      }
    }),
    prisma.client.count({
      where: {
        ...baseWhere,
        vip: true
      }
    }),
    prisma.client.count({
      where: {
        ...baseWhere,
        noShowCount: { gte: 2 }
      }
    }),
    prisma.client.count({
      where: {
        ...baseWhere,
        totalSpent: { gte: 450 }
      }
    }),
    prisma.client.count({
      where: {
        ...baseWhere,
        OR: [{ lastVisit: null }, { lastVisit: { lte: new Date(now.getTime() - 60 * DAY_MS) } }]
      }
    }),
    prisma.client.count({
      where: {
        ...baseWhere,
        createdAt: { gte: new Date(now.getTime() - 30 * DAY_MS) }
      }
    }),
    prisma.client.count({
      where: {
        ...baseWhere,
        visitsCount: { gte: 4 },
        lastVisit: { gte: new Date(now.getTime() - 45 * DAY_MS) }
      }
    })
  ]);

  return {
    totalClients,
    segments: [
      { key: "NO_RETURN_30", label: "Nao voltam ha 30 dias", count: noReturn30 },
      { key: "VIP", label: "VIP top 20%", count: vipClients },
      { key: "NO_SHOW", label: "No-show recorrente", count: noShowRecurring },
      { key: "HIGH_TICKET", label: "Ticket alto", count: highTicket },
      { key: "INACTIVE", label: "Inativos", count: inactive },
      { key: "NEW", label: "Novos", count: newlyCreated },
      { key: "FREQUENT", label: "Frequentes", count: frequent }
    ]
  };
};

export const getCrmRetention = async (scope: AuthScope, query: CrmRetentionQueryInput) => {
  const baseWhere = getScopedClientWhere(scope);
  const now = new Date();
  const cutoff = new Date(now.getTime() - query.windowDays * DAY_MS);

  const [baseClients, activeClients, inactiveClients, churnedClients, vipRevenueAgg, topClients] =
    await Promise.all([
      prisma.client.count({
        where: {
          ...baseWhere,
          visitsCount: { gt: 0 }
        }
      }),
      prisma.client.count({
        where: {
          ...baseWhere,
          visitsCount: { gt: 0 },
          lastVisit: { gte: cutoff }
        }
      }),
      prisma.client.count({
        where: {
          ...baseWhere,
          OR: [{ visitsCount: 0 }, { lastVisit: null }, { lastVisit: { lt: cutoff } }]
        }
      }),
      prisma.client.count({
        where: {
          ...baseWhere,
          visitsCount: { gt: 0 },
          lastVisit: { lt: cutoff }
        }
      }),
      prisma.payment.aggregate({
        _sum: { amount: true },
        where: getScopedPaymentWhere(scope, {
          status: PaymentStatus.PAGO,
          paidAt: {
            gte: cutoff,
            lte: now
          },
          client: {
            vip: true
          }
        })
      }),
      prisma.client.findMany({
        where: baseWhere,
        select: {
          id: true,
          name: true,
          vip: true,
          totalSpent: true,
          visitsCount: true,
          lastVisit: true
        },
        orderBy: {
          totalSpent: "desc"
        },
        take: 10
      })
    ]);

  const retentionRate = baseClients > 0 ? Number(((activeClients / baseClients) * 100).toFixed(2)) : 0;
  const churnRate = calculateChurnRatePercent(baseClients, churnedClients);

  return {
    windowDays: query.windowDays,
    cards: {
      retentionRate,
      churnRate,
      activeClients,
      inactiveClients,
      vipRevenue: Number(vipRevenueAgg._sum.amount ?? 0)
    },
    topClients: topClients.map((client) => ({
      id: client.id,
      name: client.name,
      vip: client.vip,
      totalSpent: Number(client.totalSpent),
      visitsCount: client.visitsCount,
      lastVisit: client.lastVisit?.toISOString() ?? null
    }))
  };
};

export const getCrmLtv = async (scope: AuthScope, query: CrmLtvQueryInput) => {
  const rows = await prisma.client.findMany({
    where: {
      ...getScopedClientWhere(scope),
      visitsCount: {
        gt: 0
      }
    },
    select: {
      id: true,
      name: true,
      totalSpent: true,
      visitsCount: true,
      createdAt: true,
      lastVisit: true
    },
    orderBy: {
      totalSpent: "desc"
    },
    take: query.top
  });

  const clients = rows.map((client) => ({
    id: client.id,
    name: client.name,
    totalSpent: Number(client.totalSpent),
    visitsCount: client.visitsCount,
    activeSince: client.createdAt.toISOString(),
    ltv: calculateLtvByClient({
      totalSpent: Number(client.totalSpent),
      firstSeenAt: client.createdAt
    })
  }));

  const averageLtv =
    clients.length > 0
      ? Number((clients.reduce((sum, client) => sum + client.ltv, 0) / clients.length).toFixed(2))
      : 0;

  return {
    averageLtv,
    clients
  };
};

export const getCrmChurnRisk = async (scope: AuthScope, query: CrmChurnRiskQueryInput) => {
  const now = new Date();
  const cutoff = new Date(now.getTime() - query.minDaysWithoutVisit * DAY_MS);

  const rows = await prisma.client.findMany({
    where: {
      ...getScopedClientWhere(scope),
      OR: [
        {
          lastVisit: {
            lte: cutoff
          }
        },
        {
          noShowCount: {
            gte: 2
          }
        }
      ]
    },
    select: {
      id: true,
      name: true,
      totalSpent: true,
      visitsCount: true,
      noShowCount: true,
      lastVisit: true
    },
    orderBy: [{ lastVisit: "asc" }, { noShowCount: "desc" }]
  });

  const mapped = rows.map((client) => {
    const daysSinceLastVisit = getDaysSince(client.lastVisit, now);
    return {
      id: client.id,
      name: client.name,
      totalSpent: Number(client.totalSpent),
      visitsCount: client.visitsCount,
      noShowCount: client.noShowCount,
      daysSinceLastVisit,
      risk: classifyChurnRisk({
        daysSinceLastVisit,
        noShowCount: client.noShowCount
      })
    };
  });

  mapped.sort((a, b) => {
    const order = { alto: 0, medio: 1, baixo: 2 };
    return order[a.risk] - order[b.risk] || b.daysSinceLastVisit - a.daysSinceLastVisit;
  });

  return paginate(mapped, query.page, query.pageSize);
};

export const getCrmVip = async (scope: AuthScope, query: CrmVipQueryInput) => {
  const [rows, vipRevenue, totalRevenue] = await Promise.all([
    prisma.client.findMany({
      where: {
        ...getScopedClientWhere(scope),
        vip: true
      },
      select: {
        id: true,
        name: true,
        totalSpent: true,
        visitsCount: true,
        lastVisit: true,
        loyaltyPoints: true,
        cashbackBalance: true
      },
      orderBy: {
        totalSpent: "desc"
      }
    }),
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: getScopedPaymentWhere(scope, {
        status: PaymentStatus.PAGO,
        client: {
          vip: true
        }
      })
    }),
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: getScopedPaymentWhere(scope, {
        status: PaymentStatus.PAGO
      })
    })
  ]);

  const vipAmount = Number(vipRevenue._sum.amount ?? 0);
  const totalAmount = Number(totalRevenue._sum.amount ?? 0);
  const vipSharePercent = totalAmount > 0 ? Number(((vipAmount / totalAmount) * 100).toFixed(2)) : 0;

  return {
    summary: {
      vipClients: rows.length,
      vipRevenue: vipAmount,
      vipSharePercent
    },
    ...paginate(
      rows.map((client) => ({
        id: client.id,
        name: client.name,
        totalSpent: Number(client.totalSpent),
        visitsCount: client.visitsCount,
        lastVisit: client.lastVisit?.toISOString() ?? null,
        loyaltyPoints: Number(client.loyaltyPoints),
        cashbackBalance: Number(client.cashbackBalance)
      })),
      query.page,
      query.pageSize
    )
  };
};

export const previewCrmAutomationAudience = async (
  scope: AuthScope,
  payload: AutomationPreviewInput
) => {
  const baseWhere = getScopedClientWhere(scope);
  const now = new Date();
  const program = await getLoyaltyProgram(scope.tenantId);

  let where: Prisma.ClientWhereInput = baseWhere;
  if (payload.campaign === "INACTIVE_CLIENTS") {
    where = {
      ...baseWhere,
      OR: [{ lastVisit: null }, { lastVisit: { lte: new Date(now.getTime() - 45 * DAY_MS) } }]
    };
  } else if (payload.campaign === "EXPIRING_POINTS") {
    const days = Math.max(program.expirationDays - 7, 1);
    where = {
      ...baseWhere,
      loyaltyPoints: {
        gt: 0
      },
      lastVisit: {
        lte: new Date(now.getTime() - days * DAY_MS)
      }
    };
  } else if (payload.campaign === "VIP_OFFER") {
    where = {
      ...baseWhere,
      vip: true
    };
  }

  const rows = await prisma.client.findMany({
    where,
    select: {
      id: true,
      name: true,
      phone: true,
      loyaltyPoints: true,
      cashbackBalance: true,
      lastVisit: true
    },
    orderBy: [{ vip: "desc" }, { totalSpent: "desc" }],
    take: payload.limit
  });

  return {
    campaign: payload.campaign,
    automationReady: false,
    channel: "WHATSAPP_PENDING",
    audienceSize: rows.length,
    recipients: rows.map((row) => ({
      id: row.id,
      name: row.name,
      phone: row.phone,
      loyaltyPoints: Number(row.loyaltyPoints),
      cashbackBalance: Number(row.cashbackBalance),
      lastVisit: row.lastVisit?.toISOString() ?? null
    }))
  };
};

export const runManualLoyaltyExpiration = async (scope: AuthScope) => {
  if (scope.role !== RoleName.OWNER && scope.role !== RoleName.ADMIN) {
    throw new HttpError("Sem permissao para expirar saldos manualmente.", 403);
  }

  return runLoyaltyExpirationSweep();
};

export const crmLoyalty = {
  getProgram: getLoyaltyProgram,
  updateProgram: upsertLoyaltyProgram,
  redeem: redeemLoyaltyBalance
};

export const getCrmOverviewCards = async (scope: AuthScope) => {
  return getCrmRetention(scope, { windowDays: 60 });
};

export const getCrmClientWindow = (scope: AuthScope, windowDays = 60) => {
  const start = startOfDay(new Date(Date.now() - windowDays * DAY_MS));
  return {
    scope,
    start
  };
};
