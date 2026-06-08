import type { Context } from "@netlify/functions";

import type { OverviewPayload } from "../../src/types";
import { getRuntimeConfig } from "./lib/config";
import { isCacheFresh, readCachedJson, writeCachedJson } from "./lib/cache";
import { jsonResponse, publicCacheHeaders } from "./lib/http";
import { fetchUpstreamJson } from "./lib/upstream";

const CACHE_KEY = "overview.json";

export default async (_request: Request, _context: Context): Promise<Response> => {
  const { overviewTtlSeconds } = getRuntimeConfig();
  const cached = await readCachedJson<OverviewPayload>(CACHE_KEY);
  if (cached && isCacheFresh(cached.edgeCache.cached_at, overviewTtlSeconds)) {
    return jsonResponse(
      {
        ...cached.data,
        edge_cache: cached.edgeCache,
      },
      publicCacheHeaders("proof-first,overview", overviewTtlSeconds),
    );
  }

  const payload = await fetchUpstreamJson<OverviewPayload>("/api/proof-first/overview");
  const edgeCache = await writeCachedJson(CACHE_KEY, payload, overviewTtlSeconds);
  return jsonResponse(
    {
      ...payload,
      edge_cache: edgeCache,
    },
    publicCacheHeaders("proof-first,overview", overviewTtlSeconds),
  );
};
