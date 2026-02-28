import crypto from "node:crypto";
import {
  AppointmentStatus,
  AutomationRuleType,
  Prisma,
  RoleName,
  WhatsAppDirection,
  WhatsAppMessageStatus,
  WhatsAppProvider
} from "@prisma/client";
import { prisma } from "../../config/prisma";
import { HttpError } from "../../utils/http-error";
import {
  detectConfirmationDecision,
  inferAiIntent
} from "../automation/automation.calculations";
import {
  SendWhatsAppInput,
  TestWhatsAppInput,
  UpsertWhatsAppConfigInput,
  webhookPayloadSchema,
  WhatsAppWebhookInput
} from "./whatsapp.schemas";

type OutboundQueueJob = {
  messageId: string;
  executeAt: number;
};

const QUEUE_TICK_MS = 1_500;
const CONFIRMATION_LOOKBACK_MS = 72 * 60 * 60 * 1000;

const outboundQueue: OutboundQueueJob[] = [];
let queueTimer: NodeJS.Timeout | null = null;

const normalizePhone = (value: string) => value.replace(/\D/g, "");

const normalizeSignature = (value: string) =>
  value.startsWith("sha256=") ? value.slice("sha256=".length) : value;

const verifyWebhookSignature = (rawBody: Buffer, signature: string, secret: string) => {
  const digest = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const received = normalizeSignature(signature);
  const digestBytes = Buffer.from(digest, "utf-8");
  const receivedBytes = Buffer.from(received, "utf-8");
  if (digestBytes.length !== receivedBytes.length) {
    return false;
  }
  return crypto.timingSafeEqual(digestBytes, receivedBytes);
};

const mapDeliveryStatus = (status?: string): WhatsAppMessageStatus => {
  switch ((status ?? "").toLowerCase()) {
    case "queued":
      return WhatsAppMessageStatus.QUEUED;
    case "sent":
      return WhatsAppMessageStatus.SENT;
    case "delivered":
      return WhatsAppMessageStatus.DELIVERED;
    case "received":
      return WhatsAppMessageStatus.RECEIVED;
    default:
      return WhatsAppMessageStatus.FAILED;
  }
};

const toApiUrls = (baseUrl: string, provider: WhatsAppProvider) => {
  const trimmed = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;

  if (provider === WhatsAppProvider.EVOLUTION) {
    if (trimmed.includes("/message/sendText") || trimmed.includes("/chat/sendMessage")) {
      return [trimmed];
    }
    return [`${trimmed}/message/sendText`, `${trimmed}/chat/sendMessage`];
  }

  return [`${trimmed}/messages`];
};

const dispatchToProvider = async (input: {
  provider: WhatsAppProvider;
  apiUrl: string;
  apiKey: string;
  from: string;
  to: string;
  message: string;
  metadata?: Prisma.InputJsonValue;
}) => {
  const endpoints = toApiUrls(input.apiUrl, input.provider);
  const errors: string[] = [];

  for (const endpoint of endpoints) {
    const body =
      input.provider === WhatsAppProvider.EVOLUTION
        ? endpoint.includes("/chat/sendMessage")
          ? {
              number: input.to,
              textMessage: {
                text: input.message
              },
              metadata: input.metadata
            }
          : {
              number: input.to,
              text: input.message,
              metadata: input.metadata
            }
        : {
            from: input.from,
            to: input.to,
            message: input.message,
            metadata: input.metadata
          };

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${input.apiKey}`,
          apikey: input.apiKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const responseBody = await response.text().catch(() => "");
        errors.push(`Endpoint ${endpoint} retornou ${response.status}: ${responseBody.slice(0, 280)}`);
        continue;
      }

      return response.json().catch(() => null);
    } catch (error) {
      errors.push(
        `Endpoint ${endpoint} falhou: ${error instanceof Error ? error.message : "erro desconhecido"}`
      );
    }
  }

  throw new Error(
    (() => {
      const combined = errors.join(" | ");
      const missingRoute =
        combined.includes("Cannot POST /message/sendText") ||
        combined.includes("Cannot POST /chat/sendMessage");

      if (missingRoute) {
        return `${combined} | Dica: para Evolution API informe API URL com instancia, por exemplo: https://host/api/message/sendText/souza ou https://host/message/sendText/souza`;
      }

      return errors.length
        ? combined
        : "Falha no envio WhatsApp. Verifique URL, API key e provider.";
    })()
  );
};

