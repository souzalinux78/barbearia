import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateGrowth,
  calculateLtv,
  calculateRate,
  filterTenantRecords,
  getPreviousPeriod
} from "../dashboard.calculations";

test("deve calcular crescimento comparando com periodo anterior", () => {
  assert.equal(calculateGrowth(1200, 1000), 20);
  assert.equal(calculateGrowth(900, 1000), -10);
  assert.equal(calculateGrowth(100, 0), 100);
});

test("deve calcular periodo anterior com mesma duracao", () => {
  const period = {
    start: new Date("2026-02-01T00:00:00.000Z"),
    end: new Date("2026-02-07T23:59:59.999Z")
  };

  const previous = getPreviousPeriod(period);

  assert.equal(previous.start.toISOString(), "2026-01-25T00:00:00.000Z");
  assert.equal(previous.end.toISOString(), "2026-01-31T23:59:59.999Z");
});

test("deve calcular LTV com base em receita media e retencao media", () => {
  const ltv = calculateLtv(300, 90);
  assert.equal(ltv, 900);
});

test("deve manter isolamento por tenant em filtro utilitario", () => {
  const rows = [
    { tenantId: "t1", id: "1" },
    { tenantId: "t2", id: "2" },
    { tenantId: "t1", id: "3" }
  ];

  const filtered = filterTenantRecords(rows, "t1");
  assert.deepEqual(
    filtered.map((item) => item.id),
    ["1", "3"]
  );
});

test("deve calcular taxa percentual com seguranca para divisor zero", () => {
  assert.equal(calculateRate(4, 10), 40);
  assert.equal(calculateRate(1, 0), 0);
});
