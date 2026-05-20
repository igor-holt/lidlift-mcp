import type { Context } from "@netlify/functions";

import type { OperatorBriefPayload, OverviewPayload } from "../../src/types";
import { requireOperator } from "./lib/auth";
import { generateOperatorBrief } from "./lib/ai";
import { buildBriefCacheKey, isCacheFresh, readCachedJson, writeCachedJson } from "./lib/cache";
import { getRuntimeConfig } from "./lib/config";
import { jsonResponse, noStoreHeaders } from "./lib/http";
import { fetchUpstreamJson } from "./lib/upstream";

export default async (request: Request, context: Context): Promise<Response> => {
  try {
    requireOperator(context);
  } catch (response) {
    if (response instanceof Response) {
      return response;
    }
    throw response;
  }

  const cycleId = new URL(request.url).searchParams.get("cycleId")?.trim() ?? null;
  const { briefTtlSeconds } = getRuntimeConfig();
  const cacheKey = buildBriefCacheKey(cycleId);
  const cached = await readCachedJson<OperatorBriefPayload>(cacheKey);
  if (cached && isCacheFresh(cached.edgeCache.cached_at, briefTtlSeconds)) {
    return jsonResponse(
      {
        ...cached.data,
        edge_cache: cached.edgeCache,
      },
      noStoreHeaders(),
    );
  }

  const overview = await fetchUpstreamJson<OverviewPayload>("/api/proof-first/overview");
  const evidence = cycleId
    ? await fetchUpstreamJson<Record<string, unknown>>(`/api/proof-first/evidence/${encodeURIComponent(cycleId)}`)
    : null;
  const brief = await generateOperatorBrief(overview, evidence, cycleId);
  const payload: OperatorBriefPayload = {
    cycle_id: cycleId ?? overview.latest_cycle_id ?? null,
    generated_at: new Date().toISOString(),
    model: brief.model,
    summary: brief.summary,
    evidence_loaded: Boolean(evidence),
  };
  const edgeCache = await writeCachedJson(cacheKey, payload, briefTtlSeconds);
  return jsonResponse(
    {
      ...payload,
      edge_cache: edgeCache,
    },
    noStoreHeaders(),
  );
};
