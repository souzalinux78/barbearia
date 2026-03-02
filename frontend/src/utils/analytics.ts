type AnalyticsPrimitive = string | number | boolean | null;
type AnalyticsPayload = Record<string, AnalyticsPrimitive | undefined>;

type AnalyticsEvent = {
  event: string;
  timestamp: string;
  path: string;
} & AnalyticsPayload;

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
  }
}

const STORAGE_KEY = "bp:analytics-events";
const SESSION_KEY = "bp:analytics-session";
const FIRST_TOUCH_KEY = "bp:analytics-first-touch";
const MAX_EVENTS = 50;
const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:4000/api/v1";
const INGEST_ENDPOINT = `${API_BASE}/marketing/events`;

type FirstTouchData = {
  source: string | null;
  medium: string | null;
  campaign: string | null;
  content: string | null;
  term: string | null;
  referrerHost: string | null;
  landingPath: string;
};

const readStoredEvents = (): AnalyticsEvent[] => {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((item) => typeof item === "object" && item !== null) as AnalyticsEvent[];
  } catch {
    return [];
  }
};

const writeStoredEvents = (events: AnalyticsEvent[]) => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const bounded = events.slice(-MAX_EVENTS);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(bounded));
  } catch {
    return;
  }
};

const createSessionId = () => {
  if (typeof window === "undefined") {
    return "server-session";
  }
  if (typeof window.crypto?.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

const getSessionId = () => {
  if (typeof window === "undefined") {
    return "server-session";
  }
  const current = window.localStorage.getItem(SESSION_KEY);
  if (current && current.trim().length >= 8) {
    return current;
  }
  const created = createSessionId();
  window.localStorage.setItem(SESSION_KEY, created);
  return created;
};

const getReferrerHost = () => {
  if (typeof document === "undefined" || !document.referrer) {
    return null;
  }
  try {
    return new URL(document.referrer).host;
  } catch {
    return null;
  }
};

const getFirstTouch = (): FirstTouchData => {
  if (typeof window === "undefined") {
    return {
      source: null,
      medium: null,
      campaign: null,
      content: null,
      term: null,
      referrerHost: null,
      landingPath: "/"
    };
  }

  const stored = window.localStorage.getItem(FIRST_TOUCH_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as FirstTouchData;
      if (parsed && typeof parsed === "object") {
        return parsed;
      }
    } catch {
      // fall through
    }
  }

  const params = new URLSearchParams(window.location.search);
  const firstTouch: FirstTouchData = {
    source: params.get("utm_source"),
    medium: params.get("utm_medium"),
    campaign: params.get("utm_campaign"),
    content: params.get("utm_content"),
    term: params.get("utm_term"),
    referrerHost: getReferrerHost(),
    landingPath: window.location.pathname
  };

  window.localStorage.setItem(FIRST_TOUCH_KEY, JSON.stringify(firstTouch));
  return firstTouch;
};

const getTenantIdFromPersistedSession = () => {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem("barbearia-auth-storage");
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as { state?: { tenant?: { id?: string } } };
    return parsed?.state?.tenant?.id ?? null;
  } catch {
    return null;
  }
};

const sanitizeMetadata = (payload: AnalyticsPayload, firstTouch: FirstTouchData) => {
  const base: Record<string, AnalyticsPrimitive> = {
    utm_source: firstTouch.source,
    utm_medium: firstTouch.medium,
    utm_campaign: firstTouch.campaign,
    utm_content: firstTouch.content,
    utm_term: firstTouch.term,
    referrer_host: firstTouch.referrerHost,
    first_landing_path: firstTouch.landingPath
  };

  const merged = {
    ...base,
    ...payload
  };

  const sanitizedEntries = Object.entries(merged)
    .filter(([, value]) => value !== undefined)
    .slice(0, 40)
    .map(([key, value]) => {
      const safeKey = key.slice(0, 60);
      if (typeof value === "string") {
        return [safeKey, value.slice(0, 400)] as const;
      }
      return [safeKey, value] as const;
    });

  return Object.fromEntries(sanitizedEntries) as Record<string, AnalyticsPrimitive>;
};

const sendEventToBackend = (input: {
  eventName: string;
  eventPath: string;
  metadata: Record<string, AnalyticsPrimitive>;
}) => {
  if (typeof window === "undefined") {
    return;
  }

  const body = JSON.stringify({
    eventName: input.eventName,
    eventPath: input.eventPath,
    sessionId: getSessionId(),
    tenantId: getTenantIdFromPersistedSession() ?? undefined,
    source:
      (typeof input.metadata.utm_source === "string" && input.metadata.utm_source) ||
      (typeof input.metadata.referrer_host === "string" && input.metadata.referrer_host) ||
      "direct",
    referrer: document.referrer || undefined,
    userAgent: navigator.userAgent || undefined,
    metadata: input.metadata
  });

  if (typeof navigator.sendBeacon === "function") {
    const sent = navigator.sendBeacon(
      INGEST_ENDPOINT,
      new Blob([body], { type: "application/json" })
    );
    if (sent) {
      return;
    }
  }

  void fetch(INGEST_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body,
    keepalive: true
  }).catch(() => null);
};

export const trackEvent = (event: string, payload: AnalyticsPayload = {}) => {
  if (typeof window === "undefined") {
    return;
  }
  const firstTouch = getFirstTouch();
  const metadata = sanitizeMetadata(payload, firstTouch);

  const eventData: AnalyticsEvent = {
    event,
    timestamp: new Date().toISOString(),
    path: window.location.pathname,
    ...metadata
  };

  if (Array.isArray(window.dataLayer)) {
    window.dataLayer.push(eventData);
  }

  const stored = readStoredEvents();
  stored.push(eventData);
  writeStoredEvents(stored);
  sendEventToBackend({
    eventName: event,
    eventPath: window.location.pathname,
    metadata
  });

  if (import.meta.env.DEV) {
    console.info("[analytics]", eventData);
  }
};

export const trackPageView = (page: string, payload: AnalyticsPayload = {}) => {
  trackEvent("page_view", {
    page,
    ...payload
  });
};
