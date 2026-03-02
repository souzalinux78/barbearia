import jwt from "jsonwebtoken";
import { RoleName } from "@prisma/client";
import { env } from "../config/env";

export type MasterJwtPayload = {
  adminId: string;
  email: string;
  role: "SUPER_ADMIN";
};

const resolveSecret = () => env.MASTER_JWT_SECRET || env.JWT_ACCESS_SECRET;

export const generateMasterAccessToken = (payload: MasterJwtPayload): string =>
  jwt.sign(payload, resolveSecret(), {
    expiresIn: env.MASTER_JWT_EXPIRES_IN
  } as jwt.SignOptions);

export const verifyMasterAccessToken = (token: string): MasterJwtPayload =>
  jwt.verify(token, resolveSecret()) as MasterJwtPayload;
