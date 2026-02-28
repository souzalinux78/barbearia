import assert from "node:assert/strict";
import test from "node:test";
import {
  detectConfirmationDecision,
  filterByTenant,
  inferAiIntent,
  isInactiveClient,
  renderAutomationTemplate
} from "../automation.calculations";

test("confirmacao automatica deve reconhecer resposta 1", () => {
  assert.equal(detectConfirmationDecision("1"), "CONFIRM");
  assert.equal(detectConfirmationDecision("confirmo"), "CONFIRM");
});

test("cancelamento via resposta deve reconhecer resposta 2", () => {
  assert.equal(detectConfirmationDecision("2"), "CANCEL");
  assert.equal(detectConfirmationDecision("cancelar"), "CANCEL");
});

test("reativacao deve considerar cliente inativo apos 30 dias", () => {
  const now = new Date("2026-02-28T12:00:00.000Z");
  const oldVisit = new Date("2026-01-10T12:00:00.000Z");
  const recentVisit = new Date("2026-02-20T12:00:00.000Z");

  assert.equal(isInactiveClient(oldVisit, 30, now), true);
  assert.equal(isInactiveClient(recentVisit, 30, now), false);
});

test("template de upsell deve interpolar variaveis corretamente", () => {
  const text = renderAutomationTemplate(
    "Ola {{client_name}}, recomendamos {{service_name}}.",
    {
      client_name: "Joao",
      service_name: "hidratacao"
    }
  );
  assert.equal(text, "Ola Joao, recomendamos hidratacao.");
});

test("IA deve classificar intencao de horario e agendamento", () => {
  assert.equal(inferAiIntent("Qual horario voces atendem?"), "HOURS");
  assert.equal(inferAiIntent("Quero agendar para amanha"), "BOOKING");
});

test("isolamento multi-tenant deve filtrar apenas tenant ativo", () => {
  const rows = [
    { tenantId: "t-1", value: 1 },
    { tenantId: "t-2", value: 2 },
    { tenantId: "t-1", value: 3 }
  ];

  const filtered = filterByTenant(rows, "t-1");
  assert.equal(filtered.length, 2);
  assert.deepEqual(
    filtered.map((item) => item.value),
    [1, 3]
  );
});
