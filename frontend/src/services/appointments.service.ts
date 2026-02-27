import { api } from "./api";

export type Appointment = {
  id: string;
  startAt: string;
  endAt: string | null;
  status: string;
  notes?: string;
  client: {
    id: string;
    name: string;
  };
  service: {
    id: string;
    name: string;
  };
  barber: {
    id: string;
    name: string;
  };
};

export const getAppointmentsByDay = async (date?: string): Promise<Appointment[]> => {
  const { data } = await api.get<Appointment[]>("/appointments", {
    params: date ? { date } : undefined
  });
  return data;
};