const enqueueJob = (messageId: string, delayMinutes: number) => {
  outboundQueue.push({
    messageId,
    executeAt: Date.now() + delayMinutes * 60 * 1000
  });
  outboundQueue.sort((a, b) => a.executeAt - b.executeAt);
};

const processQueue = async () => {
  if (!outboundQueue.length) {
    return;
  }

  const now = Date.now();
  const dueJobs = outboundQueue.filter((job) => job.executeAt <= now).slice(0, 20);
  if (!dueJobs.length) {
    return;
  }

  const dueIds = new Set(dueJobs.map((job) => job.messageId));
  for (let i = outboundQueue.length - 1; i >= 0; i -= 1) {
    if (dueIds.has(outboundQueue[i].messageId)) {
      outboundQueue.splice(i, 1);
    }
  }

  for (const job of dueJobs) {
    const message = await prisma.whatsAppMessage.findUnique({
      where: { id: job.messageId },
      include: {
        client: {
          select: {
            id: true,
            phone: true
          }
        },
        tenant: {
          select: {
            whatsAppConfig: true
          }
        }
      }
    });

    if (!message || message.direction !== WhatsAppDirection.OUTBOUND) {
      continue;
    }
    if (message.status !== WhatsAppMessageStatus.QUEUED) {
      continue;
    }

    const config = message.tenant.whatsAppConfig;
    if (!config?.active) {
      await prisma.whatsAppMessage.update({
        where: { id: message.id },
        data: {
          status: WhatsAppMessageStatus.FAILED,
          metadata: {
            ...(message.metadata as Record<string, unknown> | null),
            error: "WHATSAPP_CONFIG_INACTIVE"
          }
        }
      });
      continue;
    }

    const targetPhone = message.client.phone ? normalizePhone(message.client.phone) : "";
    if (!targetPhone) {
      await prisma.whatsAppMessage.update({
        where: { id: message.id },
        data: {
          status: WhatsAppMessageStatus.FAILED,
          metadata: {
            ...(message.metadata as Record<string, unknown> | null),
            error: "CLIENT_WITHOUT_PHONE"
          }
        }
      });
      continue;
    }

    try {
      const providerResponse = await dispatchToProvider({
        provider: config.provider,
        apiUrl: config.apiUrl,
        apiKey: config.apiKey,
        from: normalizePhone(config.phoneNumber),
        to: targetPhone,
        message: message.message,
        metadata: message.metadata ?? undefined
      });

      await prisma.whatsAppMessage.update({
        where: { id: message.id },
        data: {
          status: WhatsAppMessageStatus.SENT,
          metadata: {
            ...(message.metadata as Record<string, unknown> | null),
            providerResponse
          }
        }
      });
    } catch (error) {
      await prisma.whatsAppMessage.update({
        where: { id: message.id },
        data: {
          status: WhatsAppMessageStatus.FAILED,
          metadata: {
            ...(message.metadata as Record<string, unknown> | null),
            error: error instanceof Error ? error.message : "FAILED_TO_SEND"
          }
        }
      });
    }
  }
};

const resolveClientByPhone = async (tenantId: string, phone: string) => {
  const normalized = normalizePhone(phone);
  return prisma.client.findFirst({
    where: {
      tenantId,
      OR: [
        { phone: phone },
        { phone: normalized },
        { phone: `+${normalized}` }
      ]
    }
  });
};

const getTenantConfig = async (tenantId: string) =>
  prisma.whatsAppConfig.findUnique({
    where: { tenantId }
  });

