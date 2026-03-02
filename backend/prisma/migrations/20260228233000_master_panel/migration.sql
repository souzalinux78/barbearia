CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS "saas_admins" (
  "id" UUID NOT NULL,
  "email" TEXT NOT NULL,
  "password_hash" TEXT NOT NULL,
  "role" "RoleName" NOT NULL DEFAULT 'SUPER_ADMIN',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "saas_admins_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "platform_metrics" (
  "id" UUID NOT NULL,
  "month" DATE NOT NULL,
  "total_mrr" DECIMAL(12,2) NOT NULL,
  "total_active_subscriptions" INTEGER NOT NULL,
  "total_churn" DECIMAL(7,2) NOT NULL,
  "total_new_subscriptions" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "platform_metrics_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "tenant_status_logs" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "admin_id" UUID,
  "previous_status" TEXT NOT NULL,
  "new_status" TEXT NOT NULL,
  "reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "tenant_status_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "impersonation_logs" (
  "id" UUID NOT NULL,
  "admin_id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "impersonation_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "saas_admins_email_key" ON "saas_admins"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "platform_metrics_month_key" ON "platform_metrics"("month");
CREATE INDEX IF NOT EXISTS "platform_metrics_month_idx" ON "platform_metrics"("month");
CREATE INDEX IF NOT EXISTS "tenant_status_logs_tenant_id_created_at_idx" ON "tenant_status_logs"("tenant_id", "created_at");
CREATE INDEX IF NOT EXISTS "tenant_status_logs_admin_id_created_at_idx" ON "tenant_status_logs"("admin_id", "created_at");
CREATE INDEX IF NOT EXISTS "impersonation_logs_admin_id_created_at_idx" ON "impersonation_logs"("admin_id", "created_at");
CREATE INDEX IF NOT EXISTS "impersonation_logs_tenant_id_created_at_idx" ON "impersonation_logs"("tenant_id", "created_at");

CREATE INDEX IF NOT EXISTS "subscriptions_status_idx" ON "subscriptions"("status");
CREATE INDEX IF NOT EXISTS "subscriptions_plan_id_idx" ON "subscriptions"("plan_id");
CREATE INDEX IF NOT EXISTS "units_franchise_id_idx" ON "units"("franchise_id");

DO $$
BEGIN
  ALTER TABLE "tenant_status_logs" ADD CONSTRAINT "tenant_status_logs_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "tenant_status_logs" ADD CONSTRAINT "tenant_status_logs_admin_id_fkey"
    FOREIGN KEY ("admin_id") REFERENCES "saas_admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "impersonation_logs" ADD CONSTRAINT "impersonation_logs_admin_id_fkey"
    FOREIGN KEY ("admin_id") REFERENCES "saas_admins"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "impersonation_logs" ADD CONSTRAINT "impersonation_logs_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
