import type { Context } from "@netlify/functions";

import { jsonResponse, noStoreHeaders } from "./lib/http";
import { fetchUpstreamJson } from "./lib/upstream";

export default async (request: Request, _context: Context): Promise<Response> => {
  const authorization = request.headers.get("authorization");
  if (!authorization) {
    return jsonResponse({ error: "Authorization header required" }, noStoreHeaders(), 401);
  }

  try {
    const payload = await fetchUpstreamJson<Record<string, unknown>>("/api/balance", {
      headers: {
        Authorization: authorization,
      },
    });
    return jsonResponse(payload, noStoreHeaders());
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : String(error) },
      noStoreHeaders(),
      502,
    );
  }
};
