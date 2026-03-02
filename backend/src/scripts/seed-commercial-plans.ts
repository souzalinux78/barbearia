import { prisma } from "../config/prisma";
import { DEFAULT_PLAN_DEFINITIONS } from "../modules/billing/plan-catalog";

const main = async () => {
  for (const plan of DEFAULT_PLAN_DEFINITIONS) {
    await prisma.plan.upsert({
      where: { name: plan.name },
      create: {
        name: plan.name,
        price: plan.price,
        maxUsers: plan.maxUsers,
        maxBarbers: plan.maxBarbers,
        maxAppointmentsMonth: plan.maxAppointmentsMonth,
        features: plan.features
      },
      update: {
        price: plan.price,
        maxUsers: plan.maxUsers,
        maxBarbers: plan.maxBarbers,
        maxAppointmentsMonth: plan.maxAppointmentsMonth,
        features: plan.features
      }
    });
  }

  // eslint-disable-next-line no-console
  console.log("[OK] Catalogo comercial de planos atualizado.");
};

main()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error("[ERRO] Seed comercial de planos falhou:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

