DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'RoleName' AND e.enumlabel = 'SUPER_ADMIN'
  ) THEN
    ALTER TYPE "RoleName" ADD VALUE 'SUPER_ADMIN';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'RoleName' AND e.enumlabel = 'FRANCHISE_OWNER'
  ) THEN
    ALTER TYPE "RoleName" ADD VALUE 'FRANCHISE_OWNER';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'RoleName' AND e.enumlabel = 'UNIT_OWNER'
  ) THEN
    ALTER TYPE "RoleName" ADD VALUE 'UNIT_OWNER';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'RoleName' AND e.enumlabel = 'UNIT_ADMIN'
  ) THEN
    ALTER TYPE "RoleName" ADD VALUE 'UNIT_ADMIN';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "franchises" (
  "id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "owner_user_id" UUID,
  "royalty_percentage" DECIMAL(5,2) NOT NULL DEFAULT 6,
  "logo_url" TEXT,
  "primary_color" TEXT,
  "secondary_color" TEXT,
  "domain" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "franchises_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "units" (
  "id" UUID NOT NULL,
  "franchise_id" UUID,
  "name" TEXT NOT NULL,
  "cnpj" TEXT,
  "address" TEXT,
  "city" TEXT,
  "state" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "units_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "royalties" (
  "id" UUID NOT NULL,
  "franchise_id" UUID NOT NULL,
  "unit_id" UUID NOT NULL,
  "period_start" DATE NOT NULL,
  "period_end" DATE NOT NULL,
  "revenue" DECIMAL(12,2) NOT NULL,
  "royalty_amount" DECIMAL(12,2) NOT NULL,
  "paid" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "royalties_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "tenants"
  ADD COLUMN IF NOT EXISTS "unit_id" UUID,
  ADD COLUMN IF NOT EXISTS "plan_id" UUID,
  ADD COLUMN IF NOT EXISTS "subscription_id" UUID;

INSERT INTO "units" (
  "id",
  "franchise_id",
  "name",
  "cnpj",
  "address",
  "city",
  "state",
  "active",
  "created_at",
  "updated_at"
)
SELECT
  t."id",
  NULL,
  t."name",
  NULL,
  NULL,
  NULL,
  NULL,
  true,
  t."created_at",
  COALESCE(t."updated_at", CURRENT_TIMESTAMP)
FROM "tenants" t
WHERE NOT EXISTS (
  SELECT 1 FROM "units" u WHERE u."id" = t."id"
);

UPDATE "tenants" t
SET "unit_id" = t."id"
WHERE t."unit_id" IS NULL;

UPDATE "tenants" t
SET
  "subscription_id" = s."id",
  "plan_id" = s."plan_id"
FROM "subscriptions" s
WHERE s."tenant_id" = t."id";

ALTER TABLE "tenants"
  ALTER COLUMN "unit_id" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "tenants_unit_id_key" ON "tenants"("unit_id");
CREATE INDEX IF NOT EXISTS "tenants_unit_id_idx" ON "tenants"("unit_id");
CREATE INDEX IF NOT EXISTS "units_franchise_id_idx" ON "units"("franchise_id");
CREATE INDEX IF NOT EXISTS "units_city_state_idx" ON "units"("city", "state");
CREATE INDEX IF NOT EXISTS "franchises_owner_user_id_idx" ON "franchises"("owner_user_id");
CREATE INDEX IF NOT EXISTS "franchises_domain_idx" ON "franchises"("domain");
CREATE UNIQUE INDEX IF NOT EXISTS "royalties_unit_id_period_start_period_end_key" ON "royalties"("unit_id", "period_start", "period_end");
CREATE INDEX IF NOT EXISTS "royalties_franchise_id_period_start_period_end_idx" ON "royalties"("franchise_id", "period_start", "period_end");
CREATE INDEX IF NOT EXISTS "royalties_unit_id_period_start_period_end_idx" ON "royalties"("unit_id", "period_start", "period_end");

DO $$
BEGIN
  ALTER TABLE "franchises" ADD CONSTRAINT "franchises_owner_user_id_fkey"
    FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "units" ADD CONSTRAINT "units_franchise_id_fkey"
    FOREIGN KEY ("franchise_id") REFERENCES "franchises"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "tenants" ADD CONSTRAINT "tenants_unit_id_fkey"
    FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "royalties" ADD CONSTRAINT "royalties_franchise_id_fkey"
    FOREIGN KEY ("franchise_id") REFERENCES "franchises"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "royalties" ADD CONSTRAINT "royalties_unit_id_fkey"
    FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