const queueInternal = async (input: {
  tenantId: string;
  clientId: string;
  message: string;
  appointmentId?: string;
  automationType?: AutomationRuleType;
  metadata?: Prisma.InputJsonValue;
  delayMinutes?: number;
}) => {
  const client = await prisma.client.findFirst({
    where: {
      tenantId: input.tenantId,
      id: input.clientId
    },
    select: {
      id: true,
      phone: true
    }
  });

  if (!client) {
    throw new HttpError("Cliente nao encontrado para este tenant.", 404);
  }
  if (!client.phone) {
    throw new HttpError("Cliente sem telefone para envio WhatsApp.", 422);
  }

  const row = await prisma.whatsAppMessage.create({
    data: {
      tenantId: input.tenantId,
      clientId: client.id,
      appointmentId: input.appointmentId,
      direction: WhatsAppDirection.OUTBOUND,
      message: input.message,
      status: WhatsAppMessageStatus.QUEUED,
      automationType: input.automationType,
      metadata: input.metadata
    }
  });

  enqueueJob(row.id, input.delayMinutes ?? 0);
  return row;
};

const applyConfirmationDecision = async (
  tenantId: string,
  clientId: string,
  decision: "CONFIRM" | "CANCEL"
) => {
  const confirmationMessage = await prisma.whatsAppMessage.findFirst({
    where: {
      tenantId,
      clientId,
      direction: WhatsAppDirection.OUTBOUND,
      automationType: AutomationRuleType.CONFIRMATION,
      appointmentId: {
        not: null
      },
      createdAt: {
        gte: new Date(Date.now() - CONFIRMATION_LOOKBACK_MS)
      }
    },
    orderBy: {
      createdAt: "desc"
    }
  });

  if (!confirmationMessage?.appointmentId) {
    return {
      updated: false,
      reply: "Nao localizamos um agendamento pendente para confirmacao."
    };
  }

  if (decision === "CONFIRM") {
    const updated = await prisma.appointment.updateMany({
      where: {
        id: confirmationMessage.appointmentId,
        tenantId,
        status: {
          in: [AppointmentStatus.AGENDADO]
        }
      },
      data: {
        status: AppointmentStatus.CONFIRMADO
      }
    });

    return {
      updated: updated.count > 0,
      appointmentId: confirmationMessage.appointmentId,
      reply:
        updated.count > 0
          ? "Agendamento confirmado com sucesso. Obrigado!"
          : "Seu agendamento ja estava confirmado."
    };
  }

  const updated = await prisma.appointment.updateMany({
    where: {
      id: confirmationMessage.appointmentId,
      tenantId,
      status: {
        in: [AppointmentStatus.AGENDADO, AppointmentStatus.CONFIRMADO]
      }
    },
    data: {
      status: AppointmentStatus.CANCELADO
    }
  });

  return {
    updated: updated.count > 0,
    appointmentId: confirmationMessage.appointmentId,
    reply:
      updated.count > 0
        ? "Agendamento cancelado. Se quiser remarcar, responda esta mensagem."
        : "Este agendamento ja estava cancelado."
  };
};

export const processAIMessage = async (tenantId: string, clientId: string, message: string) => {
  const intent = inferAiIntent(message);
  const now = new Date();

  const [services, conversation] = await Promise.all([
    prisma.service.findMany({
      where: {
        tenantId,
        active: true
      },
      select: {
        name: true,
        price: true
      },
      orderBy: {
        price: "asc"
      },
      take: 4
    }),
    prisma.aIConversation.findUnique({
      where: {
        tenantId_clientId: {
          tenantId,
          clientId
        }
      }
    })
  ]);

  const serviceList = services
    .map((service: { name: string; price: Prisma.Decimal }) => `${service.name} (R$ ${Number(service.price).toFixed(2)})`)
    .join(", ");

  let reply = "Posso ajudar com horario, servicos, preco ou agendamento. Como posso te atender?";
  if (intent === "HOURS") {
    reply = "Nosso horario padrao e de segunda a sabado, das 08:00 as 20:00.";
  } else if (intent === "PRICING") {
    reply = serviceList
      ? `Tabela base: ${serviceList}. Quer que eu te recomende um servico?`
      : "Posso consultar os precos para voce. Qual servico voce procura?";
  } else if (intent === "SERVICES") {
    reply = serviceList
      ? `Servicos mais buscados: ${serviceList}.`
      : "Temos corte, barba e tratamentos capilares. Deseja sugestao personalizada?";
  } else if (intent === "BOOKING") {
    reply =
      "Perfeito! Me diga o dia e horario desejados (ex: amanha 14:30) para eu encaminhar seu agendamento.";
  }

  const previousContext =
    (conversation?.context as Record<string, unknown> | null) ?? {};
  const interactions = Number(previousContext.interactions ?? 0) + 1;

  await prisma.aIConversation.upsert({
    where: {
      tenantId_clientId: {
        tenantId,
        clientId
      }
    },
    create: {
      tenantId,
      clientId,
      context: {
        lastIntent: intent,
        lastMessage: message,
        interactions
      },
      lastMessageAt: now
    },
    update: {
      context: {
        ...previousContext,
        lastIntent: intent,
        lastMessage: message,
        interactions
      },
      lastMessageAt: now
    }
  });

  return {
    intent,
    reply
  };
};

