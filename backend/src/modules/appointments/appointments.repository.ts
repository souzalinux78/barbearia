import {
  AppointmentStatus,
  Prisma,
  PrismaClient,
  RoleName
} from "@prisma/client";
import { prisma } from "../../config/prisma";

type DbClient = PrismaClient | Prisma.TransactionClient;

const appointmentInclude = {
  client: true,
  barber: {
    select: {
      id: true,
      name: true
    }
  },
  service: true,
  appointmentServices: {
    include: {
      service: true
    }
  }
} satisfies Prisma.AppointmentInclude;

export class AppointmentsRepository {
  constructor(private readonly db: DbClient = prisma) {}

  withClient(client: DbClient): AppointmentsRepository {
    return new AppointmentsRepository(client);
  }

  getPrisma(): DbClient {
    return this.db;
  }

  findBarber(tenantId: string, barberId: string) {
    return this.db.user.findFirst({
      where: {
        id: barberId,
        tenantId,
        active: true
      },
      include: {
        role: true
      }
    });
  }

  listBarbers(tenantId: string) {
    return this.db.user.findMany({
      where: {
        tenantId,
        active: true,
        role: {
          name: RoleName.BARBER
        }
      },
      select: {
        id: true,
        name: true
      },
      orderBy: {
        name: "asc"
      }
    });
  }

  findClient(tenantId: string, clientId: string) {
    return this.db.client.findFirst({
      where: {
        id: clientId,
        tenantId
      }
    });
  }

  findServices(tenantId: string, serviceIds: string[]) {
    return this.db.service.findMany({
      where: {
        tenantId,
        id: { in: serviceIds },
        active: true
      }
    });
  }

  findAppointmentById(tenantId: string, appointmentId: string) {
    return this.db.appointment.findFirst({
      where: {
        id: appointmentId,
        tenantId
      },
      include: appointmentInclude
    });
  }

  findBusyBarberSlots(
    tenantId: string,
    barberId: string,
    date: Date,
    excludeAppointmentId?: string
  ) {
    return this.db.appointment.findMany({
      where: {
        tenantId,
        barberId,
        date,
        status: {
          notIn: [AppointmentStatus.CANCELADO, AppointmentStatus.NO_SHOW]
        },
        ...(excludeAppointmentId ? { id: { not: excludeAppointmentId } } : {})
      },
      select: {
        id: true,
        startTime: true,
        endTime: true
      }
    });
  }

  async createAppointment(data: {
    tenantId: string;
    clientId?: string;
    barberId: string;
    serviceId?: string;
    date: Date;
    startTime: Date;
    endTime: Date;
    status: AppointmentStatus;
    price: number;
    notes?: string;
    reminderSent?: boolean;
    serviceRows: Array<{ serviceId: string; durationMin: number; price: number }>;
  }) {
    return this.db.appointment.create({
      data: {
        tenantId: data.tenantId,
        clientId: data.clientId,
        barberId: data.barberId,
        serviceId: data.serviceId,
        date: data.date,
        startTime: data.startTime,
        endTime: data.endTime,
        status: data.status,
        price: data.price,
        notes: data.notes,
        reminderSent: data.reminderSent ?? false,
        appointmentServices: {
          create: data.serviceRows.map((row) => ({
            tenantId: data.tenantId,
            serviceId: row.serviceId,
            durationMin: row.durationMin,
            price: row.price
          }))
        }
      },
      include: appointmentInclude
    });
  }

  async updateAppointment(
    tenantId: string,
    appointmentId: string,
    data: {
      clientId?: string | null;
      barberId?: string;
      serviceId?: string | null;
      date?: Date;
      startTime?: Date;
      endTime?: Date;
      status?: AppointmentStatus;
      price?: number;
      notes?: string;
      reminderSent?: boolean;
      serviceRows?: Array<{ serviceId: string; durationMin: number; price: number }>;
    }
  ) {
    const hasServiceRows = Array.isArray(data.serviceRows);

    return this.db.appointment.update({
      where: {
        id: appointmentId
      },
      data: {
        clientId: data.clientId,
        barberId: data.barberId,
        serviceId: data.serviceId,
        date: data.date,
        startTime: data.startTime,
        endTime: data.endTime,
        status: data.status,
        price: data.price,
        notes: data.notes,
        reminderSent: data.reminderSent,
        ...(hasServiceRows
          ? {
              appointmentServices: {
                deleteMany: {},
                create: data.serviceRows!.map((row) => ({
                  tenantId,
                  serviceId: row.serviceId,
                  durationMin: row.durationMin,
                  price: row.price
                }))
              }
            }
          : {})
      },
      include: appointmentInclude
    });
  }

