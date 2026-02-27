import { RoleName } from "@prisma/client";
import { HttpError } from "../../utils/http-error";

export type SlotRange = {
  startMin: number;
  endMin: number;
  id?: string;
};

export const parseTimeToMinutes = (value: string): number => {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
};

export const formatMinutesToTime = (minutes: number): string => {
  const safe = Math.max(0, Math.min(minutes, 23 * 60 + 59));
  const hours = Math.floor(safe / 60)
    .toString()
    .padStart(2, "0");
  const mins = (safe % 60).toString().padStart(2, "0");
  return `${hours}:${mins}`;
};

export const calculateDuration = (startTime: string, endTime: string): number =>
  parseTimeToMinutes(endTime) - parseTimeToMinutes(startTime);

export const hasTimeConflict = (candidate: SlotRange, existing: SlotRange[]): boolean =>
  existing.some((current) => candidate.startMin < current.endMin && candidate.endMin > current.startMin);

export const ensureNotPast = (date: string, startTime: string): void => {
  const scheduleDateTime = new Date(`${date}T${startTime}:00`);
  if (scheduleDateTime.getTime() < Date.now()) {
    throw new HttpError("Nao e permitido agendar no passado.", 422);
  }
};

export const ensureValidTimeRange = (startTime: string, endTime: string): void => {
  if (parseTimeToMinutes(endTime) <= parseTimeToMinutes(startTime)) {
    throw new HttpError("Horario final deve ser maior que o inicial.", 422);
  }
};

export const assertCanAlterAppointment = (
  role: RoleName,
  actorUserId: string,
  barberId: string
): void => {
  if (role === RoleName.BARBER && actorUserId !== barberId) {
    throw new HttpError("BARBER so pode alterar os proprios agendamentos.", 403);
  }
};

export const assertCanCancelAppointment = (
  role: RoleName,
  actorUserId: string,
  barberId: string
): void => {
  if (role === RoleName.OWNER || role === RoleName.ADMIN) {
    return;
  }

  if (role === RoleName.BARBER && actorUserId === barberId) {
    return;
  }

  throw new HttpError("Sem permissao para cancelar este agendamento.", 403);
};
