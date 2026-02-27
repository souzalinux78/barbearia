import { api } from "./api";

type BrowserPushSubscription = PushSubscriptionJSON;

const urlBase64ToUint8Array = (base64String: string) => {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((character) => character.charCodeAt(0)));
};

const getVapidPublicKey = async () => {
  const { data } = await api.get<{ publicKey: string }>("/notifications/vapid-public-key");
  return data.publicKey;
};

const postSubscription = async (subscription: BrowserPushSubscription) => {
  await api.post("/notifications/subscribe", {
    subscription
  });
};

export const syncPushSubscription = async () => {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return { supported: false };
  }

  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  if (!existing) {
    return { supported: true, subscribed: false };
  }

  await postSubscription(existing.toJSON());
  return { supported: true, subscribed: true };
};

export const requestPushPermissionAndSubscribe = async () => {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return { supported: false };
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return { supported: true, granted: false };
  }

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    const publicKey = await getVapidPublicKey();
    if (!publicKey) {
      return { supported: true, granted: true, subscribed: false };
    }
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey)
    });
  }

  await postSubscription(subscription.toJSON());
  return { supported: true, granted: true, subscribed: true };
};

export const unsubscribePush = async () => {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return { removed: false };
  }
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    return { removed: false };
  }
  await api.post("/notifications/unsubscribe", {
    endpoint: subscription.endpoint
  });
  await subscription.unsubscribe();
  return { removed: true };
};
