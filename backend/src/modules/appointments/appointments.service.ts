import { AppointmentStatus, RoleName } from "@prisma/client";
import { prisma } from "../../config/prisma";
import {
  notifyAppointmentCanceled,
  notifyNewAppointment
} from "../notifications/notifications.service";
import {
  queueAppointmentCancellationAutomation,
  queueAppointmentConfirmationAutomation,
  queueAppointmentUpsellAutomation
} from "../automation/automation.engine";
import { HttpError } from "../../utils/http-error";
import {
  appointmentsRepository,
  AppointmentsRepository
} from "./appointments.repository";
import {
  AvailableSlotsInput,
  CreateAppointmentInput,
  ListAppointmentsByDayInput,
  ListAppointmentsWeekInput,
  NoShowStatsInput,
  OccupancyInput,
  UpcomingInput,
  UpdateAppointmentInput,
  UpdateAppointmentStatusInput
} from "./appointments.schemas";
import {
  assertCanAlterAppointment,
  assertCanCancelAppointment,
  calculateDuration,
  ensureNotPast,
  ensureValidTimeRange,
  formatMinutesToTime,
  hasTimeConflict,
  parseTimeToMinutes
} from "./appointments.rules";

const DEFAULT_OPEN_MIN = 8 * 60;
const DEFAULT_CLOSE_MIN = 20 * 60;

const timeStringToDate = (value: string): Date => new Date(`1970-01-01T${value}:00.000Z`);

const normalizeDate = (value: string | Date): Date => {
  const date = typeof value === "string" ? new Date(`${value}T00:00:00.000Z`) : new Date(value);
  date.setUTCHours(0, 0, 0, 0);
  return date;
};

const toTimeString = (value: Date): string => value.toISOString().slice(11, 16);
const fireNotification = (operation: Promise<unknown>) => {
  operation.catch(() => null);
};

type AppointmentRecord = NonNullable<
  Awaited<ReturnType<AppointmentsRepository["findAppointmentById"]>>
>;

const toAppointmentDTO = async (
  repository: AppointmentsRepository,
  tenantId: string,
  appointment: AppointmentRecord | null
) => {
  if (!appointment) {
    return null;
  }

  const recurringClient =
    appointment.clientId && appointment.status !== AppointmentStatus.BLOQUEADO
      ? (await repository.countClientFinalizedAppointments(tenantId, appointment.clientId)) >= 3
      : false;

  return {
    ...appointment,
    date: appointment.date.toISOString().slice(0, 10),
    startTime: toTimeString(appointment.startTime),
    endTime: toTimeString(appointment.endTime),
    recurringClient,
    vipBadge: appointment.client?.vipBadge ?? false,
    noShowAlert: (appointment.client?.noShowCount ?? 0) >= 2
  };
};

const resolveServiceSelection = (payload: { serviceId?: string; serviceIds?: string[] }): string[] => {
  const ids = new Set<string>();
  if (payload.serviceId) {
    ids.add(payload.serviceId);
  }
  if (payload.serviceIds?.length) {
    payload.serviceIds.forEach((serviceId) => ids.add(serviceId));
  }
  return Array.from(ids);
};

const validateBarberAndClient = async (
  repository: AppointmentsRepository,
  tenantId: string,
  payload: { barberId: string; clientId?: string }
) => {
  const [barber, client] = await Promise.all([
    repository.findBarber(tenantId, payload.barberId),
    payload.clientId ? repository.findClient(tenantId, payload.clientId) : Promise.resolve(null)
  ]);

  if (!barber) {
    throw new HttpError("Barbeiro nao encontrado para este tenant.", 404);
  }

  if (payload.clientId && !client) {
    throw new HttpError("Cliente nao encontrado para este tenant.", 404);
  }

  return { barber, client };
};

