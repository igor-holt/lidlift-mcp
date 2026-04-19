import {
  autoDetectVendor,
  discoverVendorToolsResponse,
  getDiscoveryCacheTtlMs,
  getVendorApiKey,
  normalizeVendor,
  type DiscoveryError,
} from "@tool-dissonance/core";

function readBearerToken(request: Request) {
  const authorization = request.headers.get("authorization");

  if (!authorization?.toLowerCase().startsWith("bearer ")) {
    return undefined;
  }

  return authorization.slice("bearer ".length).trim() || undefined;
}

function parseForceRefresh(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    return value.trim().toLowerCase() === "true";
  }

  return false;
}

function errorResponse(error: DiscoveryError, status = error.status ?? 500) {
  return Response.json(
    {
      ok: false,
      error,
      model: null,
      vendor: error.vendor ?? null,
    },
    { status },
  );
}

function responseHeaders(cacheTtlMs: number) {
  return {
    "Cache-Control": `private, max-age=${Math.max(
      0,
      Math.ceil(cacheTtlMs / 1000),
    )}`,
  };
}

function resolveRequestedVendor(request: Request, explicitVendor?: string) {
  const hintedVendor =
    typeof explicitVendor === "string" && explicitVendor.trim()
      ? explicitVendor.trim()
      : autoDetectVendor(request);

  if (!hintedVendor) {
    return null;
  }

  return normalizeVendor(hintedVendor);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const model = url.searchParams.get("model") ?? undefined;
  const forceRefresh = parseForceRefresh(url.searchParams.get("force_refresh"));
  const cacheTtlMs = getDiscoveryCacheTtlMs(process.env);

  let vendor;

  try {
    vendor = resolveRequestedVendor(request, url.searchParams.get("vendor") ?? undefined);
  } catch (error) {
    return errorResponse(
      {
        code: "ERR_VENDOR",
        message:
          error instanceof Error ? error.message : "Unsupported vendor.",
      },
      400,
    );
  }

  if (!vendor) {
    return errorResponse(
      {
        code: "ERR_VENDOR",
        message:
          "Vendor is required. Provide ?vendor=... or send X-Vendor or vendor-specific auth headers for auto-detection.",
        status: 400,
      },
      400,
    );
  }

  const discovery = await discoverVendorToolsResponse(vendor, {
    cacheTtlMs,
    forceRefresh,
    model,
    apiKey: getVendorApiKey(vendor, readBearerToken(request), process.env),
  });

  return Response.json(discovery, {
    status: discovery.ok ? 200 : discovery.error.status ?? 500,
    headers: responseHeaders(cacheTtlMs),
  });
}

export async function POST(request: Request) {
  const cacheTtlMs = getDiscoveryCacheTtlMs(process.env);

  try {
    const body = (await request.json()) as {
      auth_token?: unknown;
      apiKey?: unknown;
      force_refresh?: unknown;
      forceRefresh?: unknown;
      model?: unknown;
      vendor?: unknown;
    };

    let vendor;

    try {
      vendor = resolveRequestedVendor(
        request,
        typeof body.vendor === "string" ? body.vendor : undefined,
      );
    } catch (error) {
      return errorResponse(
        {
          code: "ERR_VENDOR",
          message:
            error instanceof Error ? error.message : "Unsupported vendor.",
        },
        400,
      );
    }

    if (!vendor) {
      return errorResponse(
        {
          code: "ERR_VENDOR",
          message:
            "Vendor is required. Provide vendor in the request body or send X-Vendor or vendor-specific auth headers for auto-detection.",
          status: 400,
        },
        400,
      );
    }

    const authToken =
      typeof body.auth_token === "string"
        ? body.auth_token
        : typeof body.apiKey === "string"
          ? body.apiKey
          : readBearerToken(request);

    const discovery = await discoverVendorToolsResponse(vendor, {
      cacheTtlMs,
      forceRefresh:
        parseForceRefresh(body.force_refresh) ||
        parseForceRefresh(body.forceRefresh),
      model: typeof body.model === "string" ? body.model : undefined,
      apiKey: getVendorApiKey(vendor, authToken, process.env),
    });

    return Response.json(discovery, {
      status: discovery.ok ? 200 : discovery.error.status ?? 500,
      headers: responseHeaders(cacheTtlMs),
    });
  } catch {
    return errorResponse(
      {
        code: "ERR_NETWORK",
        message: "Unable to read the discovery request body.",
        status: 400,
      },
      400,
    );
  }
}
