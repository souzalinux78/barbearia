import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateCommissionAmount,
  calculateDre,
  filterByTenant,
  shouldGeneratePaymentOnFinalize
} from "../financial.calculations";

test("finalizacao deve sinalizar geracao de pagamento", () => {
  assert.equal(shouldGeneratePaymentOnFinalize("EM_ATENDIMENTO", "FINALIZADO"), true);
  assert.equal(shouldGeneratePaymentOnFinalize("FINALIZADO", "FINALIZADO"), false);
});

test("calculo de comissao percentual deve ser correto", () => {
  assert.equal(calculateCommissionAmount(120, 40), 48);
  assert.equal(calculateCommissionAmount(75, 35), 26.25);
});

test("calculo de DRE simplificado deve retornar lucro e margem corretos", () => {
  const result = calculateDre({
    revenue: 1000,
    expenses: 300,
    commissions: 200
  });

  assert.equal(result.lucroOperacional, 500);
  assert.equal(result.margemPercentual, 50);
});

test("filtro por tenant deve isolar registros corretamente", () => {
  const items = [
    { tenantId: "t1", id: 1 },
    { tenantId: "t2", id: 2 },
    { tenantId: "t1", id: 3 }
  ];

  const filtered = filterByTenant(items, "t1");
  assert.deepEqual(
    filtered.map((item) => item.id),
    [1, 3]
  );
});
