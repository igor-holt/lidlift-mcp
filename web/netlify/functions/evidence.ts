import type { Context } from "@netlify/functions";

import { buildEvidenceCacheKey, isCacheFresh, readCachedJson, writeCachedJson } from "./lib/cache";
import { getRuntimeConfig } from "./lib/config";
import { jsonResponse, publicCacheHeaders } from "./lib/http";
import { fetchUpstreamJson } from "./lib/upstream";

export default async (request: Request, _context: Context): Promise<Response> => {
  const cycleId = new URL(request.url).searchParams.get("cycleId")?.trim();
  if (!cycleId) {
    return jsonResponse({ error: "cycleId is required" }, {}, 400);
  }

  const { evidenceTtlSeconds } = getRuntimeConfig();
  const cacheKey = buildEvidenceCacheKey(cycleId);
  const cached = await readCachedJson<Record<string, unknown>>(cacheKey);
  if (cached && isCacheFresh(cached.edgeCache.cached_at, evidenceTtlSeconds)) {
    return jsonResponse(
      {
        ...cached.data,
        edge_cache: cached.edgeCache,
      },
      publicCacheHeaders("proof-first,evidence", evidenceTtlSeconds),
    );
  }

  const payload = await fetchUpstreamJson<Record<string, unknown>>(
    `/api/proof-first/evidence/${encodeURIComponent(cycleId)}`,
  );
  const edgeCache = await writeCachedJson(cacheKey, payload, evidenceTtlSeconds);
  return jsonResponse(
    {
      ...payload,
      edge_cache: edgeCache,
    },
    publicCacheHeaders("proof-first,evidence", evidenceTtlSeconds),
  );
};
