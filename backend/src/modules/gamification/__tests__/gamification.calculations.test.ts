import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateProgressPercentage,
  isolateTenantRows,
  sortRanking
} from "../gamification.calculations";

test("calculo de progresso deve retornar percentual correto", () => {
  assert.equal(calculateProgressPercentage(50, 100), 50);
  assert.equal(calculateProgressPercentage(120, 100), 120);
  assert.equal(calculateProgressPercentage(0, 0), 0);
});

test("ranking deve ordenar por score com desempate coerente", () => {
  const ranking = sortRanking([
    { userId: "1", userName: "Andre", points: 100, revenue: 1000, goalsHit: 1 },
    { userId: "2", userName: "Bruno", points: 120, revenue: 900, goalsHit: 0 },
    { userId: "3", userName: "Carlos", points: 120, revenue: 1200, goalsHit: 2 }
  ]);

  assert.deepEqual(
    ranking.map((row) => row.userId),
    ["3", "1", "2"]
  );
});

test("isolamento multi-tenant deve manter apenas linhas do tenant atual", () => {
  const rows = [
    { tenantId: "tenant-a", id: "1" },
    { tenantId: "tenant-b", id: "2" },
    { tenantId: "tenant-a", id: "3" }
  ];
  const filtered = isolateTenantRows(rows, "tenant-a");

  assert.deepEqual(
    filtered.map((row) => row.id),
    ["1", "3"]
  );
});
