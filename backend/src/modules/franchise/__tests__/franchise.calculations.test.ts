import assert from "node:assert/strict";
import test from "node:test";
import {
  buildScopeFromRole,
  calculateGrowth,
  calculateRate,
  calculateRoyaltyAmount,
  filterRowsByScope,
  getPerformanceSignal
} from "../franchise.calculations";

test("hierarquia deve mapear FRANCHISE_OWNER para escopo de franquia", () => {
  const scope = buildScopeFromRole({
    role: "FRANCHISE_OWNER",
    franchiseId: "fr-1",
    unitId: "un-1"
  });
  assert.equal(scope.mode, "FRANCHISE");
  assert.equal(scope.franchiseId, "fr-1");
});

test("isolamento de dados deve restringir linhas ao escopo correto", () => {
  const rows = [
    { unitId: "un-1", franchiseId: "fr-1", revenue: 1000 },
    { unitId: "un-2", franchiseId: "fr-1", revenue: 900 },
    { unitId: "un-3", franchiseId: "fr-2", revenue: 1200 }
  ];

  const filtered = filterRowsByScope(rows, {
    mode: "FRANCHISE",
    franchiseId: "fr-1",
    unitId: null
  });

  assert.deepEqual(
    filtered.map((row) => row.unitId),
    ["un-1", "un-2"]
  );
});

test("calculo de royalties deve respeitar percentual da franquia", () => {
  assert.equal(calculateRoyaltyAmount(10000, 6), 600);
});

test("calculo de permissoes deve manter UNIT como escopo de unidade", () => {
  const scope = buildScopeFromRole({
    role: "UNIT_ADMIN",
    franchiseId: "fr-1",
    unitId: "un-2"
  });
  assert.equal(scope.mode, "UNIT");
  assert.equal(scope.unitId, "un-2");
});

test("consolidacao deve calcular crescimento e taxa corretamente", () => {
  assert.equal(calculateGrowth(1200, 1000), 20);
  assert.equal(calculateRate(45, 90), 50);
});

test("sinal de performance deve classificar verde/amarelo/vermelho", () => {
  assert.equal(getPerformanceSignal(120, 100), "GREEN");
  assert.equal(getPerformanceSignal(90, 100), "YELLOW");
  assert.equal(getPerformanceSignal(60, 100), "RED");
});