const resolveDurationAndPrice = async (
  repository: AppointmentsRepository,
  tenantId: string,
  serviceIds: string[]
) => {
  if (!serviceIds.length) {
    return {
      totalDuration: 0,
      totalPrice: 0,
      primaryServiceId: null as string | null,
      rows: [] as Array<{ serviceId: string; durationMin: number; price: number }>
    };
  }

  const services = await repository.findServices(tenantId, serviceIds);
  if (services.length !== serviceIds.length) {
    throw new HttpError("Um ou mais servicos nao pertencem ao tenant.", 422);
  }

  const sorted = serviceIds
    .map((id) => services.find((service) => service.id === id))
    .filter(Boolean);

  const totalDuration = sorted.reduce((sum, service) => sum + (service?.durationMin ?? 0), 0);
  const totalPrice = sorted.reduce((sum, service) => sum + Number(service?.price ?? 0), 0);
  const rows = sorted.map((service) => ({
    serviceId: service!.id,
    durationMin: service!.durationMin,
    price: Number(service!.price)
  }));

  return {
    totalDuration,
    totalPrice,
    primaryServiceId: sorted[0]?.id ?? null,
    rows
  };
};

const ensureNoBarberConflict = async (
  repository: AppointmentsRepository,
  tenantId: string,
  payload: {
    barberId: string;
    date: Date;
    startTime: string;
    endTime: string;
    excludeAppointmentId?: string;
  }
) => {
  const busySlots = await repository.findBusyBarberSlots(
    tenantId,
    payload.barberId,
    payload.date,
    payload.excludeAppointmentId
  );

  const candidate = {
    startMin: parseTimeToMinutes(payload.startTime),
    endMin: parseTimeToMinutes(payload.endTime)
  };

  const existing = busySlots.map((slot) => ({
    startMin: parseTimeToMinutes(toTimeString(slot.startTime)),
    endMin: parseTimeToMinutes(toTimeString(slot.endTime))
  }));

  if (hasTimeConflict(candidate, existing)) {
    throw new HttpError("Conflito de horario para este barbeiro.", 409);
  }
};

export const createAppointment = async (tenantId: string, payload: CreateAppointmentInput) => {
  const repository = appointmentsRepository;
  await validateBarberAndClient(repository, tenantId, payload);

  const status = payload.status ?? AppointmentStatus.AGENDADO;
  const serviceIds = resolveServiceSelection(payload);

  if (status !== AppointmentStatus.BLOQUEADO && !payload.clientId) {
    throw new HttpError("Agendamento comum exige cliente.", 422);
  }

  if (status !== AppointmentStatus.BLOQUEADO && !serviceIds.length) {
    throw new HttpError("Agendamento comum exige pelo menos um servico.", 422);
  }

  const selectedDate = normalizeDate(payload.date);
  let startTime = payload.startTime;
  let endTime = payload.endTime;

  const servicesInfo = await resolveDurationAndPrice(repository, tenantId, serviceIds);
  if (!endTime && servicesInfo.totalDuration > 0) {
    endTime = formatMinutesToTime(parseTimeToMinutes(startTime) + servicesInfo.totalDuration);
  }

  if (!endTime) {
    throw new HttpError("Informe horario final ou servicos com duracao definida.", 422);
  }

  ensureValidTimeRange(startTime, endTime);
  ensureNotPast(payload.date, startTime);

  if (servicesInfo.totalDuration > 0 && calculateDuration(startTime, endTime) !== servicesInfo.totalDuration) {
    throw new HttpError("Horario final nao respeita a duracao total dos servicos.", 422);
  }

  await ensureNoBarberConflict(repository, tenantId, {
    barberId: payload.barberId,
    date: selectedDate,
    startTime,
    endTime
  });

  const created = await repository.createAppointment({
    tenantId,
    clientId: payload.clientId,
    barberId: payload.barberId,
    serviceId: servicesInfo.primaryServiceId ?? undefined,
    date: selectedDate,
    startTime: timeStringToDate(startTime),
    endTime: timeStringToDate(endTime),
    status,
    price: payload.price ?? servicesInfo.totalPrice,
    notes: payload.notes,
    reminderSent: payload.reminderSent ?? false,
    serviceRows: servicesInfo.rows
  });

  fireNotification(
    notifyNewAppointment({
      tenantId,
      clientName: created.client?.name,
      timeLabel: toTimeString(created.startTime)
    })
  );
  if (created.status === AppointmentStatus.AGENDADO || created.status === AppointmentStatus.CONFIRMADO) {
    fireNotification(queueAppointmentConfirmationAutomation(tenantId, created.id));
  }

  return toAppointmentDTO(repository, tenantId, created);
};

