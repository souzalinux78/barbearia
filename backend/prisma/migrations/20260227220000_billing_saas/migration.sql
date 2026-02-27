-- CreateEnum (idempotent for failed-retry scenarios)
DO $$
BEGIN
  CREATE TYPE "BillingGateway" AS ENUM ('STRIPE', 'PIX');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "PlanName" AS ENUM ('FREE', 'PRO', 'PREMIUM');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "BillingPaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'CANCELED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Rebuild enum SubscriptionStatus to include INCOMPLETE/TRIALING
BEGIN;
DROP TYPE IF EXISTS "SubscriptionStatus_new";
CREATE TYPE "SubscriptionStatus_new" AS ENUM ('ACTIVE', 'PAST_DUE', 'CANCELED', 'INCOMPLETE', 'TRIALING');
ALTER TABLE "subscriptions"
ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "subscriptions"
ALTER COLUMN "status" TYPE "SubscriptionStatus_new"
USING (
  CASE "status"::text
    WHEN 'TRIAL' THEN 'TRIALING'
    ELSE "status"::text
  END
)::"SubscriptionStatus_new";
ALTER TYPE "SubscriptionStatus" RENAME TO "SubscriptionStatus_old";
ALTER TYPE "SubscriptionStatus_new" RENAME TO "SubscriptionStatus";
DROP TYPE "public"."SubscriptionStatus_old";
ALTER TABLE "subscriptions"
ALTER COLUMN "status" SET DEFAULT 'TRIALING';
COMMIT;

-- CreateTable
CREATE TABLE "plans" (
    "id" UUID NOT NULL,
    "name" "PlanName" NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "max_users" INTEGER NOT NULL,
    "max_barbers" INTEGER NOT NULL,
    "max_appointments_month" INTEGER NOT NULL,
    "features" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- Seed plans
INSERT INTO "plans" ("id", "name", "price", "max_users", "max_barbers", "max_appointments_month", "features")
SELECT
  '00000000-0000-0000-0000-000000000001',
  'FREE'::"PlanName",
  0,
  2,
  1,
  120,
  '{"dashboard_basic": true, "financial_basic": true, "premium_analytics": false, "inventory": false}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM "plans" WHERE "name" = 'FREE'::"PlanName");

INSERT INTO "plans" ("id", "name", "price", "max_users", "max_barbers", "max_appointments_month", "features")
SELECT
  '00000000-0000-0000-0000-000000000002',
  'PRO'::"PlanName",
  199,
  10,
  5,
  1000,
  '{"dashboard_basic": true, "financial_basic": true, "premium_analytics": true, "inventory": true}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM "plans" WHERE "name" = 'PRO'::"PlanName");

INSERT INTO "plans" ("id", "name", "price", "max_users", "max_barbers", "max_appointments_month", "features")
SELECT
  '00000000-0000-0000-0000-000000000003',
  'PREMIUM'::"PlanName",
  399,
  999,
  999,
  100000,
  '{"dashboard_basic": true, "financial_basic": true, "premium_analytics": true, "inventory": true, "api_access": true}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM "plans" WHERE "name" = 'PREMIUM'::"PlanName");

-- AlterTable subscriptions
ALTER TABLE "subscriptions"
ADD COLUMN "plan_id" UUID,
ADD COLUMN "pending_plan_id" UUID,
ADD COLUMN "gateway" "BillingGateway" NOT NULL DEFAULT 'PIX',
ADD COLUMN "external_subscription_id" TEXT,
ADD COLUMN "current_period_start" TIMESTAMP(3),
ADD COLUMN "current_period_end" TIMESTAMP(3),
ADD COLUMN "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false;

UPDATE "subscriptions" s
SET "plan_id" = p."id"
FROM "plans" p
WHERE p."name" = (
  CASE
    WHEN UPPER(COALESCE(s."plan", '')) LIKE '%PREMIUM%' THEN 'PREMIUM'::"PlanName"
    WHEN UPPER(COALESCE(s."plan", '')) LIKE '%FREE%' THEN 'FREE'::"PlanName"
    ELSE 'PRO'::"PlanName"
  END
);

UPDATE "subscriptions"
SET
  "current_period_start" = COALESCE("start_at", "created_at"),
  "current_period_end" = COALESCE("end_at", COALESCE("start_at", "created_at") + INTERVAL '7 day');

ALTER TABLE "subscriptions"
ALTER COLUMN "plan_id" SET NOT NULL,
ALTER COLUMN "current_period_start" SET NOT NULL,
ALTER COLUMN "current_period_end" SET NOT NULL;

ALTER TABLE "subscriptions"
DROP COLUMN "plan",
DROP COLUMN "start_at",
DROP COLUMN "end_at";

-- CreateTable
CREATE TABLE "billing_history" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "subscription_id" UUID NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "status" "BillingPaymentStatus" NOT NULL,
    "gateway" "BillingGateway" NOT NULL,
    "paid_at" TIMESTAMP(3),
    "external_ref" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_gateway_configs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "stripe_active" BOOLEAN NOT NULL DEFAULT false,
    "pix_active" BOOLEAN NOT NULL DEFAULT false,
    "stripe_secret_key" TEXT,
    "stripe_webhook_secret" TEXT,
    "pix_api_key" TEXT,
    "pix_webhook_secret" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_gateway_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_logs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "level" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "plans_name_key" ON "plans"("name");
CREATE UNIQUE INDEX "payment_gateway_configs_tenant_id_key" ON "payment_gateway_configs"("tenant_id");
CREATE INDEX "subscriptions_plan_id_idx" ON "subscriptions"("plan_id");
CREATE INDEX "subscriptions_pending_plan_id_idx" ON "subscriptions"("pending_plan_id");
CREATE INDEX "subscriptions_status_idx" ON "subscriptions"("status");
CREATE INDEX "billing_history_tenant_id_created_at_idx" ON "billing_history"("tenant_id", "created_at");
CREATE INDEX "billing_history_subscription_id_idx" ON "billing_history"("subscription_id");
CREATE INDEX "billing_history_status_idx" ON "billing_history"("status");
CREATE INDEX "payment_gateway_configs_stripe_active_pix_active_idx" ON "payment_gateway_configs"("stripe_active", "pix_active");
CREATE INDEX "billing_logs_tenant_id_created_at_idx" ON "billing_logs"("tenant_id", "created_at");

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_pending_plan_id_fkey" FOREIGN KEY ("pending_plan_id") REFERENCES "plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "billing_history" ADD CONSTRAINT "billing_history_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "billing_history" ADD CONSTRAINT "billing_history_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payment_gateway_configs" ADD CONSTRAINT "payment_gateway_configs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "billing_logs" ADD CONSTRAINT "billing_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
