-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDENTE', 'PAGO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "ExpenseType" AS ENUM ('FIXA', 'VARIAVEL');

-- AlterEnum
BEGIN;
CREATE TYPE "PaymentMethod_new" AS ENUM ('DINHEIRO', 'PIX', 'CARTAO_CREDITO', 'CARTAO_DEBITO', 'TRANSFERENCIA');
ALTER TABLE "payments"
ALTER COLUMN "method" TYPE "PaymentMethod_new"
USING (
  CASE "method"::text
    WHEN 'CASH' THEN 'DINHEIRO'
    WHEN 'CREDIT_CARD' THEN 'CARTAO_CREDITO'
    WHEN 'DEBIT_CARD' THEN 'CARTAO_DEBITO'
    WHEN 'TRANSFER' THEN 'TRANSFERENCIA'
    ELSE 'PIX'
  END
)::"PaymentMethod_new";
ALTER TYPE "PaymentMethod" RENAME TO "PaymentMethod_old";
ALTER TYPE "PaymentMethod_new" RENAME TO "PaymentMethod";
DROP TYPE "public"."PaymentMethod_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "commissions" DROP CONSTRAINT "commissions_user_id_fkey";

-- AlterTable + data migration for existing rows
ALTER TABLE "commissions"
ADD COLUMN "barber_id" UUID,
ADD COLUMN "percentage" DECIMAL(5,2) NOT NULL DEFAULT 40;

UPDATE "commissions" SET "barber_id" = "user_id";

ALTER TABLE "commissions"
ALTER COLUMN "barber_id" SET NOT NULL,
DROP COLUMN "user_id";

-- AlterTable
ALTER TABLE "expenses" ADD COLUMN     "due_date" DATE NOT NULL DEFAULT CURRENT_DATE,
ADD COLUMN     "paid" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "type" "ExpenseType" NOT NULL DEFAULT 'VARIAVEL',
ALTER COLUMN "description" SET NOT NULL,
ALTER COLUMN "paid_at" DROP NOT NULL,
ALTER COLUMN "paid_at" DROP DEFAULT;

UPDATE "expenses" SET "description" = COALESCE("description", 'Despesa sem descricao');

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "client_id" UUID,
ADD COLUMN     "status" "PaymentStatus" NOT NULL DEFAULT 'PAGO';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "commission_rate" DECIMAL(5,2) NOT NULL DEFAULT 40;

-- CreateIndex
CREATE INDEX "commissions_tenant_id_barber_id_idx" ON "commissions"("tenant_id", "barber_id");

-- CreateIndex
CREATE INDEX "expenses_tenant_id_idx" ON "expenses"("tenant_id");

-- CreateIndex
CREATE INDEX "expenses_tenant_id_due_date_idx" ON "expenses"("tenant_id", "due_date");

-- CreateIndex
CREATE INDEX "payments_tenant_id_idx" ON "payments"("tenant_id");

-- CreateIndex
CREATE INDEX "payments_status_idx" ON "payments"("status");

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_barber_id_fkey" FOREIGN KEY ("barber_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
