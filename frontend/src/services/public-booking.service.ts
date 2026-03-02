import { api } from "./api";

export type PublicBookingContext = {
  tenant: {
    slug: string;
    name: string;
    logoUrl?: string | null;
    paymentSettings?: {
      pixEnabled: boolean;
    };
    bookingSettings?: {
      startTime: string;
      endTime: string;
      workingDays: number[];
      maxAdvanceDays?: number;
    };
  };
  barbers: Array<{
    id: string;
    name: string;
  }>;
  services: Array<{
    id: string;
    name: string;
    description?: string | null;
    durationMin: number;
    price: number;
  }>;
};

export type PublicBookingSlots = {
  barberId: string;
  date: string;
  slots: Array<{
    startTime: string;
    endTime: string;
    available: boolean;
  }>;
};

export type PublicBookingCreatePayload = {
  clientName: string;
  clientPhone: string;
  clientEmail?: string;
  paymentMethod: "PIX" | "CARD";
  barberId: string;
  serviceIds: string[];
  date: string;
  startTime: string;
  notes?: string;
};

export type PublicBookingCreateResponse = {
  tenant: {
    slug: string;
    name: string;
  };
  client: {
    id: string;
    name: string;
    phone?: string | null;
    email?: string | null;
  };
  appointment: {
    id: string;
    date: string;
    startTime: string;
    endTime: string;
    status: string;
  };
  payment?: {
    method: "PIX" | "CARD";
    status: "PENDING";
    amount: number;
    qrCode?: string;
    copyPasteCode?: string;
    beneficiary?: string;
    keyMasked?: string;
    instructions?: string;
  } | null;
};

export const getPublicBookingContext = async (tenantSlug: string) => {
  const { data } = await api.get<PublicBookingContext>(`/public/booking/${tenantSlug}/context`);
  return data;
};

export const getPublicBookingSlots = async (
  tenantSlug: string,
  input: {
    date: string;
    barberId: string;
    serviceIds: string[];
  }
) => {
  const { data } = await api.get<PublicBookingSlots>(
    `/public/booking/${tenantSlug}/available-slots`,
    {
      params: {
        date: input.date,
        barberId: input.barberId,
        serviceIds: input.serviceIds.join(",")
      }
    }
  );
  return data;
};

export const createPublicBookingAppointment = async (
  tenantSlug: string,
  payload: PublicBookingCreatePayload
) => {
  const { data } = await api.post<PublicBookingCreateResponse>(
    `/public/booking/${tenantSlug}/appointments`,
    payload
  );
  return data;
};
