import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateChurnRatePercent,
  calculatePointsEarned,
  calculateVipIds,
  classifyRfm,
  isolateTenantRows,
  shouldExpireByLastVisit
} from "../crm.calculations";

test("calculo de pontos deve converter valor pago corretamente", () => {
  const points = calculatePointsEarned(150, 1.5);
  assert.equal(points, 225);
});

test("expiracao automatica deve identificar saldo vencido por ultima visita", () => {
  const referenceDate = new Date("2026-02-28T12:00:00.000Z");
  const lastVisit = new Date("2025-11-01T10:00:00.000Z");
  assert.equal(
    shouldExpireByLastVisit({
      lastVisit,
      expirationDays: 90,
      referenceDate
    }),
    true
  );
});

test("classificacao RFM deve gerar segmento coerente", () => {
  const rfm = classifyRfm({
    daysSinceLastVisit: 8,
    visitsCount: 10,
    totalSpent: 2000
  });
  assert.equal(rfm.segment, "Campeoes");
  assert.equal(rfm.score, "545");
});

test("calculo de VIP deve marcar top 20 por faturamento", () => {
  const vipIds = calculateVipIds([
    { clientId: "a", totalSpent: 2000 },
    { clientId: "b", totalSpent: 1000 },
    { clientId: "c", totalSpent: 900 },
    { clientId: "d", totalSpent: 500 },
    { clientId: "e", totalSpent: 300 }
  ]);
  assert.deepEqual(vipIds, ["a"]);
});

test("calculo de churn deve retornar percentual correto", () => {
  assert.equal(calculateChurnRatePercent(50, 5), 10);
});

test("isolamento por tenant deve filtrar apenas registros do tenant atual", () => {
  const rows = [
    { id: "1", tenantId: "tenant-a" },
    { id: "2", tenantId: "tenant-b" },
    { id: "3", tenantId: "tenant-a" }
  ];
  const filtered = isolateTenantRows(rows, "tenant-a");
  assert.deepEqual(
    filtered.map((row) => row.id),
    ["1", "3"]
  );
});