export const upsertWhatsAppConfig = async (tenantId: string, payload: UpsertWhatsAppConfigInput) =>
  prisma.whatsAppConfig.upsert({
    where: {
      tenantId
    },
    create: {
      tenantId,
      provider: payload.provider,
      apiUrl: payload.apiUrl,
      apiKey: payload.apiKey,
      phoneNumber: payload.phoneNumber,
      active: payload.active
    },
    update: {
      provider: payload.provider,
      apiUrl: payload.apiUrl,
      apiKey: payload.apiKey,
      phoneNumber: payload.phoneNumber,
      active: payload.active
    }
  });

export const getWhatsAppStatus = async (tenantId: string) => {
  const [config, recent] = await Promise.all([
    getTenantConfig(tenantId),
    prisma.whatsAppMessage.groupBy({
      by: ["status"],
      where: {
        tenantId,
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
        }
      },
      _count: {
        _all: true
      }
    })
  ]);

  return {
    connected: Boolean(config?.active),
    config: config
      ? {
          provider: config.provider,
          apiUrl: config.apiUrl,
          phoneNumber: config.phoneNumber,
          active: config.active,
          createdAt: config.createdAt,
          updatedAt: config.updatedAt
        }
      : null,
    queueSize: outboundQueue.length,
    messagesLast24h: recent.reduce<Record<string, number>>((acc, row) => {
      acc[row.status] = row._count._all;
      return acc;
    }, {})
  };
};

export const queueOutgoingWhatsAppMessage = async (input: {
  tenantId: string;
  clientId: string;
  message: string;
  appointmentId?: string;
  automationType?: AutomationRuleType;
  metadata?: Prisma.InputJsonValue;
  delayMinutes?: number;
}) => {
  const config = await getTenantConfig(input.tenantId);
  if (!config?.active) {
    return {
      queued: false,
      reason: "WHATSAPP_CONFIG_INACTIVE"
    };
  }

  const row = await queueInternal(input);
  return {
    queued: true,
    id: row.id,
    status: row.status
  };
};

export const sendWhatsAppMessage = async (tenantId: string, payload: SendWhatsAppInput) =>
  queueOutgoingWhatsAppMessage({
    tenantId,
    clientId: payload.clientId,
    message: payload.message,
    appointmentId: payload.appointmentId,
    automationType: payload.automationType,
    delayMinutes: payload.delayMinutes
  });

