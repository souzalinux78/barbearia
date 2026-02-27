CREATE INDEX IF NOT EXISTS "appointments_tenant_id_status_date_idx"
ON "appointments"("tenant_id", "status", "date");

CREATE INDEX IF NOT EXISTS "appointment_services_tenant_id_service_id_idx"
ON "appointment_services"("tenant_id", "service_id");

CREATE INDEX IF NOT EXISTS "payments_tenant_id_status_paid_at_idx"
ON "payments"("tenant_id", "status", "paid_at");

CREATE INDEX IF NOT EXISTS "commissions_tenant_id_created_at_idx"
ON "commissions"("tenant_id", "created_at");
