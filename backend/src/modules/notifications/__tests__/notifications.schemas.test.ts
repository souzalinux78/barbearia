import assert from "node:assert/strict";
import test from "node:test";
import {
  sendToUserSchema,
  subscribeSchema,
  unsubscribeSchema
} from "../notifications.schemas";

test("registro de subscription deve aceitar endpoint https e keys", () => {
  const parsed = subscribeSchema.parse({
    subscription: {
      endpoint: "https://fcm.googleapis.com/fcm/send/abc",
      keys: {
        p256dh: "BCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefghijklmnop",
        auth: "abcdefghijklmno12345"
      }
    }
  });
  assert.equal(parsed.subscription.endpoint.includes("https://"), true);
});

test("unsubscribe deve validar endpoint", () => {
  assert.equal(
    unsubscribeSchema.parse({
      endpoint: "https://example.push/sub/1"
    }).endpoint,
    "https://example.push/sub/1"
  );
});

test("envio para usuario deve exigir userId", () => {
  const parsed = sendToUserSchema.parse({
    userId: "9f3bb5fb-39bb-4973-a3a8-fbd0dbf2f676",
    title: "Novo agendamento",
    body: "Joao agendou para 14:30",
    route: "/appointments"
  });
  assert.equal(parsed.route, "/appointments");
});
