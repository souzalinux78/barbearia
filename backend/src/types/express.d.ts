import { RoleName } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string;
        tenantId: string;
        role: RoleName;
      };
    }
  }
}

export {};
