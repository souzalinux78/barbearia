import { api } from "./api";

export type AppointmentStatus =
  | "AGENDADO"
  | "CONFIRMADO"
  | "EM_ATENDIMENTO"
  | "FINALIZADO"
  | "CANCELADO"
  | "NO_SHOW"
  | "BLOQUEADO";

export type AppointmentItem = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: AppointmentStatus;
  price: string;
  notes?: string | null;
  recurringClient: boolean;
  vipBadge: boolean;
  noShowAlert: boolean;
  client?: {
    id: string;
    name: string;
  } | null;
  service?: {
    id: string;
    name: string;
  } | null;
  barber: {
    id: string;
    name: string;
  };
  appointmentServices: Array<{
    service: {
      id: string;
      name: string;
    };
  }>;
  latestPayment?: {
    id: string;
    method: "PIX" | "DINHEIRO" | "CARTAO_CREDITO" | "CARTAO_DEBITO" | "TRANSFERENCIA";
    status: "PENDENTE" | "PAGO" | "CANCELADO";
    amount: number;
    paidAt: string | null;
    notes?: string | null;
  } | null;
};

export type AppointmentListResponse = {
  items: AppointmentItem[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
  };
};

export type CreateAppointmentPayload = {
  clientId?: string;
  barberId: string;
  serviceId?: string;
  serviceIds?: string[];
  date: string;
  startTime: string;
  endTime?: string;
  status?: AppointmentStatus;
  notes?: string;
  price?: number;
};

export const getAppointmentsByDay = async (
  date: string,
  page = 1,
  pageSize = 50
): Promise<AppointmentListResponse> => {
  const { data } = await api.get<AppointmentListResponse>("/appointments", {
    params: { date, page, pageSize }
  });
  return data;
};

export const getAppointmentsByWeek = async (
  startDate?: string,
  page = 1,
  pageSize = 200
): Promise<
  AppointmentListResponse & {
    startDate: string;
    endDate: string;
  }
> => {
  const { data } = await api.get("/appointments/week", {
    params: { startDate, page, pageSize }
  });
  return data;
};

export const createAppointmentRequest = async (
  payload: CreateAppointmentPayload
): Promise<AppointmentItem> => {
  const { data } = await api.post<AppointmentItem>("/appointments", payload);
  return data;
};

export const updateAppointmentRequest = async (
  id: string,
  payload: Partial<CreateAppointmentPayload>
): Promise<AppointmentItem> => {
  const { data } = await api.patch<AppointmentItem>(`/appointments/${id}`, payload);
  return data;
};

export const updateAppointmentStatusRequest = async (
  id: string,
  status: AppointmentStatus
): Promise<AppointmentItem> => {
  const { data } = await api.patch<AppointmentItem>(`/appointments/${id}/status`, { status });
  return data;
};

export const deleteAppointmentRequest = async (id: string): Promise<AppointmentItem> => {
  const { data } = await api.delete<AppointmentItem>(`/appointments/${id}`);
  return data;
};

export const getAvailableSlots = async (date: string, barberId: string, serviceIds: string[]) => {
  const { data } = await api.get("/appointments/available-slots", {
    params: {
      date,
      barberId,
      serviceIds: serviceIds.join(",")
    }
  });
  return data as {
    date: string;
    barberId: string;
    slots: Array<{ startTime: string; endTime: string; available: boolean }>;
  };
};

export const getAppointmentBarbers = async (): Promise<Array<{ id: string; name: string }>> => {
  const { data } = await api.get<Array<{ id: string; name: string }>>("/appointments/barbers");
  return data;
};

export const getDayOccupancy = async (date: string) => {
  const { data } = await api.get("/appointments/occupancy", {
    params: { date }
  });
  return data as {
    date: string;
    occupancyPercent: number;
    activeBarbers: number;
    totalBookedMinutes: number;
  };
};

export const getNoShowStats = async () => {
  const { data } = await api.get("/appointments/no-show-stats");
  return data as {
    totalNoShow: number;
    topClients: Array<{
      clientName: string;
      noShows: number;
      vipBadge: boolean;
      highRisk: boolean;
    }>;
  };
};