export const listAppointmentsByDay = async (
  tenantId: string,
  query: ListAppointmentsByDayInput
) => {
  const date = normalizeDate(query.date ?? new Date());
  const [appointments, total] = await appointmentsRepository.listDayAppointments(
    tenantId,
    date,
    query.page,
    query.pageSize
  );

  const items = await Promise.all(
    appointments.map((appointment) => toAppointmentDTO(appointmentsRepository, tenantId, appointment))
  );

  return {
    items,
    meta: {
      page: query.page,
      pageSize: query.pageSize,
      total
    }
  };
};

export const listAppointmentsByWeek = async (
  tenantId: string,
  query: ListAppointmentsWeekInput
) => {
  const baseDate = query.startDate ? normalizeDate(query.startDate) : normalizeDate(new Date());
  const day = baseDate.getUTCDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const weekStart = new Date(baseDate);
  weekStart.setUTCDate(baseDate.getUTCDate() + diffToMonday);
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekStart.getUTCDate() + 6);

  const [appointments, total] = await appointmentsRepository.listWeekAppointments(
    tenantId,
    weekStart,
    weekEnd,
    query.page,
    query.pageSize
  );

  const items = await Promise.all(
    appointments.map((appointment) => toAppointmentDTO(appointmentsRepository, tenantId, appointment))
  );

  return {
    startDate: weekStart.toISOString().slice(0, 10),
    endDate: weekEnd.toISOString().slice(0, 10),
    items,
    meta: {
      page: query.page,
      pageSize: query.pageSize,
      total
    }
  };
};

const applySideEffectsOnStatusChange = async (
  txRepository: AppointmentsRepository,
  previousStatus: AppointmentStatus,
  nextStatus: AppointmentStatus,
  appointment: AppointmentRecord | null
) => {
  if (!appointment) {
    return;
  }

  if (nextStatus === AppointmentStatus.FINALIZADO && previousStatus !== AppointmentStatus.FINALIZADO) {
    await txRepository.applyFinalizationEffects({
      tenantId: appointment.tenantId,
      appointmentId: appointment.id,
      barberId: appointment.barberId,
      amount: Number(appointment.price)
    });
  }

  if (
    nextStatus === AppointmentStatus.NO_SHOW &&
    previousStatus !== AppointmentStatus.NO_SHOW &&
    appointment.clientId
  ) {
    await txRepository.incrementClientNoShow(appointment.tenantId, appointment.clientId);
  }
};

