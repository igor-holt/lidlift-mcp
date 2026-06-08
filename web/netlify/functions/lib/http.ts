export function jsonResponse(payload: unknown, headers: HeadersInit = {}, status = 200): Response {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...headers,
    },
  });
}

export function noStoreHeaders(): HeadersInit {
  return {
    "Cache-Control": "no-store",
  };
}

export function publicCacheHeaders(tag: string, ttlSeconds: number): HeadersInit {
  return {
    "Netlify-CDN-Cache-Control": `public, durable, max-age=${ttlSeconds}, stale-while-revalidate=${ttlSeconds * 4}`,
    "Cache-Control": "public, max-age=0, must-revalidate",
    "Netlify-Cache-Tag": tag,
  };
}
