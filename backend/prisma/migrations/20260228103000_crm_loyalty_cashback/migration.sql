DO $$
BEGIN
  CREATE TYPE "LoyaltyProgramType" AS ENUM ('POINTS', 'CASHBACK');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "LoyaltyTransactionType" AS ENUM ('EARN', 'REDEEM', 'EXPIRE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "clients"
  ADD COLUMN IF NOT EXISTS "vip" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "loyalty_points" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "cashback_balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "total_spent" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "visits_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "last_visit" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "loyalty_programs" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT false,
  "type" "LoyaltyProgramType" NOT NULL,
  "points_per_real" DECIMAL(10,2) NOT NULL DEFAULT 1,
  "cashback_percentage" DECIMAL(5,2) NOT NULL DEFAULT 0,
  "expiration_days" INTEGER NOT NULL DEFAULT 90,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "loyalty_programs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "loyalty_transactions" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "client_id" UUID NOT NULL,
  "appointment_id" UUID,
  "type" "LoyaltyTransactionType" NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "loyalty_transactions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "loyalty_programs_tenant_id_key" ON "loyalty_programs"("tenant_id");
CREATE INDEX IF NOT EXISTS "loyalty_programs_active_type_idx" ON "loyalty_programs"("active", "type");
CREATE INDEX IF NOT EXISTS "loyalty_transactions_tenant_id_client_id_created_at_idx" ON "loyalty_transactions"("tenant_id", "client_id", "created_at");
CREATE INDEX IF NOT EXISTS "loyalty_transactions_tenant_id_type_created_at_idx" ON "loyalty_transactions"("tenant_id", "type", "created_at");
CREATE INDEX IF NOT EXISTS "loyalty_transactions_appointment_id_idx" ON "loyalty_transactions"("appointment_id");
CREATE INDEX IF NOT EXISTS "clients_tenant_id_vip_idx" ON "clients"("tenant_id", "vip");
CREATE INDEX IF NOT EXISTS "clients_tenant_id_last_visit_idx" ON "clients"("tenant_id", "last_visit");

DO $$
BEGIN
  ALTER TABLE "loyalty_programs" ADD CONSTRAINT "loyalty_programs_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "loyalty_transactions" ADD CONSTRAINT "loyalty_transactions_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "loyalty_transactions" ADD CONSTRAINT "loyalty_transactions_client_id_fkey"
    FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "loyalty_transactions" ADD CONSTRAINT "loyalty_transactions_appointment_id_fkey"
    FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

UPDATE "clients"
SET "vip" = COALESCE("vip_badge", false);

WITH paid AS (
  SELECT
    "tenant_id",
    "client_id",
    SUM("amount") AS total_spent
  FROM "payments"
  WHERE "status" = 'PAGO' AND "client_id" IS NOT NULL
  GROUP BY "tenant_id", "client_id"
), finalized AS (
  SELECT
    "tenant_id",
    "client_id",
    COUNT(*)::INTEGER AS visits_count,
    MAX("date")::timestamp AS last_visit
  FROM "appointments"
  WHERE "status" = 'FINALIZADO' AND "client_id" IS NOT NULL
  GROUP BY "tenant_id", "client_id"
)
UPDATE "clients" c
SET
  "total_spent" = COALESCE(paid.total_spent, 0),
  "visits_count" = COALESCE(finalized.visits_count, 0),
  "last_visit" = finalized.last_visit
FROM paid
FULL OUTER JOIN finalized
  ON paid."tenant_id" = finalized."tenant_id"
  AND paid."client_id" = finalized."client_id"
WHERE c."tenant_id" = COALESCE(paid."tenant_id", finalized."tenant_id")
  AND c."id" = COALESCE(paid."client_id", finalized."client_id");