export const updateAppointment = async (
  tenantId: string,
  appointmentId: string,
  payload: UpdateAppointmentInput,
  actor: { userId: string; role: RoleName }
) => {
  const current = await appointmentsRepository.findAppointmentById(tenantId, appointmentId);
  if (!current) {
    throw new HttpError("Agendamento nao encontrado.", 404);
  }

  assertCanAlterAppointment(actor.role, actor.userId, current.barberId);
  if (payload.status === AppointmentStatus.CANCELADO) {
    assertCanCancelAppointment(actor.role, actor.userId, current.barberId);
  }

  const targetDate = normalizeDate(payload.date ?? current.date);
  const targetBarberId = payload.barberId ?? current.barberId;
  const targetStartTime = payload.startTime ?? toTimeString(current.startTime);
  let targetEndTime = payload.endTime ?? toTimeString(current.endTime);
  const targetStatus = payload.status ?? current.status;
  const hasServiceChanges = payload.serviceIds !== undefined || payload.serviceId !== undefined;
  const serviceIds = hasServiceChanges
    ? resolveServiceSelection({
        serviceId: payload.serviceId ?? undefined,
        serviceIds: payload.serviceIds
      })
    : current.appointmentServices.map((item) => item.serviceId);
  const targetClientId =
    payload.clientId === undefined ? current.clientId ?? undefined : payload.clientId ?? undefined;

  await validateBarberAndClient(appointmentsRepository, tenantId, {
    barberId: targetBarberId,
    clientId: targetClientId
  });

  const servicesInfo = await resolveDurationAndPrice(appointmentsRepository, tenantId, serviceIds);

  if (targetStatus !== AppointmentStatus.BLOQUEADO && !targetClientId) {
    throw new HttpError("Agendamento comum exige cliente.", 422);
  }

  if (targetStatus !== AppointmentStatus.BLOQUEADO && !serviceIds.length) {
    throw new HttpError("Agendamento comum exige servico.", 422);
  }

  if (!payload.endTime && servicesInfo.totalDuration > 0 && (payload.startTime || hasServiceChanges)) {
    targetEndTime = formatMinutesToTime(parseTimeToMinutes(targetStartTime) + servicesInfo.totalDuration);
  }

  ensureValidTimeRange(targetStartTime, targetEndTime);
  if (payload.date || payload.startTime || payload.barberId || hasServiceChanges) {
    ensureNotPast(targetDate.toISOString().slice(0, 10), targetStartTime);
  }

  if (
    servicesInfo.totalDuration > 0 &&
    calculateDuration(targetStartTime, targetEndTime) !== servicesInfo.totalDuration
  ) {
    throw new HttpError("Horario final nao respeita a duracao total dos servicos.", 422);
  }

  await ensureNoBarberConflict(appointmentsRepository, tenantId, {
    barberId: targetBarberId,
    date: targetDate,
    startTime: targetStartTime,
    endTime: targetEndTime,
    excludeAppointmentId: appointmentId
  });

  const updated = await prisma.$transaction(async (tx) => {
    const repository = appointmentsRepository.withClient(tx);
    const appointment = await repository.updateAppointment(tenantId, appointmentId, {
      clientId: payload.clientId === undefined ? undefined : payload.clientId ?? undefined,
      barberId: payload.barberId,
      serviceId:
        hasServiceChanges
          ? servicesInfo.primaryServiceId
          : undefined,
      date: payload.date ? targetDate : undefined,
      startTime: payload.startTime ? timeStringToDate(targetStartTime) : undefined,
      endTime:
        payload.endTime || payload.startTime
          ? timeStringToDate(targetEndTime)
          : undefined,
      status: payload.status,
      price: payload.price ?? (hasServiceChanges ? servicesInfo.totalPrice : undefined),
      notes: payload.notes,
      reminderSent: payload.reminderSent,
      serviceRows: hasServiceChanges ? servicesInfo.rows : undefined
    });

    await applySideEffectsOnStatusChange(repository, current.status, appointment.status, appointment);
    return appointment;
  });

  if (current.status !== AppointmentStatus.CANCELADO && updated.status === AppointmentStatus.CANCELADO) {
    fireNotification(
      notifyAppointmentCanceled({
        tenantId,
        clientName: updated.client?.name,
        timeLabel: toTimeString(updated.startTime)
      })
    );
    fireNotification(queueAppointmentCancellationAutomation(tenantId, updated.id));
  }

  if (current.status !== AppointmentStatus.FINALIZADO && updated.status === AppointmentStatus.FINALIZADO) {
    fireNotification(queueAppointmentUpsellAutomation(tenantId, updated.id));
  }

  return toAppointmentDTO(appointmentsRepository, tenantId, updated);
};

