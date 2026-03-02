import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { env } from "../../config/env";
import { prisma } from "../../config/prisma";
import { MarketingEventInput } from "./marketing.schemas";

const sanitizeText = (value: string | undefined, maxLength: number): string | null => {
  if (!value) {
    return null;
  }
  const sanitized = value.trim().slice(0, maxLength);
  return sanitized.length ? sanitized : null;
};

const sanitizeMetadata = (input: MarketingEventInput["metadata"]): Prisma.InputJsonValue | undefined => {
  if (!input) {
    return undefined;
  }

  const entries = Object.entries(input).slice(0, 40);
  const sanitized = entries.reduce<Record<string, string | number | boolean | null>>(
    (acc, [key, value]) => {
      const normalizedKey = key.trim().slice(0, 60);
      if (!normalizedKey) {
        return acc;
      }
      if (typeof value === "string") {
        acc[normalizedKey] = value.slice(0, 400);
        return acc;
      }
      acc[normalizedKey] = value;
      return acc;
    },
    {}
  );

  return sanitized;
};

const hashIp = (ipAddress: string | undefined): string | null => {
  if (!ipAddress) {
    return null;
  }
  return crypto
    .createHash("sha256")
    .update(`${env.MARKETING_EVENT_SALT}:${ipAddress}`)
    .digest("hex");
};

export const ingestMarketingEvent = async (
  input: MarketingEventInput,
  ipAddress?: string
) => {
  const tenantExists = input.tenantId
    ? await prisma.tenant.findUnique({
        where: { id: input.tenantId },
        select: { id: true }
      })
    : null;

  await prisma.marketingEvent.create({
    data: {
      tenantId: tenantExists?.id ?? null,
      eventName: input.eventName,
      eventPath: input.eventPath,
      sessionId: input.sessionId,
      source: sanitizeText(input.source, 80),
      referrer: sanitizeText(input.referrer, 500),
      userAgent: sanitizeText(input.userAgent, 400),
      ipHash: hashIp(ipAddress),
      metadata: sanitizeMetadata(input.metadata)
    }
  });

  return { accepted: true as const };
};

