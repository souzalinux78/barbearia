CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  CREATE TYPE "WhatsAppProvider" AS ENUM ('OFFICIAL', 'EVOLUTION');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "AutomationRuleType" AS ENUM ('CONFIRMATION', 'REMINDER', 'REACTIVATION', 'UPSELL', 'BIRTHDAY');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "WhatsAppDirection" AS ENUM ('OUTBOUND', 'INBOUND');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "WhatsAppMessageStatus" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'FAILED', 'RECEIVED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "whatsapp_configs" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "provider" "WhatsAppProvider" NOT NULL,
  "api_url" TEXT NOT NULL,
  "api_key" TEXT NOT NULL,
  "phone_number" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "whatsapp_configs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "automation_rules" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "type" "AutomationRuleType" NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "delay_minutes" INTEGER NOT NULL DEFAULT 0,
  "template_message" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "automation_rules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "whatsapp_messages" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "client_id" UUID NOT NULL,
  "appointment_id" UUID,
  "direction" "WhatsAppDirection" NOT NULL,
  "message" TEXT NOT NULL,
  "status" "WhatsAppMessageStatus" NOT NULL,
  "automation_type" "AutomationRuleType",
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "whatsapp_messages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ai_conversations" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "client_id" UUID NOT NULL,
  "context" JSONB NOT NULL,
  "last_message_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ai_conversations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "whatsapp_configs_tenant_id_key" ON "whatsapp_configs"("tenant_id");
CREATE INDEX IF NOT EXISTS "whatsapp_configs_active_provider_idx" ON "whatsapp_configs"("active", "provider");
CREATE UNIQUE INDEX IF NOT EXISTS "automation_rules_tenant_id_type_key" ON "automation_rules"("tenant_id", "type");
CREATE INDEX IF NOT EXISTS "automation_rules_tenant_id_active_type_idx" ON "automation_rules"("tenant_id", "active", "type");
CREATE INDEX IF NOT EXISTS "whatsapp_messages_tenant_id_created_at_idx" ON "whatsapp_messages"("tenant_id", "created_at");
CREATE INDEX IF NOT EXISTS "whatsapp_messages_tenant_id_automation_type_created_at_idx" ON "whatsapp_messages"("tenant_id", "automation_type", "created_at");
CREATE INDEX IF NOT EXISTS "whatsapp_messages_client_id_created_at_idx" ON "whatsapp_messages"("client_id", "created_at");
CREATE UNIQUE INDEX IF NOT EXISTS "ai_conversations_tenant_id_client_id_key" ON "ai_conversations"("tenant_id", "client_id");
CREATE INDEX IF NOT EXISTS "ai_conversations_tenant_id_last_message_at_idx" ON "ai_conversations"("tenant_id", "last_message_at");

DO $$
BEGIN
  ALTER TABLE "whatsapp_configs" ADD CONSTRAINT "whatsapp_configs_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "automation_rules" ADD CONSTRAINT "automation_rules_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_client_id_fkey"
    FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_appointment_id_fkey"
    FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_client_id_fkey"
    FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Default automation rules bootstrap for existing tenants.
INSERT INTO "automation_rules" ("id", "tenant_id", "type", "active", "delay_minutes", "template_message", "created_at", "updated_at")
SELECT gen_random_uuid(), t."id", 'CONFIRMATION'::"AutomationRuleType", true, 0,
       'Ola {{client_name}}, seu horario esta agendado para {{date}} as {{time}}. Responda 1 para confirmar ou 2 para cancelar.',
       CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "tenants" t
WHERE NOT EXISTS (
  SELECT 1 FROM "automation_rules" r WHERE r."tenant_id" = t."id" AND r."type" = 'CONFIRMATION'::"AutomationRuleType"
);

INSERT INTO "automation_rules" ("id", "tenant_id", "type", "active", "delay_minutes", "template_message", "created_at", "updated_at")
SELECT gen_random_uuid(), t."id", 'REMINDER'::"AutomationRuleType", true, 60,
       'Seu atendimento comeca em 1 hora. Estamos te esperando!',
       CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "tenants" t
WHERE NOT EXISTS (
  SELECT 1 FROM "automation_rules" r WHERE r."tenant_id" = t."id" AND r."type" = 'REMINDER'::"AutomationRuleType"
);

INSERT INTO "automation_rules" ("id", "tenant_id", "type", "active", "delay_minutes", "template_message", "created_at", "updated_at")
SELECT gen_random_uuid(), t."id", 'REACTIVATION'::"AutomationRuleType", true, 0,
       'Sentimos sua falta, {{client_name}}! Essa semana voce ganha 10% de desconto.',
       CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "tenants" t
WHERE NOT EXISTS (
  SELECT 1 FROM "automation_rules" r WHERE r."tenant_id" = t."id" AND r."type" = 'REACTIVATION'::"AutomationRuleType"
);

INSERT INTO "automation_rules" ("id", "tenant_id", "type", "active", "delay_minutes", "template_message", "created_at", "updated_at")
SELECT gen_random_uuid(), t."id", 'UPSELL'::"AutomationRuleType", true, 15,
       'Na proxima visita recomendamos hidratacao para manter o corte perfeito. Deseja agendar?',
       CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "tenants" t
WHERE NOT EXISTS (
  SELECT 1 FROM "automation_rules" r WHERE r."tenant_id" = t."id" AND r."type" = 'UPSELL'::"AutomationRuleType"
);

INSERT INTO "automation_rules" ("id", "tenant_id", "type", "active", "delay_minutes", "template_message", "created_at", "updated_at")
SELECT gen_random_uuid(), t."id", 'BIRTHDAY'::"AutomationRuleType", true, 0,
       'Feliz aniversario, {{client_name}}! Ganhe um beneficio especial na sua proxima visita.',
       CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "tenants" t
WHERE NOT EXISTS (
  SELECT 1 FROM "automation_rules" r WHERE r."tenant_id" = t."id" AND r."type" = 'BIRTHDAY'::"AutomationRuleType"
);