export const deleteAppointment = async (
  tenantId: string,
  appointmentId: string,
  actor: { userId: string; role: RoleName }
) => {
  const current = await appointmentsRepository.findAppointmentById(tenantId, appointmentId);
  if (!current) {
    throw new HttpError("Agendamento nao encontrado.", 404);
  }

  assertCanCancelAppointment(actor.role, actor.userId, current.barberId);

  const cancelled = await appointmentsRepository.updateAppointment(tenantId, appointmentId, {
    status: AppointmentStatus.CANCELADO
  });

  fireNotification(
    notifyAppointmentCanceled({
      tenantId,
      clientName: cancelled.client?.name,
      timeLabel: toTimeString(cancelled.startTime)
    })
  );
  fireNotification(queueAppointmentCancellationAutomation(tenantId, cancelled.id));

  return toAppointmentDTO(appointmentsRepository, tenantId, cancelled);
};

export const updateAppointmentStatus = async (
  tenantId: string,
  appointmentId: string,
  payload: UpdateAppointmentStatusInput,
  actor: { userId: string; role: RoleName }
) => {
  const current = await appointmentsRepository.findAppointmentById(tenantId, appointmentId);
  if (!current) {
    throw new HttpError("Agendamento nao encontrado.", 404);
  }

  assertCanAlterAppointment(actor.role, actor.userId, current.barberId);
  if (payload.status === AppointmentStatus.CANCELADO) {
    assertCanCancelAppointment(actor.role, actor.userId, current.barberId);
  }

  const updated = await prisma.$transaction(async (tx) => {
    const repository = appointmentsRepository.withClient(tx);
    const appointment = await repository.updateAppointment(tenantId, appointmentId, {
      status: payload.status,
      notes: payload.notes ?? current.notes ?? undefined
    });

    await applySideEffectsOnStatusChange(repository, current.status, payload.status, appointment);
    return appointment;
  });

  if (current.status !== AppointmentStatus.CANCELADO && payload.status === AppointmentStatus.CANCELADO) {
    fireNotification(
      notifyAppointmentCanceled({
        tenantId,
        clientName: updated.client?.name,
        timeLabel: toTimeString(updated.startTime)
      })
    );
    fireNotification(queueAppointmentCancellationAutomation(tenantId, updated.id));
  }

  if (current.status !== AppointmentStatus.FINALIZADO && payload.status === AppointmentStatus.FINALIZADO) {
    fireNotification(queueAppointmentUpsellAutomation(tenantId, updated.id));
  }

  return toAppointmentDTO(appointmentsRepository, tenantId, updated);
};

export const getAvailableSlots = async (tenantId: string, query: AvailableSlotsInput) => {
  const date = normalizeDate(query.date);
  const serviceIds = resolveServiceSelection({
    serviceId: query.serviceId,
    serviceIds: query.serviceIds
  });
  const servicesInfo = await resolveDurationAndPrice(appointmentsRepository, tenantId, serviceIds);
  const duration = servicesInfo.totalDuration || 30;

  const busySlots = await appointmentsRepository.findBusyBarberSlots(tenantId, query.barberId, date);
  const existing = busySlots.map((slot) => ({
    startMin: parseTimeToMinutes(toTimeString(slot.startTime)),
    endMin: parseTimeToMinutes(toTimeString(slot.endTime))
  }));

  const slots: Array<{ startTime: string; endTime: string; available: boolean }> = [];
  const dateValue = date.toISOString().slice(0, 10);

  for (
    let cursor = DEFAULT_OPEN_MIN;
    cursor + duration <= DEFAULT_CLOSE_MIN;
    cursor += query.intervalMin
  ) {
    const candidate = {
      startMin: cursor,
      endMin: cursor + duration
    };
    const startTime = formatMinutesToTime(candidate.startMin);
    const endTime = formatMinutesToTime(candidate.endMin);
    const inPast = new Date(`${dateValue}T${startTime}:00`).getTime() < Date.now();
    const available = !inPast && !hasTimeConflict(candidate, existing);
    slots.push({ startTime, endTime, available });
  }

  return {
    barberId: query.barberId,
    date: dateValue,
    slots
  };
};

