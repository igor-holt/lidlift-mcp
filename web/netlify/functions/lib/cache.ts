import { getStore } from "@netlify/blobs";

import type { EdgeCacheMetadata } from "../../../src/types";

interface CachedMetadata {
  cachedAt: string;
  fetchedAt: string;
  ttlSeconds: number;
}

export function buildEvidenceCacheKey(cycleId: string): string {
  return `evidence/${cycleId}.json`;
}

export function buildBriefCacheKey(cycleId: string | null): string {
  return cycleId ? `briefs/${cycleId}.json` : "briefs/latest.json";
}

export function isCacheFresh(cachedAt: string, ttlSeconds: number, now = Date.now()): boolean {
  return Date.parse(cachedAt) + ttlSeconds * 1000 > now;
}

export async function readCachedJson<T>(
  key: string,
): Promise<{ data: T; edgeCache: EdgeCacheMetadata } | null> {
  const store = getStore("proof-first-cache");
  const data = await store.get(key, { type: "json" });
  const metadata = (await store.getMetadata(key)) as CachedMetadata | null;
  if (!data || !metadata) {
    return null;
  }

  return {
    data: data as T,
    edgeCache: {
      cache_key: key,
      cached_at: metadata.cachedAt,
      fetched_at: metadata.fetchedAt,
      ttl_seconds: metadata.ttlSeconds,
      hit: true,
    },
  };
}

export async function writeCachedJson<T>(key: string, data: T, ttlSeconds: number): Promise<EdgeCacheMetadata> {
  const store = getStore("proof-first-cache");
  const now = new Date().toISOString();
  await store.setJSON(key, data, {
    metadata: {
      cachedAt: now,
      fetchedAt: now,
      ttlSeconds,
    },
  });

  return {
    cache_key: key,
    cached_at: now,
    fetched_at: now,
    ttl_seconds: ttlSeconds,
    hit: false,
  };
}
