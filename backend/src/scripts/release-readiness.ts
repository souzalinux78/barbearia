import { Prisma } from "@prisma/client";
import { env } from "../config/env";
import { prisma } from "../config/prisma";
import { DEFAULT_PLAN_DEFINITIONS } from "../modules/billing/plan-catalog";

type CheckResult = {
  name: string;
  status: "PASS" | "WARN" | "FAIL";
  details: string;
};

const criticalTables = [
  "tenants",
  "units",
  "users",
  "roles",
  "plans",
  "subscriptions",
  "billing_history",
  "payment_gateway_configs",
  "saas_admins",
  "platform_metrics",
  "tenant_status_logs",
  "impersonation_logs"
];

const print = (result: CheckResult) => {
  const prefix = result.status === "PASS" ? "[PASS]" : result.status === "WARN" ? "[WARN]" : "[FAIL]";
  // eslint-disable-next-line no-console
  console.log(`${prefix} ${result.name} - ${result.details}`);
};

const main = async () => {
  const checks: CheckResult[] = [];

  try {
    await prisma.$connect();
    await prisma.$queryRaw(Prisma.sql`SELECT 1`);
    checks.push({
      name: "Database connection",
      status: "PASS",
      details: "Conexao com PostgreSQL validada."
    });
  } catch (error) {
    checks.push({
      name: "Database connection",
      status: "FAIL",
      details: `Falha ao conectar no banco: ${(error as Error).message}`
    });
  }

  try {
    const rows = await prisma.$queryRaw<Array<{ table_name: string }>>(Prisma.sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN (${Prisma.join(criticalTables)})
    `);
    const found = new Set(rows.map((row) => row.table_name));
    const missing = criticalTables.filter((table) => !found.has(table));
    checks.push({
      name: "Critical tables",
      status: missing.length ? "FAIL" : "PASS",
      details: missing.length
        ? `Tabelas faltando: ${missing.join(", ")}`
        : "Todas as tabelas criticas existem."
    });
  } catch (error) {
    checks.push({
      name: "Critical tables",
      status: "FAIL",
      details: `Nao foi possivel validar tabelas: ${(error as Error).message}`
    });
  }

  try {
    const plans = await prisma.plan.findMany({
      select: {
        name: true,
        price: true,
        maxUsers: true,
        maxBarbers: true,
        maxAppointmentsMonth: true
      }
    });
    const plansCount = plans.length;
    const planMap = new Map(plans.map((plan) => [plan.name, plan]));
    const mismatches = DEFAULT_PLAN_DEFINITIONS.filter((catalog) => {
      const current = planMap.get(catalog.name);
      if (!current) {
        return true;
      }
      return (
        Number(current.price) !== catalog.price ||
        current.maxUsers !== catalog.maxUsers ||
        current.maxBarbers !== catalog.maxBarbers ||
        current.maxAppointmentsMonth !== catalog.maxAppointmentsMonth
      );
    });

    checks.push({
      name: "Plans catalog",
      status: plansCount >= 3 && mismatches.length === 0 ? "PASS" : "WARN",
      details:
        plansCount < 3
          ? `Apenas ${plansCount} plano(s). Execute seed de planos antes de vender.`
          : mismatches.length > 0
            ? `Catalogo divergente em ${mismatches.length} plano(s). Pode ser customizacao via Master; rode npm run plans:seed apenas se quiser padrao comercial.`
            : `Catalogo com ${plansCount} plano(s), alinhado ao comercial.`
    });
  } catch (error) {
    checks.push({
      name: "Plans catalog",
      status: "FAIL",
      details: `Falha ao validar planos: ${(error as Error).message}`
    });
  }

  try {
    const masterCount = await prisma.saaSAdmin.count();
    checks.push({
      name: "Master admin",
      status: masterCount > 0 ? "PASS" : "WARN",
      details:
        masterCount > 0
          ? `${masterCount} admin master cadastrado(s).`
          : "Nenhum SUPER_ADMIN cadastrado. Execute: npm run master:create-admin -- --email ... --password ..."
    });
  } catch (error) {
    checks.push({
      name: "Master admin",
      status: "FAIL",
      details: `Falha ao validar admin master: ${(error as Error).message}`
    });
  }

  checks.push({
    name: "Environment secrets",
    status: env.MASTER_JWT_SECRET.trim() ? "PASS" : "WARN",
    details: env.MASTER_JWT_SECRET.trim()
      ? "MASTER_JWT_SECRET configurado."
      : "MASTER_JWT_SECRET vazio. Em producao, configure segredo dedicado."
  });

  checks.forEach(print);

  const hasFail = checks.some((check) => check.status === "FAIL");
  await prisma.$disconnect();

  if (hasFail) {
    process.exit(1);
  }
};

main().catch(async (error) => {
  // eslint-disable-next-line no-console
  console.error("[FAIL] Release readiness", error);
  await prisma.$disconnect();
  process.exit(1);
});
