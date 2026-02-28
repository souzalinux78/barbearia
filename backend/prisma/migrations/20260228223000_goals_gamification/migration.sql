CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  CREATE TYPE "GoalType" AS ENUM ('REVENUE', 'APPOINTMENTS', 'SERVICES', 'TICKET_AVG', 'UPSELL');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "GoalPeriod" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "BadgeRuleType" AS ENUM ('META_MASTER', 'UPSELL_KING', 'APPOINTMENTS_100', 'TICKET_HIGH', 'MONTH_CHAMPION');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "goals" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "unit_id" UUID,
  "user_id" UUID,
  "type" "GoalType" NOT NULL,
  "target_value" DECIMAL(12,2) NOT NULL,
  "period" "GoalPeriod" NOT NULL,
  "start_date" DATE NOT NULL,
  "end_date" DATE NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "goals_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "goal_progress" (
  "id" UUID NOT NULL,
  "goal_id" UUID NOT NULL,
  "current_value" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "percentage" DECIMAL(7,2) NOT NULL DEFAULT 0,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "goal_progress_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "gamification_points" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "points" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "reference_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "gamification_points_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "badges" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "icon" TEXT NOT NULL,
  "rule_type" "BadgeRuleType" NOT NULL,
  "rule_value" DECIMAL(12,2) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "badges_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "user_badges" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "badge_id" UUID NOT NULL,
  "achieved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "user_badges_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "challenges" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "target_type" "GoalType" NOT NULL,
  "target_value" DECIMAL(12,2) NOT NULL,
  "reward_points" INTEGER NOT NULL,
  "start_date" DATE NOT NULL,
  "end_date" DATE NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "challenges_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "goals_tenant_id_idx" ON "goals"("tenant_id");
CREATE INDEX IF NOT EXISTS "goals_tenant_id_user_id_idx" ON "goals"("tenant_id", "user_id");
CREATE INDEX IF NOT EXISTS "goals_tenant_id_unit_id_idx" ON "goals"("tenant_id", "unit_id");
CREATE INDEX IF NOT EXISTS "goals_tenant_id_start_date_end_date_idx" ON "goals"("tenant_id", "start_date", "end_date");
CREATE UNIQUE INDEX IF NOT EXISTS "goal_progress_goal_id_key" ON "goal_progress"("goal_id");
CREATE INDEX IF NOT EXISTS "goal_progress_updated_at_idx" ON "goal_progress"("updated_at");
CREATE INDEX IF NOT EXISTS "gamification_points_tenant_id_idx" ON "gamification_points"("tenant_id");
CREATE INDEX IF NOT EXISTS "gamification_points_tenant_id_user_id_created_at_idx" ON "gamification_points"("tenant_id", "user_id", "created_at");
CREATE INDEX IF NOT EXISTS "gamification_points_reference_id_idx" ON "gamification_points"("reference_id");
CREATE INDEX IF NOT EXISTS "badges_tenant_id_idx" ON "badges"("tenant_id");
CREATE INDEX IF NOT EXISTS "badges_tenant_id_rule_type_idx" ON "badges"("tenant_id", "rule_type");
CREATE UNIQUE INDEX IF NOT EXISTS "user_badges_user_id_badge_id_key" ON "user_badges"("user_id", "badge_id");
CREATE INDEX IF NOT EXISTS "user_badges_badge_id_idx" ON "user_badges"("badge_id");
CREATE INDEX IF NOT EXISTS "user_badges_achieved_at_idx" ON "user_badges"("achieved_at");
CREATE INDEX IF NOT EXISTS "challenges_tenant_id_idx" ON "challenges"("tenant_id");
CREATE INDEX IF NOT EXISTS "challenges_tenant_id_active_start_date_end_date_idx" ON "challenges"("tenant_id", "active", "start_date", "end_date");

DO $$
BEGIN
  ALTER TABLE "goals" ADD CONSTRAINT "goals_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "goals" ADD CONSTRAINT "goals_unit_id_fkey"
    FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "goals" ADD CONSTRAINT "goals_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "goal_progress" ADD CONSTRAINT "goal_progress_goal_id_fkey"
    FOREIGN KEY ("goal_id") REFERENCES "goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "gamification_points" ADD CONSTRAINT "gamification_points_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "gamification_points" ADD CONSTRAINT "gamification_points_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "badges" ADD CONSTRAINT "badges_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_badge_id_fkey"
    FOREIGN KEY ("badge_id") REFERENCES "badges"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "challenges" ADD CONSTRAINT "challenges_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

INSERT INTO "badges" ("id", "tenant_id", "name", "description", "icon", "rule_type", "rule_value", "created_at")
SELECT gen_random_uuid(), t."id", 'Meta Master', 'Bateu meta mensal por 3 ciclos.', 'target', 'META_MASTER'::"BadgeRuleType", 3, CURRENT_TIMESTAMP
FROM "tenants" t
WHERE NOT EXISTS (
  SELECT 1 FROM "badges" b WHERE b."tenant_id" = t."id" AND b."rule_type" = 'META_MASTER'::"BadgeRuleType"
);

INSERT INTO "badges" ("id", "tenant_id", "name", "description", "icon", "rule_type", "rule_value", "created_at")
SELECT gen_random_uuid(), t."id", 'Rei do Upsell', 'Realizou 20 upsells no periodo.', 'crown', 'UPSELL_KING'::"BadgeRuleType", 20, CURRENT_TIMESTAMP
FROM "tenants" t
WHERE NOT EXISTS (
  SELECT 1 FROM "badges" b WHERE b."tenant_id" = t."id" AND b."rule_type" = 'UPSELL_KING'::"BadgeRuleType"
);

INSERT INTO "badges" ("id", "tenant_id", "name", "description", "icon", "rule_type", "rule_value", "created_at")
SELECT gen_random_uuid(), t."id", '100 Atendimentos', 'Concluiu 100 atendimentos finalizados.', 'scissors', 'APPOINTMENTS_100'::"BadgeRuleType", 100, CURRENT_TIMESTAMP
FROM "tenants" t
WHERE NOT EXISTS (
  SELECT 1 FROM "badges" b WHERE b."tenant_id" = t."id" AND b."rule_type" = 'APPOINTMENTS_100'::"BadgeRuleType"
);

INSERT INTO "badges" ("id", "tenant_id", "name", "description", "icon", "rule_type", "rule_value", "created_at")
SELECT gen_random_uuid(), t."id", 'Ticket Medio Alto', 'Manteve ticket medio acima da meta.', 'ticket', 'TICKET_HIGH'::"BadgeRuleType", 120, CURRENT_TIMESTAMP
FROM "tenants" t
WHERE NOT EXISTS (
  SELECT 1 FROM "badges" b WHERE b."tenant_id" = t."id" AND b."rule_type" = 'TICKET_HIGH'::"BadgeRuleType"
);

INSERT INTO "badges" ("id", "tenant_id", "name", "description", "icon", "rule_type", "rule_value", "created_at")
SELECT gen_random_uuid(), t."id", 'Campeao do Mes', 'Fechou o mes em primeiro lugar na unidade.', 'trophy', 'MONTH_CHAMPION'::"BadgeRuleType", 1, CURRENT_TIMESTAMP
FROM "tenants" t
WHERE NOT EXISTS (
  SELECT 1 FROM "badges" b WHERE b."tenant_id" = t."id" AND b."rule_type" = 'MONTH_CHAMPION'::"BadgeRuleType"
);