export const getDayOccupancy = async (tenantId: string, query: OccupancyInput) => {
  const date = normalizeDate(query.date ?? new Date());
  const appointments = await appointmentsRepository.listAppointmentsByDate(tenantId, date);
  const activeBarbers = await appointmentsRepository.countActiveBarbers(tenantId);

  const productiveStatuses = new Set<AppointmentStatus>([
    AppointmentStatus.AGENDADO,
    AppointmentStatus.CONFIRMADO,
    AppointmentStatus.EM_ATENDIMENTO,
    AppointmentStatus.FINALIZADO,
    AppointmentStatus.BLOQUEADO
  ]);

  const totalBookedMinutes = appointments
    .filter((appointment) => productiveStatuses.has(appointment.status))
    .reduce((total, appointment) => {
      return (
        total +
        (parseTimeToMinutes(toTimeString(appointment.endTime)) -
          parseTimeToMinutes(toTimeString(appointment.startTime)))
      );
    }, 0);

  const capacityPerBarber = DEFAULT_CLOSE_MIN - DEFAULT_OPEN_MIN;
  const totalCapacity = Math.max(activeBarbers, 1) * capacityPerBarber;
  const occupancyPercent = Number(((totalBookedMinutes / totalCapacity) * 100).toFixed(2));

  return {
    date: date.toISOString().slice(0, 10),
    activeBarbers,
    totalBookedMinutes,
    totalCapacity,
    occupancyPercent: Math.min(100, occupancyPercent)
  };
};

export const getUpcomingAppointments = async (tenantId: string, query: UpcomingInput) => {
  const today = normalizeDate(new Date());
  const [raw, total] = await appointmentsRepository.listUpcomingAppointments(
    tenantId,
    today,
    query.page,
    query.pageSize
  );

  const now = Date.now();
  const filtered = raw
    .filter((appointment) => {
      const start = new Date(`${appointment.date.toISOString().slice(0, 10)}T${toTimeString(appointment.startTime)}:00`);
      return start.getTime() >= now;
    })
    .slice(0, query.pageSize);

  const items = await Promise.all(
    filtered.map((appointment) => toAppointmentDTO(appointmentsRepository, tenantId, appointment))
  );

  return {
    items,
    meta: {
      page: query.page,
      pageSize: query.pageSize,
      total
    }
  };
};

export const getNoShowStats = async (tenantId: string, query: NoShowStatsInput) => {
  const now = new Date();
  const from = normalizeDate(query.from ?? new Date(now.getFullYear(), now.getMonth(), 1));
  const to = normalizeDate(query.to ?? now);

  const grouped = await appointmentsRepository.listNoShowGrouped(tenantId, from, to);
  const clientIds = grouped
    .map((item) => item.clientId)
    .filter((clientId): clientId is string => Boolean(clientId));
  const clients = clientIds.length
    ? await appointmentsRepository.listClientsByIds(tenantId, clientIds)
    : [];

  const totalNoShow = grouped.reduce((sum, item) => sum + item._count._all, 0);
  const topClients = grouped
    .filter((item) => item.clientId)
    .map((item) => {
      const client = clients.find((value) => value.id === item.clientId);
      return {
        clientId: item.clientId!,
        clientName: client?.name ?? "Cliente removido",
        noShows: item._count._all,
        vipBadge: client?.vipBadge ?? false,
        highRisk: (client?.noShowCount ?? 0) >= 2
      };
    });

  return {
    period: {
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10)
    },
    totalNoShow,
    topClients
  };
};

export const listBarberOptions = async (tenantId: string) => {
  return appointmentsRepository.listBarbers(tenantId);
};
