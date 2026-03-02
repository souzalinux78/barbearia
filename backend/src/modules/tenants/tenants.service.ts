import { prisma } from "../../config/prisma";
import { HttpError } from "../../utils/http-error";
import { normalizePixKey } from "../../utils/pix";
import { UpdateTenantSettingsInput } from "./tenants.schemas";

export const getCurrentTenant = async (tenantId: string) => {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: {
      unit: {
        include: {
          franchise: true
        }
      },
      subscription: {
        include: {
          plan: true,
          pendingPlan: true
        }
      }
    }
  });

  if (!tenant) {
    throw new HttpError("Tenant nao encontrado.", 404);
  }

  return tenant;
};

export const updateTenantSettings = async (tenantId: string, payload: UpdateTenantSettingsInput) => {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true }
  });

  if (!tenant) {
    throw new HttpError("Tenant nao encontrado.", 404);
  }

  const normalizeText = (value?: string) => {
    if (value === undefined) {
      return undefined;
    }
    const clean = value.trim();
    return clean.length > 0 ? clean : null;
  };

  const uniqueDays = payload.bookingWorkingDays
    ? Array.from(new Set(payload.bookingWorkingDays)).sort((a, b) => a - b)
    : undefined;

  return prisma.tenant.update({
    where: { id: tenantId },
    data: {
      name: payload.name?.trim(),
      email: normalizeText(payload.email),
      phone: normalizeText(payload.phone),
      logoUrl: normalizeText(payload.logoUrl),
      servicePixKey:
        payload.servicePixKey === undefined
          ? undefined
          : normalizeText(normalizePixKey(payload.servicePixKey)),
      bookingEnabled: payload.bookingEnabled,
      bookingStartTime: payload.bookingStartTime,
      bookingEndTime: payload.bookingEndTime,
      bookingWorkingDays: uniqueDays
    },
    include: {
      unit: {
        include: {
          franchise: true
        }
      },
      subscription: {
        include: {
          plan: true,
          pendingPlan: true
        }
      }
    }
  });
};
