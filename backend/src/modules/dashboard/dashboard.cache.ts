type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

export interface DashboardCacheProvider {
  get<T>(key: string): T | null;
  set<T>(key: string, value: T, ttlMs: number): void;
  deleteByPrefix(prefix: string): void;
}

class InMemoryDashboardCache implements DashboardCacheProvider {
  private readonly storage = new Map<string, CacheEntry<unknown>>();

  get<T>(key: string): T | null {
    const entry = this.storage.get(key);
    if (!entry) {
      return null;
    }
    if (entry.expiresAt <= Date.now()) {
      this.storage.delete(key);
      return null;
    }
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlMs: number): void {
    this.storage.set(key, {
      value,
      expiresAt: Date.now() + ttlMs
    });
  }

  deleteByPrefix(prefix: string): void {
    for (const key of this.storage.keys()) {
      if (key.startsWith(prefix)) {
        this.storage.delete(key);
      }
    }
  }
}

export const dashboardCache: DashboardCacheProvider = new InMemoryDashboardCache();
const DASHBOARD_PREFIX = "dashboard:";

const DASHBOARD_CACHE_KEYS = [
  "summary",
  "revenue",
  "clients",
  "services",
  "barbers",
  "occupancy",
  "advanced"
] as const;

export const invalidateDashboardCacheForTenant = (tenantId: string): void => {
  DASHBOARD_CACHE_KEYS.forEach((cacheKey) => {
    dashboardCache.deleteByPrefix(`${DASHBOARD_PREFIX}${cacheKey}:${tenantId}:`);
  });
};

export const withCache = async <T>(
  key: string,
  ttlMs: number,
  resolver: () => Promise<T>
): Promise<T> => {
  const cached = dashboardCache.get<T>(key);
  if (cached) {
    return cached;
  }

  const value = await resolver();
  dashboardCache.set(key, value, ttlMs);
  return value;
};
