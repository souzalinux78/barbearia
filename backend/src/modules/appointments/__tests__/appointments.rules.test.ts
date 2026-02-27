import assert from "node:assert/strict";
import test from "node:test";
import { RoleName } from "@prisma/client";
import {
  assertCanAlterAppointment,
  hasTimeConflict,
  ensureNotPast,
  ensureValidTimeRange
} from "../appointments.rules";

test("deve detectar conflito de horario para o mesmo barbeiro", () => {
  const conflict = hasTimeConflict(
    { startMin: 9 * 60 + 15, endMin: 10 * 60 },
    [{ startMin: 9 * 60, endMin: 9 * 60 + 30 }]
  );
  assert.equal(conflict, true);
});

test("deve bloquear BARBER alterando agendamento de outro barbeiro", () => {
  assert.throws(() => {
    assertCanAlterAppointment(RoleName.BARBER, "barber-a", "barber-b");
  });
});

test("deve validar criacao de horario futuro sem erro", () => {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  assert.doesNotThrow(() => {
    ensureValidTimeRange("10:00", "10:45");
    ensureNotPast(tomorrow, "10:00");
  });
});