  listDayAppointments(tenantId: string, date: Date, page: number, pageSize: number) {
    return Promise.all([
      this.db.appointment.findMany({
        where: { tenantId, date },
        include: appointmentInclude,
        orderBy: [{ startTime: "asc" }, { createdAt: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      this.db.appointment.count({
        where: { tenantId, date }
      })
    ]);
  }

  listWeekAppointments(
    tenantId: string,
    startDate: Date,
    endDate: Date,
    page: number,
    pageSize: number
  ) {
    return Promise.all([
      this.db.appointment.findMany({
        where: {
          tenantId,
          date: {
            gte: startDate,
            lte: endDate
          }
        },
        include: appointmentInclude,
        orderBy: [{ date: "asc" }, { startTime: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      this.db.appointment.count({
        where: {
          tenantId,
          date: {
            gte: startDate,
            lte: endDate
          }
        }
      })
    ]);
  }

  listAppointmentsByDate(tenantId: string, date: Date) {
    return this.db.appointment.findMany({
      where: {
        tenantId,
        date
      },
      select: {
        id: true,
        barberId: true,
        startTime: true,
        endTime: true,
        status: true
      }
    });
  }

  countActiveBarbers(tenantId: string) {
    return this.db.user.count({
      where: {
        tenantId,
        active: true,
        role: {
          name: RoleName.BARBER
        }
      }
    });
  }

  listUpcomingAppointments(tenantId: string, fromDate: Date, page: number, pageSize: number) {
    return Promise.all([
      this.db.appointment.findMany({
        where: {
          tenantId,
          date: {
            gte: fromDate
          },
          status: {
            in: [AppointmentStatus.AGENDADO, AppointmentStatus.CONFIRMADO, AppointmentStatus.EM_ATENDIMENTO]
          }
        },
        include: appointmentInclude,
        orderBy: [{ date: "asc" }, { startTime: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize * 3
      }),
      this.db.appointment.count({
        where: {
          tenantId,
          date: {
            gte: fromDate
          },
          status: {
            in: [AppointmentStatus.AGENDADO, AppointmentStatus.CONFIRMADO, AppointmentStatus.EM_ATENDIMENTO]
          }
        }
      })
    ]);
  }

  listNoShowGrouped(tenantId: string, from: Date, to: Date) {
    return this.db.appointment.groupBy({
      by: ["clientId"],
      where: {
        tenantId,
        status: AppointmentStatus.NO_SHOW,
        date: {
          gte: from,
          lte: to
        }
      },
      _count: {
        _all: true
      },
      orderBy: {
        _count: {
          clientId: "desc"
        }
      }
    });
  }

  listClientsByIds(tenantId: string, ids: string[]) {
    return this.db.client.findMany({
      where: {
        tenantId,
        id: {
          in: ids
        }
      },
      select: {
        id: true,
        name: true,
        vipBadge: true,
        noShowCount: true
      }
    });
  }

  countClientFinalizedAppointments(tenantId: string, clientId: string) {
    return this.db.appointment.count({
      where: {
        tenantId,
        clientId,
        status: AppointmentStatus.FINALIZADO
      }
    });
  }

  async applyFinalizationEffects(data: {
    tenantId: string;
    appointmentId: string;
    barberId: string;
    amount: number;
  }) {
    const existingPayment = await this.db.payment.findFirst({
      where: {
        tenantId: data.tenantId,
        appointmentId: data.appointmentId
      }
    });

    if (!existingPayment) {
      await this.db.payment.create({
        data: {
          tenantId: data.tenantId,
          appointmentId: data.appointmentId,
          method: "CASH",
          amount: data.amount,
          notes: "Pagamento automatico na finalizacao do agendamento."
        }
      });
    }

    const existingCommission = await this.db.commission.findFirst({
      where: {
        tenantId: data.tenantId,
        appointmentId: data.appointmentId,
        userId: data.barberId
      }
    });

    if (!existingCommission) {
      await this.db.commission.create({
        data: {
          tenantId: data.tenantId,
          appointmentId: data.appointmentId,
          userId: data.barberId,
          amount: Number((data.amount * 0.4).toFixed(2)),
          paid: false
        }
      });
    }
  }

  incrementClientNoShow(tenantId: string, clientId: string) {
    return this.db.client.updateMany({
      where: {
        id: clientId,
        tenantId
      },
      data: {
        noShowCount: {
          increment: 1
        }
      }
    });
  }
}

export const appointmentsRepository = new AppointmentsRepository();
