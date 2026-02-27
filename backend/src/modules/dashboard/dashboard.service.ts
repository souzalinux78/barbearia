import { AppointmentStatus } from "@prisma/client";
import { prisma } from "../../config/prisma";

const startOfDay = (date: Date): Date => {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
};

const endOfDay = (date: Date): Date => {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
};

const normalizeDate = (value: Date): Date => {
  const date = new Date(value);
  date.setUTCHours(0, 0, 0, 0);
  return date;
};

export const getOverview = async (tenantId: string) => {
  const today = new Date();
  const dayStart = startOfDay(today);
  const dayEnd = endOfDay(today);
  const todayDateOnly = normalizeDate(today);

  const [dailyRevenue, dailyAppointments, newClientsToday, topServicesRaw, weeklyPayments] =
    await Promise.all([
      prisma.payment.aggregate({
        _sum: { amount: true },
        where: {
          tenantId,
          paidAt: {
            gte: dayStart,
            lte: dayEnd
          }
        }
      }),
      prisma.appointment.count({
        where: {
          tenantId,
          date: todayDateOnly
        }
      }),
      prisma.client.count({
        where: {
          tenantId,
          createdAt: {
            gte: dayStart,
            lte: dayEnd
          }
        }
      }),
      prisma.appointmentService.groupBy({
        by: ["serviceId"],
        where: {
          tenantId,
          appointment: {
            status: AppointmentStatus.FINALIZADO
          }
        },
        _count: {
          serviceId: true
        },
        orderBy: {
          _count: {
            serviceId: "desc"
          }
        },
        take: 5
      }),
      prisma.payment.findMany({
        where: {
          tenantId,
          paidAt: {
            gte: startOfDay(new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000)),
            lte: dayEnd
          }
        },
        select: {
          amount: true,
          paidAt: true
        }
      })
    ]);

  const services = await prisma.service.findMany({
    where: {
      tenantId,
      id: {
        in: topServicesRaw.map((item) => item.serviceId)
      }
    },
    select: {
      id: true,
      name: true
    }
  });

  const topServices = topServicesRaw.map((item) => ({
    serviceId: item.serviceId,
    serviceName: services.find((service) => service.id === item.serviceId)?.name ?? "Servico removido",
    total: item._count.serviceId
  }));

  const weeklyMap = new Map<string, number>();
  for (let i = 6; i >= 0; i -= 1) {
    const day = startOfDay(new Date(today.getTime() - i * 24 * 60 * 60 * 1000));
    weeklyMap.set(day.toISOString().slice(0, 10), 0);
  }

  weeklyPayments.forEach((payment) => {
    const key = startOfDay(payment.paidAt).toISOString().slice(0, 10);
    weeklyMap.set(key, (weeklyMap.get(key) ?? 0) + Number(payment.amount));
  });

  const weeklySeries = Array.from(weeklyMap.entries()).map(([date, value]) => ({
    date,
    revenue: value
  }));

  return {
    revenueToday: Number(dailyRevenue._sum.amount ?? 0),
    appointmentsToday: dailyAppointments,
    newClientsToday,
    topServices,
    weeklySeries
  };
};