export const sendWhatsAppTest = async (tenantId: string, payload: TestWhatsAppInput) => {
  const config = await getTenantConfig(tenantId);
  if (!config?.active) {
    throw new HttpError("WhatsApp nao configurado ou inativo para este tenant.", 422);
  }

  if (payload.clientId) {
    return queueOutgoingWhatsAppMessage({
      tenantId,
      clientId: payload.clientId,
      message: payload.message
    });
  }

  if (!payload.phoneNumber) {
    throw new HttpError("Informe clientId ou phoneNumber para teste.", 422);
  }

  const normalizedPhone = normalizePhone(payload.phoneNumber);
  if (!normalizedPhone || normalizedPhone.length < 10) {
    throw new HttpError("Telefone de teste invalido. Informe DDI+DDD+numero.", 422);
  }

  let response: unknown = null;
  try {
    response = await dispatchToProvider({
      provider: config.provider,
      apiUrl: config.apiUrl,
      apiKey: config.apiKey,
      from: normalizePhone(config.phoneNumber),
      to: normalizedPhone,
      message: payload.message
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "falha desconhecida";
    throw new HttpError(`Falha ao testar envio no provider: ${detail}`, 502);
  }

  return {
    queued: false,
    sent: true,
    response
  };
};

export const handleWhatsAppWebhook = async (
  rawBody: Buffer,
  signature: string,
  payloadInput: WhatsAppWebhookInput
) => {
  const payload = webhookPayloadSchema.parse(payloadInput);

  const config =
    payload.tenantId
      ? await prisma.whatsAppConfig.findUnique({
          where: {
            tenantId: payload.tenantId
          }
        })
      : await prisma.whatsAppConfig.findFirst({
          where: {
            phoneNumber: payload.to ?? payload.phoneNumber
          }
        });

  if (!config) {
    throw new HttpError("Configuracao WhatsApp nao encontrada para webhook.", 404);
  }

  if (!verifyWebhookSignature(rawBody, signature, config.apiKey)) {
    throw new HttpError("Assinatura do webhook WhatsApp invalida.", 400);
  }

  if (payload.event === "status_update") {
    if (payload.messageId && payload.status) {
      await prisma.whatsAppMessage.updateMany({
        where: {
          id: payload.messageId,
          tenantId: config.tenantId
        },
        data: {
          status: mapDeliveryStatus(payload.status)
        }
      });
    }

    return {
      received: true,
      event: "status_update"
    };
  }

  const inboundPhone = payload.from ?? payload.clientPhone;
  if (!inboundPhone || !payload.message) {
    return {
      received: true,
      ignored: "missing_message_or_phone"
    };
  }

  const client = await resolveClientByPhone(config.tenantId, inboundPhone);
  if (!client) {
    return {
      received: true,
      ignored: "client_not_found"
    };
  }

  const decision = detectConfirmationDecision(payload.message);

  await prisma.whatsAppMessage.create({
    data: {
      tenantId: config.tenantId,
      clientId: client.id,
      direction: WhatsAppDirection.INBOUND,
      message: payload.message,
      status: WhatsAppMessageStatus.RECEIVED,
      automationType: decision ? AutomationRuleType.CONFIRMATION : null,
      metadata: payload.metadata ?? undefined
    }
  });

  if (decision) {
    const result = await applyConfirmationDecision(config.tenantId, client.id, decision);
    await queueInternal({
      tenantId: config.tenantId,
      clientId: client.id,
      message: result.reply,
      appointmentId: result.appointmentId,
      automationType: AutomationRuleType.CONFIRMATION,
      metadata: {
        source: "AUTO_CONFIRMATION_REPLY",
        decision
      }
    });

    return {
      received: true,
      action: decision,
      appointmentUpdated: result.updated
    };
  }

  const aiResult = await processAIMessage(config.tenantId, client.id, payload.message);
  await queueInternal({
    tenantId: config.tenantId,
    clientId: client.id,
    message: aiResult.reply,
    metadata: {
      source: "AI",
      intent: aiResult.intent
    }
  });

  return {
    received: true,
    action: "AI_REPLY",
    intent: aiResult.intent
  };
};

export const canManageWhatsApp = (role: RoleName) =>
  role === RoleName.OWNER ||
  role === RoleName.ADMIN ||
  role === RoleName.UNIT_OWNER ||
  role === RoleName.UNIT_ADMIN ||
  role === RoleName.RECEPTION ||
  role === RoleName.FRANCHISE_OWNER ||
  role === RoleName.SUPER_ADMIN;

export const startWhatsAppQueueWorker = () => {
  if (queueTimer) {
    return;
  }
  queueTimer = setInterval(() => {
    processQueue().catch(() => null);
  }, QUEUE_TICK_MS);
};

export const stopWhatsAppQueueWorker = () => {
  if (!queueTimer) {
    return;
  }
  clearInterval(queueTimer);
  queueTimer = null;
};
