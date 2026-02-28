import { RoleName } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string;
        tenantId: string;
        role: RoleName;
      };
      hierarchy?: {
        tenantId: string;
        unitId: string;
        franchiseId: string | null;
        role: RoleName;
        normalizedRole: RoleName;
      };
    }
  }
}

export {};
