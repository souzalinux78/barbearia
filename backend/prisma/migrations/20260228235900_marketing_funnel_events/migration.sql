CREATE TABLE IF NOT EXISTS "marketing_events" (
  "id" UUID NOT NULL,
  "tenant_id" UUID,
  "event_name" TEXT NOT NULL,
  "event_path" TEXT NOT NULL,
  "session_id" TEXT NOT NULL,
  "source" TEXT,
  "referrer" TEXT,
  "user_agent" TEXT,
  "ip_hash" TEXT,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "marketing_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "marketing_events_created_at_idx"
  ON "marketing_events"("created_at");
CREATE INDEX IF NOT EXISTS "marketing_events_event_name_created_at_idx"
  ON "marketing_events"("event_name", "created_at");
CREATE INDEX IF NOT EXISTS "marketing_events_session_id_created_at_idx"
  ON "marketing_events"("session_id", "created_at");
CREATE INDEX IF NOT EXISTS "marketing_events_source_created_at_idx"
  ON "marketing_events"("source", "created_at");
CREATE INDEX IF NOT EXISTS "marketing_events_tenant_id_created_at_idx"
  ON "marketing_events"("tenant_id", "created_at");

DO $$
BEGIN
  ALTER TABLE "marketing_events" ADD CONSTRAINT "marketing_events_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

