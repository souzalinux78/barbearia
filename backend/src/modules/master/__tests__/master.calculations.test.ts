import assert from "node:assert/strict";
import test from "node:test";
import {
  canAccessMaster,
  calculateGrowthPercent,
  calculateMrr,
  calculateRate,
  projectRevenue,
  resolveTenantStatusTransition
} from "../master.calculations";

test("deve calcular MRR corretamente por plano", () => {
  const mrr = calculateMrr([
    { price: 99.9, count: 10 },
    { price: 199.9, count: 2 }
  ]);
  assert.equal(mrr, 1398.8);
});

test("deve calcular churn corretamente com base anterior", () => {
  assert.equal(calculateRate(5, 100), 5);
  assert.equal(calculateGrowthPercent(12, 5, 100), 7);
});

test("deve projetar receita para os proximos meses", () => {
  const projection = projectRevenue(1000, 10, 3);
  assert.deepEqual(projection, [1100, 1210, 1331]);
});

test("deve resolver transicao de status para suspensao e reativacao", () => {
  assert.deepEqual(resolveTenantStatusTransition(true, "SUSPENDED"), {
    previousStatus: "ACTIVE",
    newStatus: "SUSPENDED",
    changed: true
  });
  assert.deepEqual(resolveTenantStatusTransition(false, "ACTIVE"), {
    previousStatus: "SUSPENDED",
    newStatus: "ACTIVE",
    changed: true
  });
});

test("isolamento master deve permitir apenas SUPER_ADMIN", () => {
  assert.equal(canAccessMaster("SUPER_ADMIN"), true);
  assert.equal(canAccessMaster("OWNER"), false);
  assert.equal(canAccessMaster("BARBER"), false);
});
