import { prisma } from "../../config/prisma";
import { HttpError } from "../../utils/http-error";

export const getCurrentTenant = async (tenantId: string) => {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: {
      subscription: true
    }
  });

  if (!tenant) {
    throw new HttpError("Tenant nao encontrado.", 404);
  }

  return tenant;
};
